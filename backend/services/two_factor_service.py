import os
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from firebase_admin import firestore

from models.two_factor import (
    TwoFactorCode, TwoFactorCodeCreate, 
    TrustedDevice, TrustedDeviceCreate,
    TwoFactorVerifyResponse, TwoFactorStatusResponse
)

# Collections
TWO_FACTOR_CODES_COLLECTION = "twoFactorCodes"
TRUSTED_DEVICES_COLLECTION = "trustedDevices"

# Configuration
CODE_EXPIRY_MINUTES = int(os.getenv("TWO_FACTOR_CODE_EXPIRY_MINUTES", "10"))
DEVICE_TRUST_DAYS = int(os.getenv("DEVICE_TRUST_DAYS", "7"))
MAX_CODE_ATTEMPTS = int(os.getenv("MAX_2FA_ATTEMPTS", "3"))

class TwoFactorService:
    """Service for managing 2FA verification codes and trusted devices"""
    
    def __init__(self, db: firestore.AsyncClient):
        self.db = db
    
    @staticmethod
    def generate_code() -> str:
        """Generate a secure 6-digit verification code"""
        return f"{secrets.randbelow(1000000):06d}"
    
    @staticmethod
    def generate_device_token() -> str:
        """Generate a secure token for trusted devices"""
        return secrets.token_urlsafe(32)
    
    @staticmethod
    def create_device_fingerprint(user_agent: Optional[str], ip_address: Optional[str]) -> str:
        """Create a device fingerprint hash from user agent and IP"""
        data = f"{user_agent or 'unknown'}|{ip_address or 'unknown'}"
        return hashlib.sha256(data.encode()).hexdigest()[:16]
    
    async def create_verification_code(
        self, 
        user_id: str, 
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        device_fingerprint: Optional[str] = None,
        purpose: str = "login"
    ) -> TwoFactorCode:
        """Create a new 2FA verification code for a user"""
        
        # Invalidate any existing active codes for this user
        await self._invalidate_existing_codes(user_id, purpose)
        
        # Generate new code
        code = self.generate_code()
        created_at = datetime.now(timezone.utc)
        expires_at = created_at + timedelta(minutes=CODE_EXPIRY_MINUTES)
        
        # Create fingerprint if not provided
        if not device_fingerprint:
            device_fingerprint = self.create_device_fingerprint(user_agent, ip_address)
        
        # Create code document
        code_doc_ref = self.db.collection(TWO_FACTOR_CODES_COLLECTION).document()
        code_data = {
            "id": code_doc_ref.id,
            "user_id": user_id,
            "code": code,
            "purpose": purpose,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "device_fingerprint": device_fingerprint,
            "is_used": False,
            "is_expired": False,
            "created_at": created_at,
            "expires_at": expires_at,
            "used_at": None
        }
        
        await code_doc_ref.set(code_data)
        
        return TwoFactorCode(**code_data)
    
    async def verify_code(
        self, 
        user_id: str, 
        code: str,
        device_fingerprint: Optional[str] = None,
        remember_device: bool = True
    ) -> TwoFactorVerifyResponse:
        """Verify a 2FA code and optionally mark device as trusted"""
        
        # Find the code
        codes_query = self.db.collection(TWO_FACTOR_CODES_COLLECTION)\
            .where("user_id", "==", user_id)\
            .where("code", "==", code)\
            .where("is_used", "==", False)\
            .where("is_expired", "==", False)\
            .limit(1)
        
        codes_docs = await codes_query.get()
        
        if not codes_docs:
            return TwoFactorVerifyResponse(success=False)
        
        code_doc = codes_docs[0]
        code_data = code_doc.to_dict()
        
        # Check if code is expired
        expires_at = code_data.get("expires_at")
        if isinstance(expires_at, datetime):
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            
            if expires_at < datetime.now(timezone.utc):
                # Mark as expired
                await code_doc.reference.update({
                    "is_expired": True,
                    "updated_at": firestore.SERVER_TIMESTAMP
                })
                return TwoFactorVerifyResponse(success=False)
        
        # Mark code as used
        await code_doc.reference.update({
            "is_used": True,
            "used_at": firestore.SERVER_TIMESTAMP,
            "updated_at": firestore.SERVER_TIMESTAMP
        })
        
        # Create trusted device if requested
        device_token = None
        expires_at = None
        
        if remember_device and device_fingerprint:
            trusted_device = await self._create_trusted_device(
                user_id, 
                device_fingerprint,
                code_data.get("ip_address"),
                code_data.get("user_agent")
            )
            device_token = trusted_device.device_token
            expires_at = trusted_device.expires_at
        
        return TwoFactorVerifyResponse(
            success=True,
            device_token=device_token,
            expires_at=expires_at
        )
    
    async def check_device_trust(self, user_id: str, device_fingerprint: str) -> Optional[TrustedDevice]:
        """Check if a device is trusted for a user"""
        
        devices_query = self.db.collection(TRUSTED_DEVICES_COLLECTION)\
            .where("user_id", "==", user_id)\
            .where("device_fingerprint", "==", device_fingerprint)\
            .where("is_active", "==", True)\
            .limit(1)
        
        devices_docs = await devices_query.get()
        
        if not devices_docs:
            return None
        
        device_doc = devices_docs[0]
        device_data = device_doc.to_dict()
        
        # Check if device trust has expired
        expires_at = device_data.get("expires_at")
        if isinstance(expires_at, datetime):
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            
            if expires_at < datetime.now(timezone.utc):
                # Mark as inactive
                await device_doc.reference.update({
                    "is_active": False,
                    "updated_at": firestore.SERVER_TIMESTAMP
                })
                return None
        
        # Update last used timestamp
        await device_doc.reference.update({
            "last_used_at": firestore.SERVER_TIMESTAMP,
            "updated_at": firestore.SERVER_TIMESTAMP
        })
        
        return TrustedDevice(**device_data)
    
    async def revoke_device_trust(self, user_id: str, device_id: str) -> bool:
        """Revoke trust for a specific device"""
        
        device_doc_ref = self.db.collection(TRUSTED_DEVICES_COLLECTION).document(device_id)
        device_doc = await device_doc_ref.get()
        
        if not device_doc.exists:
            return False
        
        device_data = device_doc.to_dict()
        if device_data.get("user_id") != user_id:
            return False
        
        await device_doc_ref.update({
            "is_active": False,
            "updated_at": firestore.SERVER_TIMESTAMP
        })
        
        return True
    
    async def get_user_trusted_devices(self, user_id: str) -> list[TrustedDevice]:
        """Get all trusted devices for a user"""
        
        devices_query = self.db.collection(TRUSTED_DEVICES_COLLECTION)\
            .where("user_id", "==", user_id)\
            .where("is_active", "==", True)\
            .order_by("last_used_at", direction=firestore.Query.DESCENDING)
        
        devices_docs = await devices_query.get()
        
        devices = []
        current_time = datetime.now(timezone.utc)
        
        for device_doc in devices_docs:
            device_data = device_doc.to_dict()
            
            # Check if device has expired
            expires_at = device_data.get("expires_at")
            if isinstance(expires_at, datetime):
                if expires_at.tzinfo is None:
                    expires_at = expires_at.replace(tzinfo=timezone.utc)
                
                if expires_at < current_time:
                    # Mark as inactive
                    await device_doc.reference.update({
                        "is_active": False,
                        "updated_at": firestore.SERVER_TIMESTAMP
                    })
                    continue
            
            devices.append(TrustedDevice(**device_data))
        
        return devices
    
    async def _invalidate_existing_codes(self, user_id: str, purpose: str) -> None:
        """Invalidate existing active codes for a user"""
        
        codes_query = self.db.collection(TWO_FACTOR_CODES_COLLECTION)\
            .where("user_id", "==", user_id)\
            .where("purpose", "==", purpose)\
            .where("is_used", "==", False)\
            .where("is_expired", "==", False)
        
        codes_docs = await codes_query.get()
        
        for code_doc in codes_docs:
            await code_doc.reference.update({
                "is_expired": True,
                "updated_at": firestore.SERVER_TIMESTAMP
            })
    
    async def _create_trusted_device(
        self, 
        user_id: str, 
        device_fingerprint: str,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> TrustedDevice:
        """Create a new trusted device entry"""
        
        # Check if device already exists and reactivate it
        existing_device_query = self.db.collection(TRUSTED_DEVICES_COLLECTION)\
            .where("user_id", "==", user_id)\
            .where("device_fingerprint", "==", device_fingerprint)\
            .limit(1)
        
        existing_docs = await existing_device_query.get()
        
        created_at = datetime.now(timezone.utc)
        expires_at = created_at + timedelta(days=DEVICE_TRUST_DAYS)
        device_token = self.generate_device_token()
        
        if existing_docs:
            # Update existing device
            device_doc = existing_docs[0]
            await device_doc.reference.update({
                "device_token": device_token,
                "is_active": True,
                "last_used_at": created_at,
                "expires_at": expires_at,
                "updated_at": firestore.SERVER_TIMESTAMP
            })
            
            updated_doc = await device_doc.reference.get()
            return TrustedDevice(**updated_doc.to_dict())
        else:
            # Create new device
            device_doc_ref = self.db.collection(TRUSTED_DEVICES_COLLECTION).document()
            device_data = {
                "id": device_doc_ref.id,
                "user_id": user_id,
                "device_fingerprint": device_fingerprint,
                "device_token": device_token,
                "device_name": self._generate_device_name(user_agent),
                "ip_address": ip_address,
                "user_agent": user_agent,
                "is_active": True,
                "created_at": created_at,
                "last_used_at": created_at,
                "expires_at": expires_at
            }
            
            await device_doc_ref.set(device_data)
            return TrustedDevice(**device_data)
    
    @staticmethod
    def _generate_device_name(user_agent: Optional[str]) -> Optional[str]:
        """Generate a human-readable device name from user agent"""
        if not user_agent:
            return None
        
        user_agent = user_agent.lower()
        
        # Detect browser
        if "chrome" in user_agent and "edge" not in user_agent:
            browser = "Chrome"
        elif "firefox" in user_agent:
            browser = "Firefox"
        elif "safari" in user_agent and "chrome" not in user_agent:
            browser = "Safari"
        elif "edge" in user_agent:
            browser = "Edge"
        else:
            browser = "Unknown Browser"
        
        # Detect OS
        if "windows" in user_agent:
            os_name = "Windows"
        elif "mac" in user_agent:
            os_name = "macOS"
        elif "linux" in user_agent:
            os_name = "Linux"
        elif "android" in user_agent:
            os_name = "Android"
        elif "iphone" in user_agent or "ipad" in user_agent:
            os_name = "iOS"
        else:
            os_name = "Unknown OS"
        
        return f"{browser} on {os_name}"