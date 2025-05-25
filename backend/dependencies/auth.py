from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import firebase_admin
from firebase_admin import auth, firestore
from typing import Optional, List, Dict, Set # Added List, Dict, Set

from services.session_service import SessionService
from dependencies.database import get_db
# Import RBACUser from rbac.py to be used as a return type and for its structure
# RBACUser will be imported locally to avoid circular import

# Define collection names here if they are used in this file, or ensure they are passed/accessible
USERS_COLLECTION = "users"
ROLES_COLLECTION = "roles"
ASSIGNMENTS_COLLECTION = "assignments" # For working group permission check

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token") 

async def get_firebase_user(token: str = Depends(oauth2_scheme)) -> dict:
    """
    Dependency to verify Firebase ID token and get user data.
    Used for initial authentication steps (e.g., session login, 2FA setup).
    """
    if not firebase_admin._apps:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase Admin SDK is not initialized. Cannot authenticate user.",
        )
    try:
        decoded_token = auth.verify_id_token(token, check_revoked=True)
        return decoded_token
    except auth.RevokedIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firebase ID token has been revoked. Please re-authenticate.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.UserDisabledError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account has been disabled.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase ID token. Please provide a valid token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        print(f"An unexpected error occurred during Firebase token verification: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not verify Firebase ID token due to an internal error.",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_session_user(
    token: str = Depends(oauth2_scheme),
    db: firestore.AsyncClient = Depends(get_db)
) -> dict:
    """
    Dependency to verify backend-issued session token and get basic user session data (UID).
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated: No token provided.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    session_service = SessionService(db) # db is passed to SessionService constructor
    user_session_data = await session_service.verify_session_token(token)

    if not user_session_data or "uid" not in user_session_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired backend session token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_session_data

async def get_current_session_user_with_rbac(
    session_data: dict = Depends(get_current_session_user),
    db: firestore.AsyncClient = Depends(get_db)
):
    """
    FastAPI dependency to get the current authenticated user (from backend session token)
    along with their RBAC roles, consolidated privileges, and basic profile info.
    """
    user_id = session_data.get("uid")
    # email = session_data.get("email") # Email might not be in the basic session token, fetch from user_doc

    user_doc_ref = db.collection(USERS_COLLECTION).document(user_id)
    user_doc = await user_doc_ref.get()

    if not user_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="User profile not found for session. Access denied.",
        )
    
    user_data = user_doc.to_dict()
    email = user_data.get("email") # Get email from Firestore user profile
    assigned_role_ids: List[str] = user_data.get("assignedRoleIds", [])
    if assigned_role_ids is None: assigned_role_ids = []
    
    first_name: Optional[str] = user_data.get("firstName")
    last_name: Optional[str] = user_data.get("lastName")
    
    is_sysadmin = "sysadmin" in assigned_role_ids
    consolidated_privileges: Dict[str, Set[str]] = {}

    if not is_sysadmin:
        if assigned_role_ids:
            for role_id in assigned_role_ids:
                role_doc = await db.collection(ROLES_COLLECTION).document(role_id).get()
                if role_doc.exists:
                    role_data = role_doc.to_dict()
                    privileges_for_role = role_data.get("privileges", {})
                    for resource, actions in privileges_for_role.items():
                        if not isinstance(actions, list):
                            print(f"Warning: Malformed actions for resource '{resource}' in role '{role_doc.id}'. Expected list.")
                            continue
                        if resource not in consolidated_privileges:
                            consolidated_privileges[resource] = set()
                        consolidated_privileges[resource].update(actions)
        
        try:
            assignments_query = db.collection(ASSIGNMENTS_COLLECTION).where("userId", "==", user_id).where("assignableType", "==", "workingGroup").where("status", "==", "active")
            assignments_docs = await assignments_query.get() # Use .get() for async query
            
            has_working_group_assignment = False
            for _ in assignments_docs: # Iterate to check if any documents exist
                has_working_group_assignment = True
                break
            
            if has_working_group_assignment:
                if "working_groups" not in consolidated_privileges:
                    consolidated_privileges["working_groups"] = set()
                consolidated_privileges["working_groups"].add("view")
                
                if "assignments" not in consolidated_privileges:
                    consolidated_privileges["assignments"] = set()
                consolidated_privileges["assignments"].add("view_own")
        except Exception as e:
            print(f"Warning: Failed to check working group assignments for user {user_id}: {e}")

    # Import locally to avoid circular import
    from dependencies.rbac import RBACUser
    
    return RBACUser(
        uid=user_id,
        email=email,
        roles=assigned_role_ids,
        privileges=consolidated_privileges,
        is_sysadmin=is_sysadmin,
        first_name=first_name,
        last_name=last_name
    )
