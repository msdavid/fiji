from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Optional
from firebase_admin import firestore

from models.donation import DonationCreate, DonationUpdate, DonationResponse
# Removed: from models.user import UserAvailability 
from dependencies.database import get_db
from dependencies.rbac import RBACUser, require_permission
from dependencies.auth import get_current_session_user_with_rbac

router = APIRouter(
    prefix="/donations",
    tags=["donations"]
)

DONATIONS_COLLECTION = "donations"
USERS_COLLECTION = "users" # For fetching details of user who recorded donation

async def _get_user_details_for_donation(db: firestore.AsyncClient, user_id: Optional[str]) -> dict:
    """Helper function to fetch user details for the user who recorded the donation."""
    if not user_id:
        return {}
    user_ref = db.collection(USERS_COLLECTION).document(user_id)
    user_doc = await user_ref.get()
    if user_doc.exists:
        user_data = user_doc.to_dict()
        return {
            "firstName": user_data.get("firstName"),
            "lastName": user_data.get("lastName"),
        }
    return {}

@router.post(
    "",
    response_model=DonationResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("donations", "create"))]
)
async def create_donation(
    donation_data: DonationCreate,
    db: firestore.AsyncClient = Depends(get_db),
    current_rbac_user: RBACUser = Depends(get_current_session_user_with_rbac)
):
    try:
        new_donation_dict = donation_data.model_dump()
        new_donation_dict["recordedByUserId"] = current_rbac_user.uid
        new_donation_dict["createdAt"] = firestore.SERVER_TIMESTAMP
        new_donation_dict["updatedAt"] = firestore.SERVER_TIMESTAMP

        # Auto-link: If donorUserId is provided, also update any existing donations with the same email
        donor_user_id = new_donation_dict.get("donorUserId")
        donor_email = new_donation_dict.get("donorEmail")
        
        if donor_user_id and donor_email:
            try:
                # Find existing donations with the same email but no donorUserId
                existing_donations_query = db.collection(DONATIONS_COLLECTION)\
                    .where("donorEmail", "==", donor_email)\
                    .where("donorUserId", "==", None)
                
                existing_docs = existing_donations_query.stream()
                
                # Update existing donations to link them to this user
                link_count = 0
                async for existing_doc in existing_docs:
                    try:
                        await db.collection(DONATIONS_COLLECTION).document(existing_doc.id).update({
                            "donorUserId": donor_user_id
                        })
                        link_count += 1
                    except Exception as update_error:
                        print(f"Warning: Could not link existing donation {existing_doc.id}: {update_error}")
                
                if link_count > 0:
                    print(f"Auto-linked {link_count} existing donations for user {donor_user_id}")
                    
            except Exception as linking_error:
                print(f"Warning: Auto-linking failed: {linking_error}")
                # Don't fail the donation creation if linking fails

        # Validate donationType and amount/currency consistency
        if new_donation_dict["donationType"] == "monetary":
            if new_donation_dict.get("amount") is None or new_donation_dict.get("currency") is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Monetary donations must include amount and currency."
                )
        else: # For in_kind or time_contribution, amount/currency should ideally be null or not present
            new_donation_dict["amount"] = None
            new_donation_dict["currency"] = None
            if not new_donation_dict.get("description"): # Description is crucial for non-monetary
                 raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Non-monetary donations must include a description."
                )


        doc_ref = db.collection(DONATIONS_COLLECTION).document()
        await doc_ref.set(new_donation_dict)

        created_donation_doc = await doc_ref.get()
        if created_donation_doc.exists:
            response_data = created_donation_doc.to_dict()
            response_data['id'] = created_donation_doc.id
            
            recorder_details = await _get_user_details_for_donation(db, response_data.get("recordedByUserId"))
            response_data["recordedByUserFirstName"] = recorder_details.get("firstName")
            response_data["recordedByUserLastName"] = recorder_details.get("lastName")
            
            return DonationResponse(**response_data)
        else:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to retrieve donation after creation.")
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.get("/my-contributions", response_model=List[DonationResponse])
async def get_my_donations(
    db: firestore.AsyncClient = Depends(get_db),
    current_user: RBACUser = Depends(get_current_session_user_with_rbac),
    limit: int = Query(default=10, le=50, description="Maximum number of donations to return")
):
    """Get donations made by the current user (by donorUserId or email)"""
    try:
        print(f"DEBUG: Fetching donations for user {current_user.uid} ({current_user.email})")
        donations_list = []
        user_details_cache = {}
        
        # First, try to find donations by donorUserId
        try:
            query_by_id = db.collection(DONATIONS_COLLECTION).where("donorUserId", "==", current_user.uid)
            query_by_id = query_by_id.order_by("createdAt", direction=firestore.Query.DESCENDING)
            query_by_id = query_by_id.limit(limit)
            
            docs_by_id = query_by_id.stream()
            async for doc in docs_by_id:
                try:
                    donation_data = doc.to_dict()
                    donation_data['id'] = doc.id
                    
                    recorded_by_user_id = donation_data.get("recordedByUserId")
                    if recorded_by_user_id:
                        if recorded_by_user_id not in user_details_cache:
                            user_details_cache[recorded_by_user_id] = await _get_user_details_for_donation(db, recorded_by_user_id)
                        recorder_details = user_details_cache[recorded_by_user_id]
                        donation_data["recordedByUserFirstName"] = recorder_details.get("firstName")
                        donation_data["recordedByUserLastName"] = recorder_details.get("lastName")

                    donations_list.append(DonationResponse(**donation_data))
                except Exception as doc_error:
                    print(f"Error processing donation document by ID {doc.id}: {doc_error}")
                    continue
        except Exception as query_error:
            print(f"Warning: Error querying donations by donorUserId: {query_error}")
        
        print(f"DEBUG: Found {len(donations_list)} donations by donorUserId")
        
        # If we haven't reached the limit, also search by email for legacy donations
        if len(donations_list) < limit and current_user.email:
            remaining_limit = limit - len(donations_list)
            try:
                query_by_email = db.collection(DONATIONS_COLLECTION).where("donorEmail", "==", current_user.email)
                query_by_email = query_by_email.order_by("createdAt", direction=firestore.Query.DESCENDING)
                query_by_email = query_by_email.limit(remaining_limit)
                
                # Track IDs we already added to avoid duplicates
                existing_ids = {donation.id for donation in donations_list}
                
                docs_by_email = query_by_email.stream()
                async for doc in docs_by_email:
                    if doc.id not in existing_ids:  # Avoid duplicates
                        try:
                            donation_data = doc.to_dict()
                            donation_data['id'] = doc.id
                            
                            recorded_by_user_id = donation_data.get("recordedByUserId")
                            if recorded_by_user_id:
                                if recorded_by_user_id not in user_details_cache:
                                    user_details_cache[recorded_by_user_id] = await _get_user_details_for_donation(db, recorded_by_user_id)
                                recorder_details = user_details_cache[recorded_by_user_id]
                                donation_data["recordedByUserFirstName"] = recorder_details.get("firstName")
                                donation_data["recordedByUserLastName"] = recorder_details.get("lastName")

                            donations_list.append(DonationResponse(**donation_data))
                        except Exception as doc_error:
                            print(f"Error processing donation document by email {doc.id}: {doc_error}")
                            continue
            except Exception as email_query_error:
                print(f"Warning: Error querying donations by email: {email_query_error}")
        
        print(f"DEBUG: Total donations found: {len(donations_list)}")
        
        # Sort the combined results by creation date (most recent first)
        donations_list.sort(key=lambda x: x.createdAt, reverse=True)
        
        result = donations_list[:limit]  # Ensure we don't exceed the limit
        print(f"DEBUG: Returning {len(result)} donations to frontend")
        return result
        
    except Exception as e:
        print(f"Error in get_my_donations: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.get("/debug-all", dependencies=[Depends(require_permission("donations", "list"))])
async def debug_all_donations(db: firestore.AsyncClient = Depends(get_db)):
    """Debug endpoint to see all donations in the database"""
    try:
        query = db.collection(DONATIONS_COLLECTION).limit(10)
        docs = query.stream()
        
        donations_debug = []
        async for doc in docs:
            data = doc.to_dict()
            donations_debug.append({
                "id": doc.id,
                "donorEmail": data.get("donorEmail"),
                "donorUserId": data.get("donorUserId"),
                "donorName": data.get("donorName"),
                "description": data.get("description", "")[:30] + "...",
                "donationType": data.get("donationType"),
                "createdAt": str(data.get("createdAt"))
            })
        
        return {"total_found": len(donations_debug), "donations": donations_debug}
    except Exception as e:
        return {"error": str(e)}

@router.get("", response_model=List[DonationResponse], dependencies=[Depends(require_permission("donations", "list"))])
async def list_donations(
    db: firestore.AsyncClient = Depends(get_db),
    offset: int = 0,
    limit: int = Query(default=20, le=100),
    sort_by: Optional[str] = Query("donationDate", description="Field to sort by (e.g., donationDate, createdAt)"),
    sort_order: Optional[str] = Query("desc", description="Sort order ('asc' or 'desc')")
):
    try:
        query = db.collection(DONATIONS_COLLECTION)
        
        # Basic sorting
        direction = firestore.Query.DESCENDING if sort_order == "desc" else firestore.Query.ASCENDING
        if sort_by:
            query = query.order_by(sort_by, direction=direction)
        
        query = query.limit(limit).offset(offset)
        docs_snapshot = query.stream()
        
        donations_list = []
        user_details_cache = {}

        async for doc in docs_snapshot:
            donation_data = doc.to_dict()
            donation_data['id'] = doc.id
            
            recorded_by_user_id = donation_data.get("recordedByUserId")
            if recorded_by_user_id:
                if recorded_by_user_id not in user_details_cache:
                    user_details_cache[recorded_by_user_id] = await _get_user_details_for_donation(db, recorded_by_user_id)
                recorder_details = user_details_cache[recorded_by_user_id]
                donation_data["recordedByUserFirstName"] = recorder_details.get("firstName")
                donation_data["recordedByUserLastName"] = recorder_details.get("lastName")

            donations_list.append(DonationResponse(**donation_data))
        return donations_list
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.get("/{donation_id}", response_model=DonationResponse, dependencies=[Depends(require_permission("donations", "view"))])
async def get_donation(donation_id: str, db: firestore.AsyncClient = Depends(get_db)):
    try:
        doc_ref = db.collection(DONATIONS_COLLECTION).document(donation_id)
        donation_doc = await doc_ref.get()
        if not donation_doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Donation '{donation_id}' not found")

        response_data = donation_doc.to_dict()
        response_data['id'] = donation_doc.id

        recorder_details = await _get_user_details_for_donation(db, response_data.get("recordedByUserId"))
        response_data["recordedByUserFirstName"] = recorder_details.get("firstName")
        response_data["recordedByUserLastName"] = recorder_details.get("lastName")
            
        return DonationResponse(**response_data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.put(
    "/{donation_id}",
    response_model=DonationResponse,
    dependencies=[Depends(require_permission("donations", "edit"))]
)
async def update_donation(
    donation_id: str,
    donation_update_data: DonationUpdate,
    db: firestore.AsyncClient = Depends(get_db)
):
    try:
        doc_ref = db.collection(DONATIONS_COLLECTION).document(donation_id)
        donation_doc_snapshot = await doc_ref.get()
        if not donation_doc_snapshot.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Donation '{donation_id}' not found")

        update_data_dict = donation_update_data.model_dump(exclude_unset=True)
        if not update_data_dict:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided.")

        # Validate donationType and amount/currency consistency if donationType is being updated
        current_data = donation_doc_snapshot.to_dict()
        final_donation_type = update_data_dict.get("donationType", current_data.get("donationType"))

        if final_donation_type == "monetary":
            final_amount = update_data_dict.get("amount", current_data.get("amount"))
            final_currency = update_data_dict.get("currency", current_data.get("currency"))
            if final_amount is None or final_currency is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Monetary donations must include amount and currency."
                )
        else: # For in_kind or time_contribution
            if "amount" in update_data_dict or ("amount" not in current_data and update_data_dict.get("amount") is not None) : 
                update_data_dict["amount"] = None
            if "currency" in update_data_dict or ("currency" not in current_data and update_data_dict.get("currency") is not None):
                update_data_dict["currency"] = None
            
            final_description = update_data_dict.get("description", current_data.get("description"))
            if not final_description:
                 raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="Non-monetary donations must include a description."
                )

        update_data_dict["updatedAt"] = firestore.SERVER_TIMESTAMP
        await doc_ref.update(update_data_dict)

        updated_donation_doc = await doc_ref.get()
        response_data = updated_donation_doc.to_dict()
        response_data['id'] = updated_donation_doc.id
        
        recorder_details = await _get_user_details_for_donation(db, response_data.get("recordedByUserId"))
        response_data["recordedByUserFirstName"] = recorder_details.get("firstName")
        response_data["recordedByUserLastName"] = recorder_details.get("lastName")

        return DonationResponse(**response_data)
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")

@router.delete(
    "/{donation_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("donations", "delete"))]
)
async def delete_donation(donation_id: str, db: firestore.AsyncClient = Depends(get_db)):
    try:
        doc_ref = db.collection(DONATIONS_COLLECTION).document(donation_id)
        donation_doc = await doc_ref.get()
        if not donation_doc.exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Donation '{donation_id}' not found")
        
        await doc_ref.delete()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")
