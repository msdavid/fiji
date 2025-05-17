from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator, model_validator
from typing import Optional, List, Dict, Any, Literal
from datetime import datetime, date, time # Import time
import re # For regex validation

# Regex for HH:MM time format
TIME_REGEX = r"^([01]\d|2[0-3]):([0-5]\d)$"

class GeneralAvailabilityRule(BaseModel):
    weekday: Literal["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    from_time: str = Field(..., pattern=TIME_REGEX, description="Start time in HH:MM format.")
    to_time: str = Field(..., pattern=TIME_REGEX, description="End time in HH:MM format.")

    @model_validator(mode='after')
    def check_times(cls, values):
        from_time_str, to_time_str = values.from_time, values.to_time
        if from_time_str and to_time_str:
            try:
                t_from = time.fromisoformat(from_time_str)
                t_to = time.fromisoformat(to_time_str)
                if t_to <= t_from:
                    raise ValueError("to_time must be after from_time for general availability rules.")
            except ValueError as e: # Catches time.fromisoformat errors for invalid formats not caught by regex
                raise ValueError(f"Invalid time format: {e}")
        return values
    
    model_config = ConfigDict(from_attributes=True)

class SpecificDateSlot(BaseModel):
    date: date # Pydantic will convert "YYYY-MM-DD" string to date object
    from_time: Optional[str] = Field(None, pattern=TIME_REGEX, description="Start time in HH:MM format (optional).")
    to_time: Optional[str] = Field(None, pattern=TIME_REGEX, description="End time in HH:MM format (optional).")
    slot_type: Literal["available", "unavailable"] = Field(..., description="Whether the slot is for availability or unavailability.")

    @model_validator(mode='after')
    def check_time_consistency(cls, values):
        from_time_str, to_time_str = values.from_time, values.to_time
        if (from_time_str and not to_time_str) or (not from_time_str and to_time_str):
            raise ValueError("Both from_time and to_time must be provided if one is specified for specific date slots.")
        if from_time_str and to_time_str:
            try:
                t_from = time.fromisoformat(from_time_str)
                t_to = time.fromisoformat(to_time_str)
                if t_to <= t_from:
                    raise ValueError("to_time must be after from_time for specific date slots.")
            except ValueError as e:
                raise ValueError(f"Invalid time format: {e}")
        return values

    model_config = ConfigDict(from_attributes=True)

class UserAvailability(BaseModel):
    # general field is removed, replaced by general_rules
    general_rules: List[GeneralAvailabilityRule] = Field(default_factory=list, description="List of general recurring availability rules.")
    # specificDatesUnavailable and specificDatesAvailable are removed, replaced by specific_slots
    specific_slots: List[SpecificDateSlot] = Field(default_factory=list, description="List of specific date slots for availability/unavailability.")

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
    availability: Optional[UserAvailability] = Field(default_factory=UserAvailability, description="User's structured availability information.")
    
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
    availability: Optional[UserAvailability] = None 
    
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