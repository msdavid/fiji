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

async def get_current_user_with_rbac( 
    db: firestore.AsyncClient = Depends(get_db), 
    firebase_user: dict = Depends(get_firebase_user)
) -> RBACUser:
    """
    FastAPI dependency to get the current authenticated user along with their
    RBAC roles, consolidated privileges, and basic profile info (name).
    """
    if not firebase_user:
        # This case should ideally not be reached if get_firebase_user raises appropriately
        # or if routes are protected by an auth dependency that ensures firebase_user exists.
        # However, as a safeguard:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required for RBAC context.",
        )

    uid = firebase_user.get("uid")
    email = firebase_user.get("email")

    if not uid:
        # This should also ideally be caught by get_firebase_user or an earlier auth step.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials: UID missing from token.",
        )

    user_doc_ref = db.collection("users").document(uid)
    user_doc = await user_doc_ref.get() 

    if not user_doc.exists: 
        # Consider if this should be a 401 or 403. 
        # 403 implies authenticated but not authorized.
        # If user exists in Firebase Auth but not Firestore, it's an application-level issue.
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, # Or 404 if user profile is considered a resource not found
            detail="User profile not found in application database. Access denied.",
        )
    
    user_data = user_doc.to_dict()
    assigned_role_ids: List[str] = user_data.get("assignedRoleIds", []) 
    if assigned_role_ids is None: # Handle cases where field might be explicitly null
        assigned_role_ids = [] 
    
    first_name: Optional[str] = user_data.get("firstName") 
    last_name: Optional[str] = user_data.get("lastName")   
    
    # Determine if sysadmin based on role ID 'sysadmin'
    # This assumes 'sysadmin' is a role ID stored in assignedRoleIds for sysadmins.
    # If is_sysadmin is a direct boolean field on the user document, adjust accordingly.
    is_sysadmin = "sysadmin" in assigned_role_ids 
    
    consolidated_privileges: Dict[str, Set[str]] = {}

    if not is_sysadmin:
        # Fetch role-based privileges
        if assigned_role_ids:
            for role_id in assigned_role_ids:
                role_doc = await db.collection("roles").document(role_id).get()
                if role_doc.exists:
                    role_data = role_doc.to_dict()
                    privileges_for_role = role_data.get("privileges", {})
                    for resource, actions in privileges_for_role.items():
                        if not isinstance(actions, list): 
                            print(f"Warning: Malformed actions for resource '{resource}' in role '{role_doc.id}'. Expected list, got {type(actions)}.")
                            continue
                        if resource not in consolidated_privileges:
                            consolidated_privileges[resource] = set()
                        consolidated_privileges[resource].update(actions)
        
        # Check for working group memberships and auto-grant permissions
        try:
            assignments_query = db.collection("assignments").where("userId", "==", uid).where("assignableType", "==", "workingGroup").where("status", "==", "active")
            assignments_docs = assignments_query.stream()
            
            has_working_group_assignment = False
            async for assignment_doc in assignments_docs:
                has_working_group_assignment = True
                break  # We just need to know if there's at least one
            
            if has_working_group_assignment:
                # Auto-grant working group view permissions for working group members
                if "working_groups" not in consolidated_privileges:
                    consolidated_privileges["working_groups"] = set()
                consolidated_privileges["working_groups"].add("view")
                
                # Also grant assignments view_own permission to see their own assignments
                if "assignments" not in consolidated_privileges:
                    consolidated_privileges["assignments"] = set()
                consolidated_privileges["assignments"].add("view_own")
        except Exception as e:
            print(f"Warning: Failed to check working group assignments for user {uid}: {e}")
            # Continue without working group permissions if check fails
    
    return RBACUser(
        uid=uid,
        email=email,
        roles=assigned_role_ids, 
        privileges=consolidated_privileges,
        is_sysadmin=is_sysadmin,
        first_name=first_name, 
        last_name=last_name    
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

async def is_sysadmin_check(
    current_rbac_user: Optional[RBACUser] = Depends(get_current_user_with_rbac),
    # db: firestore.AsyncClient = Depends(get_db) # db might not be needed if RBACUser is comprehensive
) -> bool:
    """
    Checks if the current RBAC user is a sysadmin.
    This function is intended to be used as a dependency or called directly
    where an RBACUser object is already available.
    """
    if not current_rbac_user:
        # This can happen if the dependency is optional and no user is authenticated
        return False
    return current_rbac_user.is_sysadmin