from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional, Dict # List will no longer be used for skills/qualifications here
import datetime

class UserBase(BaseModel):
    """
    Base model for user data, common fields.
    """
    email: EmailStr = Field(..., description="User's email address.")
    firstName: str = Field(..., min_length=1, max_length=50, description="User's first name.")
    lastName: str = Field(..., min_length=1, max_length=50, description="User's last name.")
    phoneNumber: Optional[str] = Field(None, max_length=20, description="User's phone number.")
    skills: Optional[str] = Field(None, description="User's skills, as a single text block.") # Changed from List[str]
    qualifications: Optional[str] = Field(None, description="User's qualifications, as a single text block.") # Changed from List[str]
    preferences: Optional[str] = Field(None, description="User's preferences or notes.")
    profilePictureUrl: Optional[str] = Field(None, description="URL of the user's profile picture.")


class UserCreateData(BaseModel):
    """
    Data required from the frontend to finalize registration in our backend,
    after Firebase Auth user creation.
    """
    firstName: str = Field(..., min_length=1, max_length=50, description="User's first name.")
    lastName: str = Field(..., min_length=1, max_length=50, description="User's last name.")
    invitationToken: str = Field(..., description="The registration invitation token used.")


class UserResponse(UserBase):
    """
    Model for returning user data in API responses.
    """
    uid: str = Field(..., description="Firebase Authentication User ID (Primary Key).")
    assignedRoleIds: List[str] = Field(default_factory=list, description="List of IDs of roles assigned to the user.") # This remains List[str]
    status: str = Field(..., description="User account status (e.g., 'active', 'invited', 'disabled').")
    createdAt: datetime.datetime = Field(..., description="Timestamp of when the user was created in Firestore.")
    updatedAt: datetime.datetime = Field(..., description="Timestamp of when the user was last updated in Firestore.")
    
    model_config = ConfigDict(from_attributes=True)

class UserUpdate(BaseModel):
    """
    Model for updating user profile information.
    All fields are optional.
    """
    firstName: Optional[str] = Field(None, min_length=1, max_length=50, description="User's first name.")
    lastName: Optional[str] = Field(None, min_length=1, max_length=50, description="User's last name.")
    phoneNumber: Optional[str] = Field(None, max_length=20, description="User's phone number. Pass null to clear.")
    skills: Optional[str] = Field(None, description="User's skills, as a single text block. Send an empty string to clear.") # Changed from List[str]
    qualifications: Optional[str] = Field(None, description="User's qualifications, as a single text block. Send an empty string to clear.") # Changed from List[str]
    preferences: Optional[str] = Field(None, description="User's preferences or notes. Send an empty string to clear.")
    profilePictureUrl: Optional[str] = Field(None, description="URL of the user's profile picture. Send an empty string to clear.")
    
    model_config = ConfigDict(extra='forbid')

class UserRolesUpdate(BaseModel):
    """
    Model for updating a user's assigned roles.
    """
    assignedRoleIds: List[str] = Field(..., description="A list of role names (document IDs from 'roles' collection) to assign to the user. This will replace all existing roles.")

    model_config = ConfigDict(extra='forbid')

class UserSearchResult(BaseModel):
    """
    Model for returning user data in search results.
    """
    uid: str = Field(..., description="Firebase Authentication User ID.")
    firstName: str = Field(..., description="User's first name.")
    lastName: str = Field(..., description="User's last name.")
    email: EmailStr = Field(..., description="User's email address.")

    model_config = ConfigDict(from_attributes=True)