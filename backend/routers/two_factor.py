from fastapi import APIRouter, HTTPException, Depends, status, BackgroundTasks, Request
from typing import Optional
from firebase_admin import firestore
from pydantic import BaseModel

from models.two_factor import (
    TwoFactorVerifyRequest, TwoFactorVerifyResponse, 
    TwoFactorStatusResponse, TrustedDeviceResponse
)
from dependencies.database import get_db
from dependencies.auth import get_firebase_user
from services.two_factor_service import TwoFactorService
from services.email_service import EmailService

router = APIRouter(
    prefix="/auth/2fa",
    tags=["two-factor-authentication"]
)

# Initialize EmailService
try:
    email_service = EmailService()
except ValueError as e:
    print(f"Failed to initialize EmailService: {e}. 2FA email sending will be disabled.")
    email_service = None

def get_client_info(request: Request) -> tuple[Optional[str], Optional[str]]:
    """Extract client IP and User-Agent from request"""
    # Try to get real IP from headers (for reverse proxy setups)
    ip_address = (
        request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or
        request.headers.get("X-Real-IP") or
        request.client.host if request.client else None
    )
    user_agent = request.headers.get("User-Agent")
    return ip_address, user_agent

class TwoFactorCheckRequest(BaseModel):
    user_id: str
    device_fingerprint: Optional[str] = None

@router.post("/check-requirement", response_model=TwoFactorStatusResponse)
async def check_2fa_requirement(
    request: Request,
    check_request: TwoFactorCheckRequest,
    db: firestore.AsyncClient = Depends(get_db)
):
    """
    Check if 2FA is required for a user login attempt.
    This endpoint can be called before authentication to determine the flow.
    """
    ip_address, user_agent = get_client_info(request)
    two_factor_service = TwoFactorService(db)
    
    # If no device fingerprint provided, create one
    device_fingerprint = check_request.device_fingerprint
    if not device_fingerprint:
        device_fingerprint = TwoFactorService.create_device_fingerprint(user_agent, ip_address)
    
    # Check if device is trusted
    trusted_device = await two_factor_service.check_device_trust(check_request.user_id, device_fingerprint)
    
    if trusted_device:
        return TwoFactorStatusResponse(
            requires_2fa=False,
            code_sent=False,
            trusted_device=True
        )
    
    return TwoFactorStatusResponse(
        requires_2fa=True,
        code_sent=False,
        trusted_device=False
    )

@router.post("/send-code", response_model=TwoFactorStatusResponse)
async def send_2fa_code(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_firebase_user),
    db: firestore.AsyncClient = Depends(get_db)
):
    """
    Send a 2FA verification code to the authenticated user's email.
    """
    user_id = current_user.get("uid")
    user_email = current_user.get("email")
    user_name = current_user.get("name")
    
    if not user_id or not user_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user authentication data"
        )
    
    ip_address, user_agent = get_client_info(request)
    two_factor_service = TwoFactorService(db)
    
    # Create device fingerprint
    device_fingerprint = TwoFactorService.create_device_fingerprint(user_agent, ip_address)
    
    # Check if device is already trusted
    trusted_device = await two_factor_service.check_device_trust(user_id, device_fingerprint)
    if trusted_device:
        return TwoFactorStatusResponse(
            requires_2fa=False,
            code_sent=False,
            trusted_device=True
        )
    
    try:
        # Create verification code
        code_obj = await two_factor_service.create_verification_code(
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            device_fingerprint=device_fingerprint,
            purpose="login"
        )
        
        # Send email in background
        if email_service:
            device_name = TwoFactorService._generate_device_name(user_agent)
            background_tasks.add_task(
                email_service.send_2fa_code_email,
                to_email=user_email,
                to_name=user_name,
                verification_code=code_obj.code,
                device_name=device_name,
                ip_address=ip_address,
                expires_in_minutes=10
            )
        else:
            # Log the code for development/testing
            print(f"2FA Code for {user_email}: {code_obj.code} (EmailService disabled)")
        
        # Calculate expiry minutes
        from datetime import timezone
        expires_in_minutes = None
        if code_obj.expires_at:
            from datetime import datetime
            now = datetime.now(timezone.utc)
            if code_obj.expires_at.tzinfo is None:
                expires_at = code_obj.expires_at.replace(tzinfo=timezone.utc)
            else:
                expires_at = code_obj.expires_at
            expires_in_minutes = max(0, int((expires_at - now).total_seconds() / 60))
        
        return TwoFactorStatusResponse(
            requires_2fa=True,
            code_sent=True,
            trusted_device=False,
            expires_in_minutes=expires_in_minutes
        )
        
    except Exception as e:
        print(f"Error creating 2FA code for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate verification code"
        )

@router.post("/verify-code", response_model=TwoFactorVerifyResponse)
async def verify_2fa_code(
    request: Request,
    verify_request: TwoFactorVerifyRequest,
    current_user: dict = Depends(get_firebase_user),
    db: firestore.AsyncClient = Depends(get_db)
):
    """
    Verify a 2FA code for the authenticated user.
    """
    user_id = current_user.get("uid")
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user authentication data"
        )
    
    # Ensure the verification is for the authenticated user
    if verify_request.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot verify code for different user"
        )
    
    ip_address, user_agent = get_client_info(request)
    two_factor_service = TwoFactorService(db)
    
    # Use provided fingerprint or create one
    device_fingerprint = (
        verify_request.device_fingerprint or 
        TwoFactorService.create_device_fingerprint(user_agent, ip_address)
    )
    
    try:
        result = await two_factor_service.verify_code(
            user_id=user_id,
            code=verify_request.code,
            device_fingerprint=device_fingerprint,
            remember_device=verify_request.remember_device
        )
        
        if not result.success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification code"
            )
        
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error verifying 2FA code for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to verify code"
        )

@router.get("/trusted-devices", response_model=list[TrustedDeviceResponse])
async def get_trusted_devices(
    current_user: dict = Depends(get_firebase_user),
    db: firestore.AsyncClient = Depends(get_db)
):
    """
    Get all trusted devices for the authenticated user.
    """
    user_id = current_user.get("uid")
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user authentication data"
        )
    
    two_factor_service = TwoFactorService(db)
    
    try:
        devices = await two_factor_service.get_user_trusted_devices(user_id)
        
        # Convert to response model
        return [
            TrustedDeviceResponse(
                id=device.id,
                device_name=device.device_name,
                ip_address=device.ip_address,
                created_at=device.created_at,
                last_used_at=device.last_used_at,
                expires_at=device.expires_at,
                is_active=device.is_active
            )
            for device in devices
        ]
        
    except Exception as e:
        print(f"Error fetching trusted devices for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch trusted devices"
        )

@router.delete("/trusted-devices/{device_id}")
async def revoke_trusted_device(
    device_id: str,
    current_user: dict = Depends(get_firebase_user),
    db: firestore.AsyncClient = Depends(get_db)
):
    """
    Revoke trust for a specific device.
    """
    user_id = current_user.get("uid")
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user authentication data"
        )
    
    two_factor_service = TwoFactorService(db)
    
    try:
        success = await two_factor_service.revoke_device_trust(user_id, device_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Trusted device not found"
            )
        
        return {"message": "Device trust revoked successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error revoking device trust for user {user_id}, device {device_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke device trust"
        )