from fastapi import Depends, HTTPException, status
from typing import List, Dict, Any, Set, Optional
from firebase_admin import firestore 

from dependencies.auth import get_firebase_user 
from dependencies.database import get_db 


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
                 first_name: Optional[str] = None, # Added firstName
                 last_name: Optional[str] = None   # Added lastName
                ):
        self.uid: str = uid
        self.email: Optional[str] = email
        self.roles: List[str] = roles  
        self.privileges: Dict[str, Set[str]] = privileges  
        self.is_sysadmin: bool = is_sysadmin
        self.first_name: Optional[str] = first_name # Added firstName
        self.last_name: Optional[str] = last_name   # Added lastName

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

async def get_current_user_with_rbac( 
    db: firestore.AsyncClient = Depends(get_db), 
    firebase_user: dict = Depends(get_firebase_user)
) -> RBACUser:
    """
    FastAPI dependency to get the current authenticated user along with their
    RBAC roles, consolidated privileges, and basic profile info (name).
    """
    if not firebase_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required for RBAC context.",
        )

    uid = firebase_user.get("uid")
    email = firebase_user.get("email")

    if not uid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials: UID missing from token.",
        )

    user_doc_ref = db.collection("users").document(uid)
    user_doc = await user_doc_ref.get() 

    if not user_doc.exists: 
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User profile not found in Firestore. Access denied.",
        )
    
    user_data = user_doc.to_dict()
    assigned_role_ids: List[str] = user_data.get("assignedRoleIds", []) 
    if assigned_role_ids is None:
        assigned_role_ids = [] 
    
    first_name: Optional[str] = user_data.get("firstName") # Get firstName
    last_name: Optional[str] = user_data.get("lastName")   # Get lastName
    
    is_sysadmin = "sysadmin" in assigned_role_ids 
    consolidated_privileges: Dict[str, Set[str]] = {}

    if not is_sysadmin and assigned_role_ids:
        for role_id in assigned_role_ids: 
            role_doc_ref = db.collection("roles").document(role_id) 
            role_doc = await role_doc_ref.get() 
            
            if role_doc.exists:
                role_data = role_doc.to_dict()
                privileges_for_role = role_data.get("privileges", {})
                for resource, actions in privileges_for_role.items():
                    if not isinstance(actions, list): 
                        print(f"Warning: Malformed actions for resource '{resource}' in role '{role_id}'. Expected list, got {type(actions)}.")
                        continue
                    if resource not in consolidated_privileges:
                        consolidated_privileges[resource] = set()
                    consolidated_privileges[resource].update(actions)
            else:
                print(f"Warning: User '{uid}' is assigned non-existent role ID '{role_id}'.")
    
    return RBACUser(
        uid=uid,
        email=email,
        roles=assigned_role_ids, 
        privileges=consolidated_privileges,
        is_sysadmin=is_sysadmin,
        first_name=first_name, # Pass firstName
        last_name=last_name    # Pass lastName
    )

def require_permission(resource: str, action: str):
    """
    Dependency factory that creates a dependency to check if the current user
    has the required permission for a given resource and action.
    """
    async def _permission_checker( 
        current_rbac_user: RBACUser = Depends(get_current_user_with_rbac) 
    ):
        if not current_rbac_user.has_permission(resource, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User does not have permission to perform '{action}' on '{resource}'.",
            )
        return current_rbac_user
    return _permission_checker