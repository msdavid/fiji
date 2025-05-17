from pydantic import BaseModel, Field, EmailStr, ConfigDict
from typing import Optional, Literal
from datetime import datetime, date

class DonationBase(BaseModel):
    donorName: str = Field(..., description="Name of the donor (individual or organization).")
    donorEmail: Optional[EmailStr] = Field(None, description="Email address of the donor.")
    donorPhone: Optional[str] = Field(None, description="Phone number of the donor.")
    donationType: Literal["monetary", "in_kind", "time_contribution"] = Field(..., description="Type of the donation.")
    amount: Optional[float] = Field(None, ge=0, description="Monetary amount of the donation (if applicable).")
    currency: Optional[str] = Field(None, max_length=3, description="Currency code (e.g., SGD, USD) if monetary.")
    description: str = Field(..., description="Description of the donation (e.g., items donated, hours contributed).")
    donationDate: date = Field(..., description="Date the donation was made or received.")
    notes: Optional[str] = Field(None, description="Additional notes about the donation.")
    
    model_config = ConfigDict(from_attributes=True)

class DonationCreate(DonationBase):
    # recordedByUserId will be set by the router based on the authenticated user
    # createdAt and updatedAt will be set by the router
    pass

class DonationUpdate(BaseModel):
    donorName: Optional[str] = None
    donorEmail: Optional[EmailStr] = None
    donorPhone: Optional[str] = None
    donationType: Optional[Literal["monetary", "in_kind", "time_contribution"]] = None
    amount: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = Field(None, max_length=3)
    description: Optional[str] = None
    donationDate: Optional[date] = None
    notes: Optional[str] = None

    model_config = ConfigDict(extra='forbid', from_attributes=True)

class DonationResponse(DonationBase):
    id: str = Field(..., description="Unique ID of the donation.")
    recordedByUserId: str = Field(..., description="UID of the user who recorded the donation.")
    recordedByUserFirstName: Optional[str] = Field(None, description="First name of the user who recorded the donation.")
    recordedByUserLastName: Optional[str] = Field(None, description="Last name of the user who recorded the donation.")
    createdAt: datetime
    updatedAt: datetime

    model_config = ConfigDict(from_attributes=True)

class DonationInDB(DonationResponse):
    # This can be identical to DonationResponse if no further DB-specific fields are needed beyond what's in Response.
    # Or it could include fields not always sent in responses.
    pass