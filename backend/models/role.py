from pydantic import BaseModel, Field, ConfigDict, field_validator
from typing import List, Dict, Optional
import datetime

class RoleBase(BaseModel):
    """
    Base model for role data. roleName serves as the document ID.
    """
    roleName: str = Field(
        ..., 
        min_length=3, 
        max_length=50, 
        description="Unique name of the role, used as its ID. Must be unique and suitable for a Firestore document ID.",
        pattern=r"^[a-zA-Z0-9_-]+$" # Allows alphanumeric, underscore, hyphen
    )
    description: Optional[str] = Field(None, max_length=255, description="Description of the role.")
    privileges: Dict[str, List[str]] = Field(default_factory=dict, description="Permissions granted by this role.")

    @field_validator('roleName')
    @classmethod
    def validate_rolename_constraints(cls, v: str) -> str:
        if '/' in v:
            raise ValueError("Role name cannot contain slashes ('/')")
        if v == "." or v == "..":
            raise ValueError("Role name cannot be '.' or '..'")
        # Max length 50 and pattern are already good for Firestore ID constraints.
        return v

class RoleCreate(RoleBase):
    """
    Model for creating a new role. 'roleName' will be used as the document ID.
    """
    pass

class RoleUpdate(BaseModel):
    """
    Model for updating an existing role. 'roleName' (the ID) cannot be updated here.
    """
    description: Optional[str] = Field(None, max_length=255, description="New description for the role.")
    privileges: Optional[Dict[str, List[str]]] = Field(None, description="New set of privileges for the role.")
    # isSystemRole is managed internally and not updatable via this model.

    model_config = ConfigDict(extra='forbid') # Prevent arbitrary fields

class RoleResponse(RoleBase): # Inherits roleName, description, privileges from RoleBase
    """
    Model for returning role data in API responses.
    'roleName' (inherited) is the document ID. 'id' is included for explicit ID representation.
    """
    id: str = Field(..., description="Unique ID of the role (this will be the same as roleName).")
    isSystemRole: bool = Field(default=False, description="Indicates if the role is a system-defined role.")
    createdAt: datetime.datetime = Field(..., description="Timestamp of when the role was created.")
    updatedAt: datetime.datetime = Field(..., description="Timestamp of when the role was last updated.")

    model_config = ConfigDict(from_attributes=True)

    # If roleName is the document ID from Firestore and you want it to populate 'id'
    # and also be available as 'roleName', Pydantic v2 handles this well if the input data
    # for RoleResponse has 'roleName' and you want 'id' to be an alias or copy.
    # If the input data (e.g., Firestore document snapshot) has '.id' for the document ID
    # and also 'roleName' in its fields, then 'id' would map from '.id' and 'roleName' from its field.
    # Given the current structure, 'roleName' is the ID.
    # We need to ensure 'id' gets populated correctly from 'roleName' in the router if not automatic.
    # Pydantic's from_attributes=True will try to map fields. If the input object has 'roleName',
    # and RoleResponse has 'id', we might need a resolver or ensure the input dict has 'id' populated.
    # For now, let's assume the router logic will handle populating 'id' with the document's ID (roleName).