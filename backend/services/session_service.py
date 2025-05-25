import os
from firebase_admin import firestore
from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from typing import Optional

USERS_COLLECTION = "users"

# JWT Configuration - These should be in environment variables for production
# For demonstration, using hardcoded (but random-looking) values.
# Ensure you generate a strong, random secret key for production.
SECRET_KEY = os.getenv("BACKEND_SESSION_SECRET_KEY", "a_very_secure_secret_key_for_jwt_fiji_project_12345!@#$%")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("BACKEND_SESSION_EXPIRE_MINUTES", "60")) # Default to 60 minutes

class SessionService:
    def __init__(self, db: firestore.AsyncClient):
        self.db = db

    async def create_session_token(self, user_id: str) -> str:
        """
        Creates a JWT session token for the user and updates lastLoginAt.
        """
        user_ref = self.db.collection(USERS_COLLECTION).document(user_id)
        try:
            await user_ref.update({
                "lastLoginAt": firestore.SERVER_TIMESTAMP,
                "updatedAt": firestore.SERVER_TIMESTAMP
            })
            print(f"Updated lastLoginAt for user {user_id}")
        except Exception as e:
            print(f"Error updating lastLoginAt for user {user_id}: {e}")
            # Consider if this error should prevent token issuance

        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode = {
            "sub": user_id,
            "exp": expire,
            "iat": datetime.now(timezone.utc), # Issued at
            "token_type": "backend_session" # Custom claim
        }
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt

    async def verify_session_token(self, token: str) -> Optional[dict]:
        """
        Verifies a backend-issued JWT session token.
        Returns a dictionary containing user_id (as 'uid') and other claims if valid, None otherwise.
        """
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            user_id: Optional[str] = payload.get("sub")
            token_type: Optional[str] = payload.get("token_type")

            if user_id is None or token_type != "backend_session":
                # Missing subject or incorrect token type
                return None 
            
            # Token is valid, return relevant claims (especially uid)
            return {"uid": user_id, **payload} # Return all claims including uid
        except JWTError as e:
            # Handles various errors: ExpiredSignatureError, InvalidTokenError, etc.
            print(f"JWT Verification Error: {e}")
            return None
