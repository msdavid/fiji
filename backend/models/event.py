from pydantic import BaseModel, Field, ConfigDict
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
    dateTime: datetime.datetime = Field(..., description="Date and time of the event. Frontend sends ISO string, Pydantic converts.")
    durationMinutes: Optional[int] = Field(None, gt=0, description="Duration of the event in minutes.")
    location: Optional[str] = Field(None, max_length=255, description="Location of the event.")
    volunteersRequired: Optional[int] = Field(None, ge=0, description="Number of volunteers required for the event.")
    status: str = Field(
        default="draft", 
        description="Status of the event (e.g., 'draft', 'open_for_signup', 'ongoing', 'completed', 'cancelled')."
    )
    organizerUserId: Optional[str] = Field(None, description="UID of the user designated as the event organizer.")
    # createdByUserId will be set automatically based on the authenticated user creating the event.

class EventCreate(EventBase):
    """
    Model for creating a new event.
    The frontend will send dateTime as a string from datetime-local input.
    Pydantic will parse it into a datetime.datetime object.
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
    durationMinutes: Optional[int] = Field(None, gt=0)
    location: Optional[str] = Field(None, max_length=255)
    volunteersRequired: Optional[int] = Field(None, ge=0)
    status: Optional[str] = None # Consider specific validation for status transitions
    organizerUserId: Optional[str] = Field(None, description="UID of the user designated as the event organizer. Can be set to null to remove organizer.")

    model_config = ConfigDict(extra='forbid')

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
    creatorFirstName: Optional[str] = Field(None, description="First name of the user who created the event.")
    creatorLastName: Optional[str] = Field(None, description="Last name of the user who created the event.")
    
    # Potentially add calculated fields like 'volunteersSignedUp' or 'spotsAvailable' in the future
    # volunteersSignedUp: Optional[int] = Field(None, description="Number of volunteers currently signed up.")

    model_config = ConfigDict(from_attributes=True)

class EventWithSignupStatus(EventResponse):
    """
    Event response model that includes information about the current user's signup status for this event.
    """
    isCurrentUserSignedUp: Optional[bool] = Field(None, description="True if the current authenticated user is signed up for this event, False otherwise. Null if user not authenticated or not applicable.")
    currentUserAssignmentStatus: Optional[str] = Field(None, description="Status of the current user's assignment (e.g., 'confirmed', 'waitlisted') if signed up.")