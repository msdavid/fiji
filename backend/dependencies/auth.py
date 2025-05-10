from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer # Although we use Bearer tokens, this helps with Swagger UI
import firebase_admin
from firebase_admin import auth

# This scheme can be used with FastAPI's Depends to extract the token.
# It also helps Swagger UI to show an "Authorize" button.
# The tokenUrl is not strictly necessary for backend token verification but often included.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token") # "token" is a dummy URL

async def get_firebase_user(token: str = Depends(oauth2_scheme)):
    """
    Dependency to verify Firebase ID token and get user data.
    
    To be used in FastAPI path operations to protect routes.
    It expects a Bearer token in the Authorization header.
    """
    if not firebase_admin._apps:
        # This should ideally not happen if main.py initializes Firebase correctly.
        # Consider how to handle this robustly, e.g., by raising a 503 Service Unavailable
        # or ensuring initialization is always complete before requests are processed.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase Admin SDK is not initialized. Cannot authenticate user.",
        )
        
    try:
        # Verify the ID token while checking if the token is revoked.
        decoded_token = auth.verify_id_token(token, check_revoked=True)
        # The decoded_token contains user information like uid, email, etc.
        # For now, we return the whole decoded token.
        # You might want to extract specific fields, e.g., decoded_token.get("uid")
        return decoded_token
    except auth.RevokedIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ID token has been revoked. Please re-authenticate.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.UserDisabledError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account has been disabled.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except auth.InvalidIdTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid ID token. Please provide a valid token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        # Catch any other Firebase auth related errors or unexpected issues
        print(f"An unexpected error occurred during token verification: {e}") # Log this for debugging
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not verify Firebase ID token due to an internal error.",
            headers={"WWW-Authenticate": "Bearer"},
        )

# Example of how to get just the UID:
# async def get_current_user_uid(decoded_token: dict = Depends(get_firebase_user)):
#     uid = decoded_token.get("uid")
#     if not uid:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
#             detail="UID not found in token."
#         )
#     return uid