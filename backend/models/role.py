from pydantic import BaseModel, Field
from typing import List, Dict, Optional
import datetime

class RoleBase(BaseModel):
    """
    Base model for role data.
    """
    roleName: str = Field(..., min_length=3, max_length=50, description="Display name of the role.")
    description: Optional[str] = Field(None, max_length=255, description="Description of the role.")
    # Privileges: A map where keys are resource names (e.g., "events", "users")
    # and values are lists of allowed actions (e.g., ["create", "view", "edit"]).
    privileges: Dict[str, List[str]] = Field(default_factory=dict, description="Permissions granted by this role.")

class RoleCreate(RoleBase):
    """
    Model for creating a new role.
    `isSystemRole` will be False by default for API-created roles.
    """
    pass

class RoleUpdate(BaseModel):
    """
    Model for updating an existing role. All fields are optional for partial updates.
    """
    roleName: Optional[str] = Field(None, min_length=3, max_length=50)
    description: Optional[str] = Field(None, max_length=255)
    privileges: Optional[Dict[str, List[str]]] = None
    # isSystemRole typically should not be updated via API for safety, managed internally or by sysadmin script.

class RoleResponse(RoleBase):
    """
    Model for returning role data in API responses.
    Includes fields that are auto-generated or managed by the system.
    """
    roleId: str = Field(..., description="Unique ID of the role (Firestore document ID).")
    isSystemRole: bool = Field(default=False, description="Indicates if the role is a system-defined role.")
    createdAt: datetime.datetime = Field(..., description="Timestamp of when the role was created.")
    updatedAt: datetime.datetime = Field(..., description="Timestamp of when the role was last updated.")

    class Config:
        # Pydantic V2: use `model_config` instead of `Config`
        # For Pydantic V1 compatibility:
        orm_mode = True # Allows Pydantic to work with ORM objects (like Firestore document snapshots)
        # For Pydantic V2:
        # from_attributes = True 