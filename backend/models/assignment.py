from pydantic import BaseModel, Field, validator
from typing import Optional, Any
import datetime

# Helper to convert datetime to string or keep as string
def _to_iso_format_if_datetime(dt: Any) -> Optional[str]:
    if isinstance(dt, datetime.datetime):
        return dt.isoformat()
    return dt

class AssignmentBase(BaseModel):
    userId: str = Field(..., description="ID of the user being assigned")
    assignableId: str = Field(..., description="ID of the entity being assigned to (e.g., event ID, working group ID)")
    assignableType: str = Field(..., description="Type of the entity (e.g., 'event', 'working_group')")
    status: Optional[str] = Field("pending", description="Status of the assignment (e.g., pending, confirmed, rejected, waitlisted)")
    role: Optional[str] = Field(None, description="Role of the user in this assignment (e.g., volunteer, lead)")
    notes: Optional[str] = Field(None, max_length=500, description="Additional notes for the assignment")
    
    # Fields for specific event instances if assignableType is 'event'
    event_instance_start_date_time: Optional[datetime.datetime] = Field(None, description="Specific start datetime of the event instance for this assignment")
    event_instance_end_date_time: Optional[datetime.datetime] = Field(None, description="Specific end datetime of the event instance for this assignment")

    @validator('event_instance_end_date_time')
    def instance_end_time_must_be_after_instance_start_time(cls, v, values):
        if 'event_instance_start_date_time' in values and values['event_instance_start_date_time'] is not None and v is not None:
            if v <= values['event_instance_start_date_time']:
                raise ValueError('Event instance end time must be after event instance start time')
        return v

    class Config:
        json_encoders = {
            datetime.datetime: lambda dt: dt.isoformat()
        }
        populate_by_name = True
        from_attributes = True


class AssignmentCreate(AssignmentBase):
    # For creating an assignment, if it's for an event, instance times might be crucial
    # If assignableType is 'event', these should ideally be provided.
    # Making them optional for now, but router logic will enforce if event is recurring.
    assignedByUserId: Optional[str] = Field(None, description="ID of the user who made the assignment (system, self, or admin)")
    assignmentDate: Optional[datetime.datetime] = Field(default_factory=datetime.datetime.now, description="Date of the assignment")


class AssignmentUpdate(BaseModel):
    status: Optional[str] = None
    role: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=500)
    # Generally, we wouldn't update the instance times of an existing assignment directly.
    # If an instance changes, it might mean deleting and recreating the assignment.
    # However, including them as optional allows for flexibility if needed.
    event_instance_start_date_time: Optional[datetime.datetime] = Field(None, description="Specific start datetime of the event instance")
    event_instance_end_date_time: Optional[datetime.datetime] = Field(None, description="Specific end datetime of the event instance")

    @validator('event_instance_end_date_time', always=True)
    def instance_end_time_must_be_after_instance_start_time_update(cls, v, values):
        # This validator handles updates where one or both might be None.
        start_time = values.get('event_instance_start_date_time')
        # If both are provided in the update payload:
        if v is not None and start_time is not None:
            if v <= start_time:
                raise ValueError('Event instance end time must be after event instance start time')
        # If only one is provided, this validation relies on the other value being present or not.
        # More robust validation considering the existing record's values would be in the router.
        return v
        
    class Config:
        json_encoders = {
            datetime.datetime: lambda dt: dt.isoformat()
        }
        populate_by_name = True
        from_attributes = True


class AssignmentResponse(AssignmentBase):
    id: str = Field(..., description="Unique ID of the assignment")
    assignedByUserId: Optional[str] = Field(None, description="ID of the user who made the assignment")
    assignmentDate: Optional[datetime.datetime] = Field(None, description="Timestamp of when the assignment was made")
    createdAt: Optional[datetime.datetime] = Field(None, description="Timestamp of assignment creation")
    updatedAt: Optional[datetime.datetime] = Field(None, description="Timestamp of last assignment update")

    userFirstName: Optional[str] = Field(None, description="First name of the assigned user")
    userLastName: Optional[str] = Field(None, description="Last name of the assigned user")
    userEmail: Optional[str] = Field(None, description="Email of the assigned user")
    assignableName: Optional[str] = Field(None, description="Name of the assignable entity") # Added field

    # Ensure datetime fields are serialized to ISO format strings
    _serialize_datetime = validator(
        'event_instance_start_date_time', 
        'event_instance_end_date_time', 
        'assignmentDate', 
        'createdAt', 
        'updatedAt', 
        pre=True, allow_reuse=True
    )(_to_iso_format_if_datetime)
