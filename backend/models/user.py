from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List, Dict, Any 
from datetime import datetime, date # date is still used by frontend for parsing, but backend will store str

class UserAvailability(BaseModel):
    general: Optional[str] = Field(None, description="General availability description (e.g., 'Weekends', 'Mon-Fri evenings').")
    # Store dates as ISO 8601 date strings (YYYY-MM-DD)
    specificDatesUnavailable: Optional[List[str]] = Field(default_factory=list, description="Specific dates (YYYY-MM-DD) the user is unavailable.")
    specificDatesAvailable: Optional[List[str]] = Field(default_factory=list, description="Specific dates (YYYY-MM-DD) the user is available.")

    model_config = ConfigDict(from_attributes=True)

class UserBase(BaseModel):
    email: EmailStr = Field(..., description="User's email address.")
    firstName: Optional[str] = Field(None, min_length=1, max_length=50, description="User's first name.")
    lastName: Optional[str] = Field(None, min_length=1, max_length=50, description="User's last name.")
    phone: Optional[str] = Field(None, description="User's phone number.")
    skills: Optional[List[str]] = Field(default_factory=list, description="List of user's skills.")
    qualifications: Optional[List[str]] = Field(default_factory=list, description="List of user's qualifications.")
    preferences: Optional[Dict[str, Any]] = Field(default_factory=dict, description="User's preferences (e.g., communication preferences).")
    profilePictureUrl: Optional[str] = Field(None, description="URL of the user's profile picture.")
    availability: Optional[UserAvailability] = Field(None, description="User's availability information.")
    # model_config = ConfigDict(arbitrary_types_allowed=True) # If needed for preferences


class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    firstName: Optional[str] = Field(None, min_length=1, max_length=50)
    lastName: Optional[str] = Field(None, min_length=1, max_length=50)
    phone: Optional[str] = None
    skills: Optional[List[str]] = None
    qualifications: Optional[List[str]] = None
    preferences: Optional[Dict[str, Any]] = None 
    profilePictureUrl: Optional[str] = None
    availability: Optional[UserAvailability] = None # This will now expect strings for dates
    
    assignedRoleIds: Optional[List[str]] = None
    status: Optional[str] = None
    
    model_config = ConfigDict(extra='forbid')
    # model_config = ConfigDict(extra='forbid', arbitrary_types_allowed=True) # If needed for preferences


class UserInDBBase(UserBase):
    id: str = Field(..., description="User's unique ID (matches Firebase Auth UID).")
    status: str = Field(default="pending_verification", description="User's account status.")
    assignedRoleIds: List[str] = Field(default_factory=list, description="List of role IDs assigned to the user.")
    createdAt: datetime = Field(..., description="Timestamp of user creation.")
    updatedAt: datetime = Field(..., description="Timestamp of last update.")
    lastLoginAt: Optional[datetime] = Field(None, description="Timestamp of last login.")
    
    model_config = ConfigDict(from_attributes=True)

class UserResponse(UserInDBBase):
    assignedRoleNames: Optional[List[str]] = Field(default_factory=list, description="Names of assigned roles.")
    pass

class UserListResponse(BaseModel): 
    id: str
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    email: EmailStr
    status: str
    assignedRoleIds: Optional[List[str]] = Field(default_factory=list, description="List of role IDs assigned to the user.")
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