from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from firebase_admin import firestore
import datetime

from dependencies.database import get_db
from dependencies.rbac import RBACUser
from models.organization import OrganizationConfiguration, OrganizationConfigurationUpdate

router = APIRouter(prefix="/organization", tags=["organization"])

ORGANIZATION_COLLECTION = "organization_config"
MAIN_CONFIG_DOC_ID = "main_config"

async def require_sysadmin(
    db: firestore.AsyncClient = Depends(get_db),
    token: str = Depends(OAuth2PasswordBearer(tokenUrl="token"))
) -> RBACUser:
    """
    Dependency to ensure the current user is a sysadmin.
    """
    # Import locally to avoid circular import
    from dependencies.auth import get_current_session_user, get_current_session_user_with_rbac
    
    session_data = await get_current_session_user(token, db)
    current_rbac_user = await get_current_session_user_with_rbac(session_data, db)
    
    if not current_rbac_user.is_sysadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only system administrators can access organization settings."
        )
    return current_rbac_user

@router.post("/test")
async def test_organization_data(
    data: dict,
    current_user: RBACUser = Depends(require_sysadmin)
):
    """
    Test endpoint to debug incoming data
    """
    print(f"DEBUG: Raw incoming data: {data}")
    try:
        # Try to create the update model
        update_model = OrganizationConfigurationUpdate(**data)
        print(f"DEBUG: Model created successfully: {update_model}")
        return {"status": "success", "data": update_model.model_dump()}
    except Exception as e:
        print(f"DEBUG: Model validation failed: {e}")
        return {"status": "error", "error": str(e)}

@router.get("/public")
async def get_public_organization_settings(
    db: firestore.AsyncClient = Depends(get_db)
):
    """
    Get public organization settings (donations_url, website_url, etc.). 
    No authentication required.
    """
    try:
        config_doc = await db.collection(ORGANIZATION_COLLECTION).document(MAIN_CONFIG_DOC_ID).get()
        
        if not config_doc.exists:
            return {"donations_url": None, "website_url": None, "name": None}
        
        config_data = config_doc.to_dict()
        # Only return public fields
        return {
            "donations_url": config_data.get("donations_url"),
            "website_url": config_data.get("website_url"),
            "name": config_data.get("name")
        }
        
    except Exception as e:
        print(f"ERROR in get_public_organization_settings: {e}")
        return {"donations_url": None, "website_url": None, "name": None}

@router.get("/", response_model=OrganizationConfiguration)
async def get_organization_settings(
    current_user: RBACUser = Depends(require_sysadmin),
    db: firestore.AsyncClient = Depends(get_db)
):
    """
    Get organization settings. Only accessible by sysadmins.
    """
    
    config_doc = await db.collection(ORGANIZATION_COLLECTION).document(MAIN_CONFIG_DOC_ID).get()
    
    if not config_doc.exists:
        # Return default/empty configuration if none exists
        default_config = {
            "id": MAIN_CONFIG_DOC_ID,
            "name": None,
            "logo_url": None,
            "email_sender_name": None,
            "email_sender_address": None,
            "primary_color": None,
            "secondary_color": None,
            "contact_email": None,
            "website_url": None,
            "donations_url": None,
            "address": None,
            "phone": None,
            "description": None,
            "created_at": None,
            "updated_at": None
        }
        return OrganizationConfiguration(**default_config)
    
    config_data = config_doc.to_dict()
    config_data["id"] = config_doc.id
    
    return OrganizationConfiguration(**config_data)

@router.put("/", response_model=OrganizationConfiguration)
async def update_organization_settings(
    update_data: OrganizationConfigurationUpdate,
    current_user: RBACUser = Depends(require_sysadmin),
    db: firestore.AsyncClient = Depends(get_db)
):
    """
    Update organization settings. Only accessible by sysadmins.
    """
    try:
        config_ref = db.collection(ORGANIZATION_COLLECTION).document(MAIN_CONFIG_DOC_ID)
        config_doc = await config_ref.get()
        
        now = datetime.datetime.utcnow()
        
        # Convert update data to dict, excluding None values
        update_dict = update_data.model_dump(exclude_none=True)
        print(f"DEBUG: Update data received: {update_dict}")
        
        # Convert HttpUrl objects to strings for Firestore compatibility
        url_fields = ['logo_url', 'website_url', 'donations_url']
        for field in url_fields:
            if field in update_dict and update_dict[field] is not None:
                update_dict[field] = str(update_dict[field])
        
        update_dict["updated_at"] = now
        
        if not config_doc.exists:
            # Create new configuration
            update_dict["created_at"] = now
            await config_ref.set(update_dict)
        else:
            # Update existing configuration
            await config_ref.update(update_dict)
        
        # Fetch the updated document
        updated_doc = await config_ref.get()
        config_data = updated_doc.to_dict()
        config_data["id"] = updated_doc.id
        
        return OrganizationConfiguration(**config_data)
        
    except Exception as e:
        print(f"ERROR in update_organization_settings: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Server error: {str(e)}"
        )