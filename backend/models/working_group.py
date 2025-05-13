from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

class WorkingGroupBase(BaseModel):
    groupName: str = Field(..., description="Name of the working group.")
    description: Optional[str] = Field(None, description="Detailed description of the working group.")
    status: Literal["active", "archived"] = Field(default="active", description="Status of the working group.")
    # createdByUserId will be set by the router based on the authenticated user

class WorkingGroupCreate(WorkingGroupBase):
    # createdAt and updatedAt will be set by the router using firestore.SERVER_TIMESTAMP
    pass

class WorkingGroupUpdate(BaseModel):
    groupName: Optional[str] = None
    description: Optional[str] = None
    status: Optional[Literal["active", "archived"]] = None
    # updatedAt will be set by the router using firestore.SERVER_TIMESTAMP

class WorkingGroupInDBBase(WorkingGroupBase):
    id: str = Field(..., description="Document ID of the working group.")
    createdByUserId: str = Field(..., description="ID of the user who created the working group.")
    createdAt: datetime = Field(..., description="Timestamp of when the working group was created.")
    updatedAt: datetime = Field(..., description="Timestamp of when the working group was last updated.")

class WorkingGroupResponse(WorkingGroupInDBBase):
    # Optional fields for creator's details if needed in the future
    creatorFirstName: Optional[str] = Field(None, description="First name of the creator.")
    creatorLastName: Optional[str] = Field(None, description="Last name of the creator.")
    pass
