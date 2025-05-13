from fastapi import Depends, HTTPException, status
from typing import List, Dict, Any, Set, Optional 
from firebase_admin import firestore # Import firestore for type hinting

# Use direct imports from subdirectories of 'backend'
from dependencies.auth import get_firebase_user # Provides Firebase decoded token
from dependencies.database import get_db # Provides Firestore client instance


class RBACUser:
    """
    Represents an authenticated user with their roles and consolidated privileges.
    """
    def __init__(self, uid: str, email: Optional[str], roles: List[str], privileges: Dict[str, Set[str]], is_sysadmin: bool = False):
        self.uid: str = uid
        self.email: Optional[str] = email
        self.roles: List[str] = roles  # List of role names (e.g., ["editor", "viewer"])
        self.privileges: Dict[str, Set[str]] = privileges  # e.g., {"articles": {"read", "edit"}}
        self.is_sysadmin: bool = is_sysadmin

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

async def get_current_user_with_rbac( # Made async
    db: firestore.AsyncClient = Depends(get_db), # Use AsyncClient
    firebase_user: dict = Depends(get_firebase_user) 
) -> RBACUser:
    """
    FastAPI dependency to get the current authenticated user along with their
    RBAC roles and consolidated privileges.
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
    user_doc = await user_doc_ref.get() # Added await

    if not user_doc.exists: # Now this should work
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User profile not found in Firestore. Access denied.",
        )
    
    user_data = user_doc.to_dict()
    assigned_role_ids: List[str] = user_data.get("assignedRoleIds", []) # Changed from role_names to role_ids
    if assigned_role_ids is None: 
        assigned_role_ids = [] # Ensure it's a list
    
    is_sysadmin = "sysadmin" in assigned_role_ids # Check against role ID "sysadmin"
    consolidated_privileges: Dict[str, Set[str]] = {}

    if not is_sysadmin and assigned_role_ids:
        for role_id in assigned_role_ids: # Iterate over role_ids
            role_doc_ref = db.collection("roles").document(role_id) # Fetch role by ID
            role_doc = await role_doc_ref.get() # Added await
            
            if role_doc.exists:
                role_data = role_doc.to_dict()
                privileges_for_role = role_data.get("privileges", {})
                for resource, actions in privileges_for_role.items():
                    if not isinstance(actions, list): # Actions should be a list as per schema
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
        roles=assigned_role_ids, # Store role IDs
        privileges=consolidated_privileges,
        is_sysadmin=is_sysadmin
    )

def require_permission(resource: str, action: str):
    """
    Dependency factory that creates a dependency to check if the current user
    has the required permission for a given resource and action.
    """
    async def _permission_checker( # Made async
        current_rbac_user: RBACUser = Depends(get_current_user_with_rbac) # Depends on async get_current_user_with_rbac
    ):
        if not current_rbac_user.has_permission(resource, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User does not have permission to perform '{action}' on '{resource}'.",
            )
        return current_rbac_user 
    return _permission_checker