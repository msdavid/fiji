from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

class AssignmentBase(BaseModel):
    userId: str = Field(..., description="ID of the user being assigned.")
    assignableId: str = Field(..., description="ID of the entity (event or working group) the user is assigned to.")
    assignableType: Literal["event", "workingGroup"] = Field(..., description="Type of the entity being assigned to.")
    status: str = Field(default="confirmed", description="Status of the assignment (e.g., 'confirmed', 'attended', 'active', 'cancelled_signup').")
    assignedByUserId: Optional[str] = Field(None, description="ID of the user who made the assignment, or 'self_signup'.")
    performanceNotes: Optional[str] = Field(None, description="Performance notes, typically for event assignments.")
    hoursContributed: Optional[float] = Field(None, description="Number of hours contributed, typically for event assignments.")

class AssignmentCreate(AssignmentBase):
    # assignmentDate will be set by the router using firestore.SERVER_TIMESTAMP or default_factory if not provided
    # createdAt and updatedAt will be set by the router using firestore.SERVER_TIMESTAMP
    pass

class AssignmentUpdate(BaseModel):
    status: Optional[str] = None
    performanceNotes: Optional[str] = None
    hoursContributed: Optional[float] = None
    # userId, assignableId, assignableType, assignedByUserId, assignmentDate should generally not be updatable via this model.
    # updatedAt will be set by the router using firestore.SERVER_TIMESTAMP

class AssignmentInDBBase(AssignmentBase):
    id: str = Field(..., description="Document ID of the assignment.")
    assignmentDate: datetime = Field(..., description="Date and time of the assignment.")
    createdAt: datetime = Field(..., description="Timestamp of when the assignment was created.")
    updatedAt: datetime = Field(..., description="Timestamp of when the assignment was last updated.")

class AssignmentResponse(AssignmentInDBBase):
    userFirstName: Optional[str] = Field(None, description="First name of the assigned user.")
    userLastName: Optional[str] = Field(None, description="Last name of the assigned user.")
    userEmail: Optional[str] = Field(None, description="Email of the assigned user.")
    pass
