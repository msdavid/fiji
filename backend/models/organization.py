from typing import Optional
from pydantic import BaseModel, HttpUrl, Field # Added Field for potential future use

class OrganizationConfiguration(BaseModel):
    """
    Represents the organization's configuration settings.
    """
    id: str = Field(default="main_config", description="Document ID in Firestore, typically 'main_config'.")
    name: Optional[str] = Field(None, description="Name of the organization.")
    logo_url: Optional[HttpUrl] = Field(None, description="Public URL of the organization's logo.")
    email_sender_name: Optional[str] = Field(None, description="Default sender name for emails from the platform.")
    email_sender_address: Optional[str] = Field(None, description="Default sender email address for emails. Should be a valid email.")
    # TODO: Add other organization-specific settings as needed, e.g.:
    # primary_color: Optional[str] = None
    # contact_phone: Optional[str] = None
    # contact_address: Optional[str] = None

    class Config:
        from_attributes = True
        # Ensure that HttpUrl is correctly validated and serialized
        # Pydantic v2 handles HttpUrl serialization to string by default.

class OrganizationConfigurationUpdate(BaseModel):
    """
    Represents the updatable fields for the organization's configuration.
    logo_url is updated via a separate endpoint.
    """
    name: Optional[str] = Field(None, description="New name for the organization.")
    email_sender_name: Optional[str] = Field(None, description="New default sender name for emails.")
    email_sender_address: Optional[str] = Field(None, description="New default sender email address. Must be a valid email if provided.")
    # Fields not directly updatable here (like logo_url or id) are omitted.

    class Config:
        extra = 'forbid' # Prevent accidental update of non-specified fields