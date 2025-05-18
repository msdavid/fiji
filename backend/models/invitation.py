from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional, List
from datetime import datetime

class InvitationBase(BaseModel):
    email: EmailStr = Field(..., description="Email address of the invited user.")
    assignedRoleIds: Optional[List[str]] = Field(default_factory=list, description="List of role IDs to be assigned upon registration.")
    # inviterMessage: Optional[str] = Field(None, max_length=500, description="Optional message from the inviter.") # Future consideration

class InvitationCreate(InvitationBase):
    """Payload for creating a new invitation."""
    pass

class InvitationInDB(InvitationBase):
    id: str = Field(..., description="Unique ID of the invitation document.")
    token: str = Field(..., description="Unique token for this invitation.")
    status: str = Field(default="pending", description="Status of the invitation (e.g., pending, accepted, expired).")
    expiresAt: datetime = Field(..., description="Timestamp when the invitation token expires.")
    createdByUserId: str = Field(..., description="ID of the user who created the invitation.")
    createdAt: datetime = Field(..., description="Timestamp of when the invitation was created.")
    updatedAt: datetime = Field(..., description="Timestamp of when the invitation was last updated.")
    
    model_config = ConfigDict(from_attributes=True)

class InvitationResponse(InvitationInDB):
    """
    Response model for an invitation.
    For security, the token might be omitted in list views or after creation,
    but included here for completeness if needed by admin for some reason (e.g. manual resend).
    Typically, token is not exposed after creation via API list.
    """
    pass # Inherits all fields from InvitationInDB

class InvitationListResponse(BaseModel):
    """Response model for listing invitations (omits token for security)."""
    id: str
    email: EmailStr
    status: str
    expiresAt: datetime
    createdByUserId: str
    createdAt: datetime
    assignedRoleIds: Optional[List[str]] = Field(default_factory=list)
    
    model_config = ConfigDict(from_attributes=True)

class InvitationValidateResponse(BaseModel):
    """Response when validating an invitation token."""
    isValid: bool
    email: Optional[EmailStr] = None # Email associated with the token if valid
    message: str
    assignedRoleIds: Optional[List[str]] = None # Roles to pre-fill on registration form
