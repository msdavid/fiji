from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
import datetime

class UserBase(BaseModel):
    """
    Base model for user data, common fields.
    """
    email: EmailStr = Field(..., description="User's email address.")
    firstName: str = Field(..., min_length=1, max_length=50, description="User's first name.")
    lastName: str = Field(..., min_length=1, max_length=50, description="User's last name.")
    # Optional fields that can be part of a user profile
    phoneNumber: Optional[str] = Field(None, max_length=20, description="User's phone number.")
    # skills, qualifications, availability, preferences can be added later or as separate models/updates

class UserCreateData(BaseModel):
    """
    Data required from the frontend to finalize registration in our backend,
    after Firebase Auth user creation.
    The Firebase ID token (containing UID and email) will be passed via auth dependency.
    """
    firstName: str = Field(..., min_length=1, max_length=50, description="User's first name.")
    lastName: str = Field(..., min_length=1, max_length=50, description="User's last name.")
    invitationToken: str = Field(..., description="The registration invitation token used.")


class UserResponse(UserBase):
    """
    Model for returning user data in API responses.
    """
    uid: str = Field(..., description="Firebase Authentication User ID (Primary Key).")
    assignedRoleIds: List[str] = Field(default_factory=list, description="List of IDs of roles assigned to the user.")
    status: str = Field(..., description="User account status (e.g., 'active', 'invited', 'disabled').")
    createdAt: datetime.datetime = Field(..., description="Timestamp of when the user was created in Firestore.")
    updatedAt: datetime.datetime = Field(..., description="Timestamp of when the user was last updated in Firestore.")
    # Include other fields from UserBase via inheritance

    class Config:
        orm_mode = True # Pydantic V1
        # from_attributes = True # Pydantic V2