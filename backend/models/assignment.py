from pydantic import BaseModel, Field, ConfigDict
from typing import Optional
import datetime

class AssignmentBase(BaseModel):
    """
    Base model for assignment data, linking a user to an assignable item (event, working group).
    """
    userId: str = Field(..., description="UID of the user being assigned.")
    assignableId: str = Field(..., description="ID of the event or working group.")
    assignableType: str = Field(..., description="Type of the assignable item (e.g., 'event', 'workingGroup').")
    status: str = Field(
        default="confirmed", 
        description="Status of the assignment (e.g., 'pending_approval', 'confirmed', 'waitlisted', 'attended', 'noshow', 'cancelled_by_user', 'cancelled_by_admin')."
    )
    # assignedByUserId will be set based on context (self_signup or admin UID)
    # assignmentDate is when the assignment record was created/updated

class AssignmentCreate(BaseModel):
    """
    Model for an administrator manually assigning a user to an event.
    """
    userId: str = Field(..., description="UID of the user to assign.")
    status: Optional[str] = Field(
        "confirmed", 
        description="Initial status for the manual assignment."
    )
    # assignableId and assignableType will be derived from the path parameters.
    # assignedByUserId will be the UID of the admin performing the action.

class AssignmentResponse(AssignmentBase):
    """
    Model for returning assignment data in API responses.
    """
    assignmentId: str = Field(..., description="Unique ID of the assignment (Firestore document ID).")
    assignedByUserId: str = Field(..., description="UID of the user who created/confirmed the assignment, or 'self_signup'.")
    assignmentDate: datetime.datetime = Field(..., description="Timestamp of when the assignment was created/last modified.")
    performanceNotes: Optional[str] = Field(None, description="Notes on the volunteer's performance (for events).")
    hoursContributed: Optional[float] = Field(None, ge=0, description="Number of hours contributed (for events).")

    # Include user details for easier frontend display when listing assignments
    userFirstName: Optional[str] = Field(None, description="First name of the assigned user.")
    userLastName: Optional[str] = Field(None, description="Last name of the assigned user.")
    userEmail: Optional[str] = Field(None, description="Email of the assigned user.")
    
    model_config = ConfigDict(from_attributes=True)

class AssignmentUpdate(BaseModel):
    """
    Model for updating an assignment (e.g., status, hours, notes by an admin).
    """
    status: Optional[str] = None
    performanceNotes: Optional[str] = None
    hoursContributed: Optional[float] = Field(None, ge=0)

    model_config = ConfigDict(extra='forbid')
