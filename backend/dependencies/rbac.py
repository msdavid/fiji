from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from typing import List, Dict, Any, Set, Optional
from firebase_admin import firestore

# Import functions locally to avoid circular import 
from dependencies.database import get_db

# Collection names (if not already defined or imported where RBACUser is used by other modules)
# These are primarily used within get_current_user_with_rbac which is now in auth.py
# USERS_COLLECTION = "users"
# ROLES_COLLECTION = "roles"
# ASSIGNMENTS_COLLECTION = "assignments"

class RBACUser:
    """
    Represents an authenticated user with their roles, consolidated privileges,
    and basic profile information.
    """
    def __init__(self, 
                 uid: str, 
                 email: Optional[str], 
                 roles: List[str], 
                 privileges: Dict[str, Set[str]], 
                 is_sysadmin: bool = False,
                 first_name: Optional[str] = None, 
                 last_name: Optional[str] = None   
                ):
        self.uid: str = uid
        self.email: Optional[str] = email
        self.roles: List[str] = roles  
        self.privileges: Dict[str, Set[str]] = privileges  
        self.is_sysadmin: bool = is_sysadmin
        self.first_name: Optional[str] = first_name 
        self.last_name: Optional[str] = last_name   

    def has_permission(self, resource: str, action: str) -> bool:
        """
        Checks if the user has a specific permission.
        """
        if self.is_sysadmin:
            return True
        
        resource_privileges = self.privileges.get(resource)
        if resource_privileges and action in resource_privileges:
            return True
        return False

# This function remains but is no longer the primary source for require_permission
# It might be used by older parts of the system or for specific flows that still rely directly on Firebase ID token for RBAC.
async def get_current_user_with_rbac( 
    db: firestore.AsyncClient = Depends(get_db), 
    token: str = Depends(OAuth2PasswordBearer(tokenUrl="token"))
) -> RBACUser:
    """
    FastAPI dependency to get the current authenticated user (from Firebase ID token)
    along with their RBAC roles, consolidated privileges, and basic profile info.
    This is now a legacy function for RBAC checks; prefer get_current_session_user_with_rbac.
    """
    # Import locally to avoid circular import
    from dependencies.auth import get_firebase_user
    
    firebase_user = await get_firebase_user(token)
    
    if not firebase_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required for RBAC context (Firebase token).",
        )
    uid = firebase_user.get("uid")
    email = firebase_user.get("email")
    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Firebase token: UID missing.",
        )

    user_doc_ref = db.collection("users").document(uid)
    user_doc = await user_doc_ref.get()
    if not user_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User profile not found in application database (Firebase RBAC). Access denied.",
        )
    
    user_data = user_doc.to_dict()
    assigned_role_ids: List[str] = user_data.get("assignedRoleIds", [])
    if assigned_role_ids is None: assigned_role_ids = []
    
    first_name: Optional[str] = user_data.get("firstName")
    last_name: Optional[str] = user_data.get("lastName")
    is_sysadmin = "sysadmin" in assigned_role_ids
    consolidated_privileges: Dict[str, Set[str]] = {}

    if not is_sysadmin:
        if assigned_role_ids:
            for role_id in assigned_role_ids:
                role_doc = await db.collection("roles").document(role_id).get()
                if role_doc.exists:
                    role_data = role_doc.to_dict()
                    privileges_for_role = role_data.get("privileges", {})
                    for resource, actions in privileges_for_role.items():
                        if not isinstance(actions, list):
                            print(f"Warning: Malformed actions for resource '{resource}' in role '{role_doc.id}'.")
                            continue
                        if resource not in consolidated_privileges:
                            consolidated_privileges[resource] = set()
                        consolidated_privileges[resource].update(actions)
        try:
            assignments_query = db.collection("assignments").where("userId", "==", uid).where("assignableType", "==", "workingGroup").where("status", "==", "active")
            assignments_docs = await assignments_query.get()
            has_working_group_assignment = any(assignments_docs)
            if has_working_group_assignment:
                if "working_groups" not in consolidated_privileges: consolidated_privileges["working_groups"] = set()
                consolidated_privileges["working_groups"].add("view")
                if "assignments" not in consolidated_privileges: consolidated_privileges["assignments"] = set()
                consolidated_privileges["assignments"].add("view_own")
        except Exception as e:
            print(f"Warning: Failed to check working group assignments for user {uid} (Firebase RBAC): {e}")
    
    return RBACUser(
        uid=uid, email=email, roles=assigned_role_ids, 
        privileges=consolidated_privileges, is_sysadmin=is_sysadmin,
        first_name=first_name, last_name=last_name
    )

def require_permission(resource: str, action: str):
    """
    Dependency factory that creates a dependency to check if the current user
    (authenticated via backend session token) has the required permission.
    """
    async def _permission_checker(
        db: firestore.AsyncClient = Depends(get_db),
        token: str = Depends(OAuth2PasswordBearer(tokenUrl="token"))
    ):
        # Import locally to avoid circular import
        from dependencies.auth import get_current_session_user, get_current_session_user_with_rbac
        
        session_data = await get_current_session_user(token, db)
        current_rbac_user = await get_current_session_user_with_rbac(session_data, db)
        
        if not current_rbac_user.has_permission(resource, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User does not have permission to perform '{action}' on '{resource}'.",
            )
        return current_rbac_user # Return the RBACUser for potential use in the route
    return _permission_checker

async def is_sysadmin_check(
    db: firestore.AsyncClient = Depends(get_db),
    token: str = Depends(OAuth2PasswordBearer(tokenUrl="token"))
) -> bool:
    """
    Checks if the current RBAC user (from backend session) is a sysadmin.
    """
    try:
        # Import locally to avoid circular import
        from dependencies.auth import get_current_session_user, get_current_session_user_with_rbac
        
        session_data = await get_current_session_user(token, db)
        current_rbac_user = await get_current_session_user_with_rbac(session_data, db)
        
        if not current_rbac_user:
            return False
        return current_rbac_user.is_sysadmin
    except:
        return False
