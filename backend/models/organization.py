from typing import Optional, Union
import datetime
from pydantic import BaseModel, HttpUrl, Field, field_validator, model_validator

class OrganizationConfiguration(BaseModel):
    """
    Represents the organization's configuration settings.
    """
    id: str = Field(default="main_config", description="Document ID in Firestore, typically 'main_config'.")
    name: Optional[str] = Field(None, description="Name of the organization.")
    logo_url: Optional[HttpUrl] = Field(None, description="Public URL of the organization's logo.")
    email_sender_name: Optional[str] = Field(None, description="Default sender name for emails from the platform.")
    email_sender_address: Optional[str] = Field(None, description="Default sender email address for emails. Should be a valid email.")
    primary_color: Optional[str] = Field(None, description="Primary brand color in hex format (e.g., #1F2937)")
    secondary_color: Optional[str] = Field(None, description="Secondary brand color in hex format (e.g., #6B7280)")
    contact_email: Optional[str] = Field(None, description="Primary contact email for the organization")
    website_url: Optional[HttpUrl] = Field(None, description="Organization's website URL")
    donations_url: Optional[HttpUrl] = Field(None, description="Organization's donations page URL")
    address: Optional[str] = Field(None, description="Organization's physical address")
    phone: Optional[str] = Field(None, description="Organization's contact phone number")
    description: Optional[str] = Field(None, description="Brief description of the organization")
    created_at: Optional[datetime.datetime] = Field(None, description="Timestamp when the configuration was created")
    updated_at: Optional[datetime.datetime] = Field(None, description="Timestamp when the configuration was last updated")

    @field_validator('primary_color', 'secondary_color')
    @classmethod
    def validate_hex_color(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not v.startswith('#') or len(v) != 7:
            raise ValueError("Color must be in hex format (e.g., #1F2937)")
        try:
            int(v[1:], 16)
        except ValueError:
            raise ValueError("Invalid hex color format")
        return v

    @field_validator('logo_url', 'website_url', 'donations_url', mode='before')
    @classmethod
    def validate_url_fields(cls, v):
        """Convert empty strings to None for URL fields"""
        if v == '':
            return None
        return v

    class Config:
        from_attributes = True

class OrganizationConfigurationUpdate(BaseModel):
    """
    Represents the updatable fields for the organization's configuration.
    """
    name: Optional[str] = Field(None, description="New name for the organization.")
    logo_url: Optional[HttpUrl] = Field(None, description="Public URL of the organization's logo.")
    email_sender_name: Optional[str] = Field(None, description="New default sender name for emails.")
    email_sender_address: Optional[str] = Field(None, description="New default sender email address. Must be a valid email if provided.")
    primary_color: Optional[str] = Field(None, description="Primary brand color in hex format")
    secondary_color: Optional[str] = Field(None, description="Secondary brand color in hex format")
    contact_email: Optional[str] = Field(None, description="Primary contact email for the organization")
    website_url: Optional[HttpUrl] = Field(None, description="Organization's website URL")
    donations_url: Optional[HttpUrl] = Field(None, description="Organization's donations page URL")
    address: Optional[str] = Field(None, description="Organization's physical address")
    phone: Optional[str] = Field(None, description="Organization's contact phone number")
    description: Optional[str] = Field(None, description="Brief description of the organization")

    @field_validator('primary_color', 'secondary_color')
    @classmethod
    def validate_hex_color(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not v.startswith('#') or len(v) != 7:
            raise ValueError("Color must be in hex format (e.g., #1F2937)")
        try:
            int(v[1:], 16)
        except ValueError:
            raise ValueError("Invalid hex color format")
        return v

    @field_validator('logo_url', 'website_url', 'donations_url', mode='before')
    @classmethod
    def validate_url_fields(cls, v):
        """Convert empty strings to None for URL fields"""
        if v == '':
            return None
        return v

    class Config:
        extra = 'forbid'