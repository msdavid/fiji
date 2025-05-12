from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import List, Optional
import datetime
import uuid # For generating unique tokens

class InvitationBase(BaseModel):
    """
    Base model for invitation data.
    """
    email: EmailStr = Field(..., description="Email address of the invitee.")
    rolesToAssignOnRegistration: List[str] = Field(default_factory=list, description="List of role IDs to assign upon successful registration.")
    # invitedByUserId will be automatically populated from the authenticated sysadmin user

class InvitationCreate(InvitationBase):
    """
    Model for creating a new registration invitation.
    """
    expiresInDays: Optional[int] = Field(7, description="Number of days until the invitation expires. Default is 7 days.")


class InvitationResponse(InvitationBase):
    """
    Model for returning invitation data in API responses.
    """
    invitationId: str = Field(..., description="Unique ID of the invitation (Firestore document ID).")
    token: str = Field(..., description="Unique, secure token for registration.")
    status: str = Field(default="pending", description="Status of the invitation (e.g., pending, accepted, expired).")
    invitedByUserId: str = Field(..., description="UID of the user who created the invitation.")
    createdAt: datetime.datetime = Field(..., description="Timestamp of when the invitation was created.")
    expiresAt: datetime.datetime = Field(..., description="Timestamp of when the invitation will expire.")

    model_config = ConfigDict(from_attributes=True)

class InvitationStatusResponse(BaseModel):
    """
    Model for responding to an invitation token validation request.
    """
    valid: bool = Field(..., description="Whether the token is valid for registration.")
    reason: Optional[str] = Field(None, description="Reason why the token is not valid, if applicable.")
    email: Optional[EmailStr] = Field(None, description="Email associated with the token, if found.")

    model_config = ConfigDict(from_attributes=True)