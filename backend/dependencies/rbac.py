from fastapi import Depends, HTTPException, status
from typing import List, Dict, Any, Set, Optional # Added Optional

# Use direct imports from subdirectories of 'backend'
from dependencies.auth import get_firebase_user # Provides Firebase decoded token
from dependencies.database import get_db # Provides Firestore client instance

# Consider adding caching for role documents in the future if performance becomes an issue
# from cachetools import TTLCache, cached
# from cachetools.keys import hashkey
# role_cache = TTLCache(maxsize=50, ttl=300) # Example: cache 50 roles for 5 minutes

# @cached(cache=role_cache, key=lambda db, role_name: hashkey(role_name))
# def get_role_data_from_firestore(db: Any, role_name: str) -> Dict:
#     """Helper function to fetch (and cache) role data."""
#     role_doc_ref = db.collection("roles").document(role_name)
#     role_doc = role_doc_ref.get()
#     if role_doc.exists:
#         return role_doc.to_dict()
#     # Log or handle non-existent role that a user might be assigned to
#     print(f"Warning: Role '{role_name}' not found in Firestore.")
#     return {}

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

def get_current_user_with_rbac(
    db: Any = Depends(get_db),
    firebase_user: dict = Depends(get_firebase_user) # Expects dict with 'uid', 'email'
) -> RBACUser:
    """
    FastAPI dependency to get the current authenticated user along with their
    RBAC roles and consolidated privileges.
    Can be used as an optional dependency if a route can be accessed by unauthenticated users.
    """
    if not firebase_user: # Handles cases where get_firebase_user might return None (e.g. optional auth)
        # For optional authentication, we might return a default "guest" RBACUser
        # or raise an error if authentication is strictly required by this point.
        # For now, assuming get_firebase_user raises its own 401 if token is invalid/missing.
        # If get_firebase_user is truly optional and returns None, this indicates no user.
        # Depending on policy, this could be an anonymous user or an error.
        # Let's assume for RBAC, a user must be identified.
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
    user_doc = user_doc_ref.get()

    if not user_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User profile not found in Firestore. Access denied.",
        )
    
    user_data = user_doc.to_dict()
    assigned_role_names: List[str] = user_data.get("assignedRoleIds", [])
    if assigned_role_names is None: 
        assigned_role_names = []
    
    is_sysadmin = "sysadmin" in assigned_role_names
    consolidated_privileges: Dict[str, Set[str]] = {}

    if not is_sysadmin and assigned_role_names:
        for role_name in assigned_role_names:
            role_doc_ref = db.collection("roles").document(role_name)
            role_doc = role_doc_ref.get()
            
            if role_doc.exists:
                role_data = role_doc.to_dict()
                privileges_for_role = role_data.get("privileges", {})
                for resource, actions in privileges_for_role.items():
                    if not isinstance(actions, list):
                        print(f"Warning: Malformed actions for resource '{resource}' in role '{role_name}'. Expected list, got {type(actions)}.")
                        continue
                    if resource not in consolidated_privileges:
                        consolidated_privileges[resource] = set()
                    consolidated_privileges[resource].update(actions)
            else:
                print(f"Warning: User '{uid}' is assigned non-existent role '{role_name}'.")
    
    return RBACUser(
        uid=uid,
        email=email,
        roles=assigned_role_names,
        privileges=consolidated_privileges,
        is_sysadmin=is_sysadmin
    )

def require_permission(resource: str, action: str):
    """
    Dependency factory that creates a dependency to check if the current user
    has the required permission for a given resource and action.
    """
    def _permission_checker(
        current_rbac_user: RBACUser = Depends(get_current_user_with_rbac)
    ):
        if not current_rbac_user.has_permission(resource, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User does not have permission to perform '{action}' on '{resource}'.",
            )
        return current_rbac_user 
    return _permission_checker