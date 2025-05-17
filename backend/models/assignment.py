from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

class AssignmentBase(BaseModel):
    userId: str = Field(..., description="ID of the user being assigned.")
    assignableId: str = Field(..., description="ID of the entity (event or working group) to which the user is assigned.")
    assignableType: Literal["event", "workingGroup"] = Field(..., description="Type of the entity being assigned to.")
    status: str = Field(..., description="Status of the assignment (e.g., 'confirmed', 'attended', 'active').")
    assignedByUserId: Optional[str] = Field(None, description="ID of the user who made the assignment, or 'self_signup'.")
    assignmentDate: datetime = Field(default_factory=datetime.utcnow, description="Date and time of the assignment.")
    performanceNotes: Optional[str] = Field(None, description="Performance notes, typically for event assignments.")
    hoursContributed: Optional[float] = Field(None, description="Number of hours contributed, typically for event assignments.")

class AssignmentCreate(AssignmentBase):
    pass

class AssignmentUpdate(BaseModel):
    status: Optional[str] = None
    performanceNotes: Optional[str] = None
    hoursContributed: Optional[float] = None
    # Removed updatedAt from here as it should be set by the server, not the client during update
    # updatedAt: datetime = Field(default_factory=datetime.utcnow) 

class AssignmentResponse(AssignmentBase):
    id: str = Field(..., description="Unique ID of the assignment.")
    createdAt: datetime
    updatedAt: datetime

    # Added user details fields
    userFirstName: Optional[str] = Field(None, description="First name of the assigned user.")
    userLastName: Optional[str] = Field(None, description="Last name of the assigned user.")
    userEmail: Optional[str] = Field(None, description="Email of the assigned user.")

    class Config:
        from_attributes = True 
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }

class AssignmentInDB(AssignmentResponse): # This can often be an alias or inherit directly if no changes
    pass