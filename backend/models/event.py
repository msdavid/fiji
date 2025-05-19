from pydantic import BaseModel, Field, validator, HttpUrl
from typing import Optional, List, Any
import datetime

# Helper to convert datetime to string or keep as string
def _to_iso_format_if_datetime(dt: Any) -> Optional[str]:
    if isinstance(dt, datetime.datetime):
        return dt.isoformat()
    return dt

class EventBase(BaseModel):
    eventName: str = Field(..., min_length=3, max_length=100, description="Name of the event")
    eventType: Optional[str] = Field(None, max_length=50, description="Type or category of the event")
    description: Optional[str] = Field(None, max_length=1000, description="Detailed description of the event")
    dateTime: datetime.datetime = Field(..., description="Start date and time of the event (or first occurrence if recurring)")
    endTime: datetime.datetime = Field(..., description="End date and time of the event (or first occurrence if recurring)")
    venue: Optional[str] = Field(None, max_length=200, description="Location or venue of the event")
    volunteersRequired: Optional[int] = Field(None, ge=0, description="Number of volunteers required")
    status: str = Field("draft", description="Status of the event (e.g., draft, open_for_signup, ongoing, completed, cancelled)")
    organizerUserId: Optional[str] = Field(None, description="User ID of the event organizer")
    icon: Optional[str] = Field(None, max_length=50, description="Icon for the event (e.g., material icon name)")
    workingGroupIds: List[str] = Field(..., description="List of Working Group IDs associated with this event. Cannot be empty.")
    recurrence_rule: Optional[str] = Field(None, max_length=255, description="Recurrence rule (e.g., RRULE string) for the event")

    @validator('endTime')
    def end_time_must_be_after_start_time(cls, v, values):
        if 'dateTime' in values and v <= values['dateTime']:
            raise ValueError('End time must be after start time')
        return v

    @validator('workingGroupIds')
    def working_group_ids_must_not_be_empty(cls, v):
        if not v:
            raise ValueError('workingGroupIds list cannot be empty')
        return v

    class Config:
        json_encoders = {
            datetime.datetime: lambda dt: dt.isoformat()
        }
        use_enum_values = True
        populate_by_name = True
        from_attributes = True # Allows Pydantic to create models from ORM objects


class EventCreate(EventBase):
    pass

class EventUpdate(BaseModel):
    eventName: Optional[str] = Field(None, min_length=3, max_length=100)
    eventType: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=1000)
    dateTime: Optional[datetime.datetime] = None
    endTime: Optional[datetime.datetime] = None
    venue: Optional[str] = Field(None, max_length=200)
    volunteersRequired: Optional[int] = Field(None, ge=0)
    status: Optional[str] = None
    organizerUserId: Optional[str] = Field(None) # Allow setting to None
    icon: Optional[str] = Field(None, max_length=50)
    workingGroupIds: Optional[List[str]] = Field(None, description="List of Working Group IDs. If provided, cannot be empty.")
    recurrence_rule: Optional[str] = Field(None, max_length=255, description="Recurrence rule (e.g., RRULE string) for the event. Can be set to null to remove recurrence.")


    @validator('endTime', always=True) # always=True ensures this runs even if endTime is None but dateTime is present
    def end_time_must_be_after_start_time_if_both_present(cls, v, values):
        # This validator now needs to handle cases where one or both might be None during an update.
        # The core logic of "if both are present, endTime > dateTime" is what matters.
        # If only one is being updated, the existing value for the other will be used for comparison in the router.
        # If both are provided in the update payload:
        if v is not None and values.get('dateTime') is not None:
            if v <= values['dateTime']:
                raise ValueError('End time must be after start time')
        # If only endTime is provided, and dateTime exists (not in values but in the original model),
        # this validation should ideally happen at the router level where the full model state is known.
        # For Pydantic model validation, we can only validate based on the fields present in the *update* payload.
        return v

    @validator('workingGroupIds')
    def working_group_ids_must_not_be_empty_if_provided(cls, v):
        if v is not None and not v: # If it's an empty list
            raise ValueError('workingGroupIds, if provided, cannot be empty')
        return v

    class Config:
        json_encoders = {
            datetime.datetime: lambda dt: dt.isoformat()
        }
        use_enum_values = True
        populate_by_name = True
        from_attributes = True


class EventResponse(EventBase):
    id: str = Field(..., description="Unique ID of the event")
    createdByUserId: Optional[str] = Field(None, description="User ID of the event creator")
    creatorFirstName: Optional[str] = Field(None, description="First name of the event creator")
    creatorLastName: Optional[str] = Field(None, description="Last name of the event creator")
    organizerFirstName: Optional[str] = Field(None, description="First name of the event organizer")
    organizerLastName: Optional[str] = Field(None, description="Last name of the event organizer")
    organizerEmail: Optional[str] = Field(None, description="Email of the event organizer")
    workingGroupNames: Optional[List[str]] = Field(None, description="Names of the associated working groups")
    createdAt: Optional[datetime.datetime] = Field(None, description="Timestamp of event creation")
    updatedAt: Optional[datetime.datetime] = Field(None, description="Timestamp of last event update")

    # Ensure datetime fields are serialized to ISO format strings
    _serialize_datetime = validator('dateTime', 'endTime', 'createdAt', 'updatedAt', pre=True, allow_reuse=True)(_to_iso_format_if_datetime)


class EventWithSignupStatus(EventResponse):
    isCurrentUserSignedUp: Optional[bool] = Field(None, description="Indicates if the current user is signed up for this event instance")
    currentUserAssignmentStatus: Optional[str] = Field(None, description="Status of the current user's assignment (e.g., confirmed, waitlisted)")
    # For recurring events, dateTime and endTime on this model will represent a specific instance
    # The parent EventResponse might hold the "template" or first occurrence details.
    # The recurrence_rule will be on the parent EventResponse.

    # If this model represents an instance of a recurring event,
    # its dateTime and endTime are specific to that instance.
    # The recurrence_rule would typically be on the master event, not necessarily repeated here unless for context.