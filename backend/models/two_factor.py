from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Literal
from datetime import datetime

class TwoFactorCodeCreate(BaseModel):
    """Model for creating a new 2FA verification code"""
    user_id: str = Field(..., description="User ID (Firebase UID)")
    code: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")
    purpose: Literal["login", "sensitive_action"] = Field(default="login", description="Purpose of the 2FA code")
    ip_address: Optional[str] = Field(None, description="IP address where code was requested")
    user_agent: Optional[str] = Field(None, description="Browser user agent")
    device_fingerprint: Optional[str] = Field(None, description="Device fingerprint hash")

class TwoFactorCode(TwoFactorCodeCreate):
    """Model for 2FA verification code in database"""
    id: str = Field(..., description="Document ID")
    is_used: bool = Field(default=False, description="Whether the code has been used")
    is_expired: bool = Field(default=False, description="Whether the code has expired")
    created_at: datetime = Field(..., description="When the code was created")
    expires_at: datetime = Field(..., description="When the code expires")
    used_at: Optional[datetime] = Field(None, description="When the code was used")
    
    model_config = ConfigDict(from_attributes=True)

class TwoFactorVerifyRequest(BaseModel):
    """Model for verifying a 2FA code"""
    user_id: str = Field(..., description="User ID (Firebase UID)")
    code: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")
    device_fingerprint: Optional[str] = Field(None, description="Device fingerprint hash")
    remember_device: bool = Field(default=True, description="Whether to remember this device")

class TwoFactorVerifyResponse(BaseModel):
    """Response after successful 2FA verification"""
    success: bool = Field(..., description="Whether verification was successful")
    device_token: Optional[str] = Field(None, description="Token to remember this trusted device")
    expires_at: Optional[datetime] = Field(None, description="When the device token expires")

class TrustedDeviceCreate(BaseModel):
    """Model for creating a trusted device"""
    user_id: str = Field(..., description="User ID (Firebase UID)")
    device_fingerprint: str = Field(..., description="Device fingerprint hash")
    device_name: Optional[str] = Field(None, description="Human-readable device name")
    ip_address: Optional[str] = Field(None, description="IP address of the device")
    user_agent: Optional[str] = Field(None, description="Browser user agent")

class TrustedDevice(TrustedDeviceCreate):
    """Model for trusted device in database"""
    id: str = Field(..., description="Document ID")
    device_token: str = Field(..., description="Unique token for this trusted device")
    is_active: bool = Field(default=True, description="Whether the device is still trusted")
    created_at: datetime = Field(..., description="When the device was first trusted")
    last_used_at: datetime = Field(..., description="When the device was last used")
    expires_at: datetime = Field(..., description="When the device trust expires")
    
    model_config = ConfigDict(from_attributes=True)

class TrustedDeviceResponse(BaseModel):
    """Response model for trusted device"""
    id: str
    device_name: Optional[str]
    ip_address: Optional[str]
    created_at: datetime
    last_used_at: datetime
    expires_at: datetime
    is_active: bool
    
    model_config = ConfigDict(from_attributes=True)

class TwoFactorStatusResponse(BaseModel):
    """Response model for 2FA status check"""
    requires_2fa: bool = Field(..., description="Whether 2FA is required for this login")
    code_sent: bool = Field(default=False, description="Whether a 2FA code was sent")
    trusted_device: bool = Field(default=False, description="Whether this is a trusted device")
    expires_in_minutes: Optional[int] = Field(None, description="Minutes until current code expires")