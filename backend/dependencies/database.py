from fastapi import Request, HTTPException, status
from firebase_admin import firestore # For type hinting firestore.AsyncClient

async def get_db(request: Request) -> firestore.AsyncClient:
    """
    Dependency to get the Firestore client.
    The client is initialized during app startup and stored in app.state.db.
    """
    if not hasattr(request.app.state, 'db') or request.app.state.db is None:
        # This should ideally not happen if lifespan event completed successfully.
        # It indicates a problem with Firebase initialization.
        print("Error in get_db: Firestore client not found in app.state.db") # Added log
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, 
            detail="Firestore client not available. Firebase may not have initialized correctly."
        )
    return request.app.state.db