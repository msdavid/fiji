from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

class WorkingGroupBase(BaseModel):
    groupName: str = Field(..., description="Name of the working group.")
    description: Optional[str] = Field(None, description="Optional description of the working group.")
    status: Literal["active", "archived"] = Field("active", description="Status of the working group.")
    isGlobal: Optional[bool] = Field(False, description="Whether this is the global organization-wide working group.")

class WorkingGroupCreate(WorkingGroupBase):
    pass

class WorkingGroupUpdate(BaseModel):
    groupName: Optional[str] = None
    description: Optional[str] = None
    status: Optional[Literal["active", "archived"]] = None
    isGlobal: Optional[bool] = None
    updatedAt: datetime = Field(default_factory=datetime.utcnow)

class WorkingGroupResponse(WorkingGroupBase):
    id: str = Field(..., description="Unique ID of the working group.")
    createdByUserId: str = Field(..., description="ID of the user who created the working group.")
    createdAt: datetime
    updatedAt: datetime
    # Optional fields to include creator's details, can be populated in the router
    creatorFirstName: Optional[str] = None
    creatorLastName: Optional[str] = None

    class Config:
        from_attributes = True # Changed from orm_mode
        json_encoders = {
            datetime: lambda v: v.isoformat() if v else None
        }

class WorkingGroupInDB(WorkingGroupResponse):
    pass