from pydantic import BaseModel, Field, ConfigDict, model_validator
from typing import Optional, List
import datetime

class EventBase(BaseModel):
    """
    Base model for event data.
    """
    eventName: str = Field(..., min_length=3, max_length=100, description="Name of the event.")
    eventType: Optional[str] = Field(None, max_length=50, description="Type or category of the event (e.g., 'Fundraiser', 'Workshop').")
    purpose: Optional[str] = Field(None, max_length=500, description="Purpose or brief description of the event.")
    description: Optional[str] = Field(None, description="Detailed description of the event.")
    dateTime: datetime.datetime = Field(..., description="Start date and time of the event. Frontend sends ISO string, Pydantic converts.")
    endTime: datetime.datetime = Field(..., description="End date and time of the event. Frontend sends ISO string, Pydantic converts.")
    location: Optional[str] = Field(None, max_length=255, description="Location of the event.") # Renamed from venue in SRS for consistency with existing code
    volunteersRequired: Optional[int] = Field(None, ge=0, description="Number of volunteers required for the event.")
    status: str = Field(
        default="draft", 
        description="Status of the event (e.g., 'draft', 'open_for_signup', 'ongoing', 'completed', 'cancelled')."
    )
    organizerUserId: Optional[str] = Field(None, description="UID of the user designated as the event organizer.")
    # createdByUserId will be set automatically based on the authenticated user creating the event.

    @model_validator(mode='after')
    def check_end_time_after_start_time(cls, values):
        start_time, end_time = values.dateTime, values.endTime
        if start_time and end_time and end_time <= start_time:
            raise ValueError("End time must be after start time.")
        return values

class EventCreate(EventBase):
    """
    Model for creating a new event.
    The frontend will send dateTime and endTime as strings from datetime-local input.
    Pydantic will parse them into datetime.datetime objects.
    """
    pass

class EventUpdate(BaseModel):
    """
    Model for updating an existing event. All fields are optional.
    """
    eventName: Optional[str] = Field(None, min_length=3, max_length=100)
    eventType: Optional[str] = Field(None, max_length=50)
    purpose: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = Field(None)
    dateTime: Optional[datetime.datetime] = None
    endTime: Optional[datetime.datetime] = None
    location: Optional[str] = Field(None, max_length=255) # Renamed from venue
    volunteersRequired: Optional[int] = Field(None, ge=0)
    status: Optional[str] = None # Consider specific validation for status transitions
    organizerUserId: Optional[str] = Field(None, description="UID of the user designated as the event organizer. Can be set to null to remove organizer.")

    model_config = ConfigDict(extra='forbid')

    @model_validator(mode='after')
    def check_end_time_after_start_time_update(cls, values):
        # This validator needs to handle partial updates carefully.
        # If only one of dateTime or endTime is provided, we can't validate against the other
        # unless we fetch the existing record. For simplicity in Pydantic model,
        # this validation might be better handled at the router level for updates
        # where the existing record's values are known.
        # However, if both are provided in an update, we should validate.
        start_time, end_time = values.dateTime, values.endTime
        if start_time and end_time and end_time <= start_time:
            raise ValueError("End time must be after start time.")
        # If only one is provided, we assume the router will handle validation against the stored value.
        return values

class EventInDBBase(EventBase):
    """
    Base model for event data including server-set fields, as stored in the database.
    """
    createdByUserId: str = Field(..., description="UID of the user who created the event.")
    createdAt: datetime.datetime = Field(..., description="Timestamp of when the event was created.")
    updatedAt: datetime.datetime = Field(..., description="Timestamp of when the event was last updated.")

class EventInDB(EventInDBBase):
    """
    Model representing a complete event document in Firestore, including its ID.
    This model is typically used internally in the backend.
    """
    eventId: str = Field(..., description="Unique ID of the event (Firestore document ID).")
    model_config = ConfigDict(from_attributes=True)


class EventResponse(EventInDBBase): # Inherits common fields from EventInDBBase
    """
    Model for returning event data in API responses. Includes the eventId.
    """
    eventId: str = Field(..., description="Unique ID of the event (Firestore document ID).")
    organizerFirstName: Optional[str] = Field(None, description="First name of the event organizer.")
    organizerLastName: Optional[str] = Field(None, description="Last name of the event organizer.")
    organizerEmail: Optional[str] = Field(None, description="Email of the event organizer.")
    creatorFirstName: Optional[str] = Field(None, description="First name of the user who created the event.")
    creatorLastName: Optional[str] = Field(None, description="Last name of the user who created the event.")
    
    model_config = ConfigDict(from_attributes=True)

class EventWithSignupStatus(EventResponse):
    """
    Event response model that includes information about the current user's signup status for this event.
    """
    isCurrentUserSignedUp: Optional[bool] = Field(None, description="True if the current authenticated user is signed up for this event, False otherwise. Null if user not authenticated or not applicable.")
    currentUserAssignmentStatus: Optional[str] = Field(None, description="Status of the current user's assignment (e.g., 'confirmed', 'waitlisted') if signed up.")