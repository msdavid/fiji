from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime

class UserBase(BaseModel):
    email: EmailStr = Field(..., description="User's email address.")
    firstName: Optional[str] = Field(None, min_length=1, max_length=50, description="User's first name.")
    lastName: Optional[str] = Field(None, min_length=1, max_length=50, description="User's last name.")
    phone: Optional[str] = Field(None, description="User's phone number.")
    skills: Optional[List[str]] = Field(default_factory=list, description="List of user's skills.")
    qualifications: Optional[List[str]] = Field(default_factory=list, description="List of user's qualifications.")
    preferences: Optional[dict] = Field(default_factory=dict, description="User's preferences (e.g., communication, availability).")
    profilePictureUrl: Optional[str] = Field(None, description="URL of the user's profile picture.")
    # Availability fields to be added in Sprint 5
    # availability_general: Optional[str] = Field(None, description="General availability description.")
    # availability_specific_dates_unavailable: Optional[List[datetime]] = Field(default_factory=list)
    # availability_specific_dates_available: Optional[List[datetime]] = Field(default_factory=list)


class UserCreate(UserBase):
    # For initial creation, typically during registration after invitation.
    # UID will be the Firebase Auth UID.
    # assignedRoleIds and status will be set by the system based on invitation/defaults.
    pass

class UserUpdate(BaseModel):
    # User can update these fields on their own profile
    firstName: Optional[str] = Field(None, min_length=1, max_length=50)
    lastName: Optional[str] = Field(None, min_length=1, max_length=50)
    phone: Optional[str] = None
    skills: Optional[List[str]] = None
    qualifications: Optional[List[str]] = None
    preferences: Optional[dict] = None
    profilePictureUrl: Optional[str] = None
    
    # Admin can update these fields as well
    assignedRoleIds: Optional[List[str]] = None
    status: Optional[str] = None # e.g., "active", "disabled", "pending_verification"
    # Email is typically not updated directly via this model, managed by Firebase Auth.
    # availability fields to be added in Sprint 5
    model_config = ConfigDict(extra='forbid')


class UserInDBBase(UserBase):
    id: str = Field(..., description="User's unique ID (matches Firebase Auth UID).")
    status: str = Field(default="pending_verification", description="User's account status.")
    assignedRoleIds: List[str] = Field(default_factory=list, description="List of role IDs assigned to the user.")
    createdAt: datetime = Field(..., description="Timestamp of user creation.")
    updatedAt: datetime = Field(..., description="Timestamp of last update.")
    lastLoginAt: Optional[datetime] = Field(None, description="Timestamp of last login.")
    model_config = ConfigDict(from_attributes=True)

class UserResponse(UserInDBBase):
    # Include human-readable role names
    assignedRoleNames: Optional[List[str]] = Field(default_factory=list, description="Names of assigned roles.")
    # from_attributes is inherited from UserInDBBase
    pass

class UserListResponse(BaseModel): # For list views, might be a subset of UserResponse
    id: str
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    email: EmailStr
    status: str
    assignedRoleIds: Optional[List[str]] = Field(default_factory=list, description="List of role IDs assigned to the user.") # Added this field
    assignedRoleNames: Optional[List[str]] = Field(default_factory=list, description="Names of assigned roles.")
    createdAt: datetime
    profilePictureUrl: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class UserSearchResponseItem(BaseModel):
    id: str
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    email: EmailStr
    model_config = ConfigDict(from_attributes=True)