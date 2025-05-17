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
    venue: Optional[str] = Field(None, max_length=255, description="Venue or physical address of the event.") # Changed from location to venue
    volunteersRequired: Optional[int] = Field(None, ge=0, description="Number of volunteers required for the event.")
    status: str = Field(
        default="draft", 
        description="Status of the event (e.g., 'draft', 'open_for_signup', 'ongoing', 'completed', 'cancelled')."
    )
    organizerUserId: Optional[str] = Field(None, description="UID of the user designated as the event organizer.")
    icon: Optional[str] = Field(None, max_length=50, description="Name of the Material Icon for the event.")
    point_of_contact: Optional[str] = Field(None, max_length=255, description="Point of contact for the event (e.g., name, email, or phone).")

    @model_validator(mode='after')
    def check_end_time_after_start_time(cls, values):
        # Ensure dateTime and endTime are present before accessing them
        start_time = values.dateTime
        end_time = values.endTime
        if start_time and end_time and end_time <= start_time:
            raise ValueError("End time must be after start time.")
        return values

class EventCreate(EventBase):
    """
    Model for creating a new event.
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
    venue: Optional[str] = Field(None, max_length=255) # Changed from location to venue
    volunteersRequired: Optional[int] = Field(None, ge=0)
    status: Optional[str] = None 
    organizerUserId: Optional[str] = Field(None, description="UID of the user designated as the event organizer. Can be set to null to remove organizer.")
    icon: Optional[str] = Field(None, max_length=50)
    point_of_contact: Optional[str] = Field(None, max_length=255)

    model_config = ConfigDict(extra='forbid')

    @model_validator(mode='after')
    def check_end_time_after_start_time_update(cls, values):
        start_time, end_time = values.dateTime, values.endTime
        # This validator only runs if both are provided in the update payload.
        # If one is None (not provided in update), this check won't trigger an error here.
        # The router should handle validation against existing stored values if only one is updated.
        if start_time and end_time and end_time <= start_time:
            raise ValueError("End time must be after start time.")
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
    id: str = Field(..., description="Unique ID of the event (Firestore document ID).") # Changed from eventId to id
    model_config = ConfigDict(from_attributes=True)


class EventResponse(EventInDBBase): 
    """
    Model for returning event data in API responses. Includes the event ID.
    """
    id: str = Field(..., description="Unique ID of the event (Firestore document ID).") # Changed from eventId to id
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