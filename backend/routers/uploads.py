from fastapi import APIRouter, HTTPException, Depends, File, UploadFile, status
from fastapi.responses import JSONResponse
from PIL import Image
import io
import uuid
import os
from typing import Optional
from dependencies.auth import get_current_session_user_with_rbac
from dependencies.rbac import RBACUser
from dependencies.database import get_db
import firebase_admin
from firebase_admin import storage, firestore

router = APIRouter(prefix="/uploads", tags=["uploads"])

# Configuration
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_IMAGE_DIMENSION = 1024  # Max width/height in pixels

def validate_image_file(file: UploadFile) -> None:
    """Validate uploaded image file."""
    # Check file size
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE // (1024*1024)}MB"
        )
    
    # Check content type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file type. Allowed types: {', '.join(ALLOWED_IMAGE_TYPES)}"
        )
    
    # Check file extension
    if file.filename:
        extension = os.path.splitext(file.filename.lower())[1]
        if extension not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid file extension. Allowed extensions: {', '.join(ALLOWED_EXTENSIONS)}"
            )

def process_image(image_data: bytes) -> bytes:
    """Process and resize image, return processed image bytes."""
    try:
        # Open image with PIL
        image = Image.open(io.BytesIO(image_data))
        
        # Convert to RGB if necessary (for PNG with transparency)
        if image.mode in ('RGBA', 'LA'):
            # Create white background
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'RGBA':
                background.paste(image, mask=image.split()[-1])  # Use alpha channel as mask
            else:
                background.paste(image)
            image = background
        elif image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize if needed (maintain aspect ratio)
        if image.width > MAX_IMAGE_DIMENSION or image.height > MAX_IMAGE_DIMENSION:
            image.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION), Image.Resampling.LANCZOS)
        
        # Save as JPEG with good quality
        output_buffer = io.BytesIO()
        image.save(output_buffer, format='JPEG', quality=85, optimize=True)
        
        return output_buffer.getvalue()
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process image: {str(e)}"
        )

def upload_to_firebase_storage(image_data: bytes, user_id: str, filename: str) -> str:
    """Upload image to Firebase Storage and return public URL."""
    try:
        # Get the default bucket
        bucket = storage.bucket()
        
        # Create a unique filename
        file_extension = "jpg"  # We always convert to JPEG
        unique_filename = f"profile-pictures/{user_id}/{uuid.uuid4().hex}.{file_extension}"
        
        # Create blob and upload
        blob = bucket.blob(unique_filename)
        blob.upload_from_string(
            image_data,
            content_type='image/jpeg'
        )
        
        # Make the blob publicly accessible
        blob.make_public()
        
        # Return the public URL
        return blob.public_url
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload to Firebase Storage: {str(e)}"
        )

@router.post("/profile-picture")
async def upload_profile_picture(
    file: UploadFile = File(...),
    current_user: RBACUser = Depends(get_current_session_user_with_rbac),
    db: firestore.AsyncClient = Depends(get_db)
):
    """
    Upload and process a profile picture for the current user.
    Returns a public URL from Firebase Storage.
    """
    try:
        # Validate the uploaded file
        validate_image_file(file)
        
        # Read file content
        file_content = await file.read()
        
        # Additional size check after reading
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        # Process the image
        processed_image_data = process_image(file_content)
        
        # Upload to Firebase Storage
        public_url = upload_to_firebase_storage(
            processed_image_data, 
            current_user.uid, 
            file.filename or "profile_picture"
        )
        
        # Update user's profile in Firestore with new profile picture URL
        try:
            user_doc_ref = db.collection("users").document(current_user.uid)
            await user_doc_ref.update({
                "profilePictureUrl": public_url,
                "updatedAt": firestore.SERVER_TIMESTAMP
            })
        except Exception as e:
            # Log the error but don't fail the upload
            print(f"Warning: Failed to update user profile with new picture URL: {str(e)}")
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "success": True,
                "profilePictureUrl": public_url,
                "message": "Profile picture uploaded and updated successfully"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload profile picture: {str(e)}"
        )
    finally:
        # Ensure file is closed
        await file.close()

@router.post("/organization-logo")
async def upload_organization_logo(
    file: UploadFile = File(...),
    current_user: RBACUser = Depends(get_current_session_user_with_rbac),
    db: firestore.AsyncClient = Depends(get_db)
):
    """
    Upload and process a logo for the organization.
    Returns a public URL from Firebase Storage and updates organization settings.
    Only sysadmins can upload organization logos.
    """
    try:
        # Check if user is sysadmin
        if not current_user.is_sysadmin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only system administrators can upload organization logos"
            )
        
        # Validate the uploaded file
        validate_image_file(file)
        
        # Read file content
        file_content = await file.read()
        
        # Additional size check after reading
        if len(file_content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds maximum allowed size of {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        # Process the image (logos might need different dimensions)
        processed_image_data = process_image(file_content)
        
        # Upload to Firebase Storage in a different path for organization assets
        try:
            # Get the default bucket
            bucket = storage.bucket()
            
            # Create a unique filename for organization logo
            file_extension = "jpg"  # We always convert to JPEG
            unique_filename = f"organization/logo-{uuid.uuid4().hex}.{file_extension}"
            
            # Create blob and upload
            blob = bucket.blob(unique_filename)
            blob.upload_from_string(
                processed_image_data,
                content_type='image/jpeg'
            )
            
            # Make the blob publicly accessible
            blob.make_public()
            
            # Get the public URL
            public_url = blob.public_url
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload to Firebase Storage: {str(e)}"
            )
        
        # Update organization settings with new logo URL
        try:
            # Get the organization document (assuming there's only one)
            org_collection = db.collection("organization")
            docs = [doc async for doc in org_collection.limit(1).stream()]
            
            if docs:
                # Update existing organization document
                org_doc_ref = docs[0].reference
                await org_doc_ref.update({
                    "logo_url": public_url,
                    "updated_at": firestore.SERVER_TIMESTAMP
                })
            else:
                # Create new organization document if none exists
                org_doc_ref = org_collection.document()
                await org_doc_ref.set({
                    "logo_url": public_url,
                    "created_at": firestore.SERVER_TIMESTAMP,
                    "updated_at": firestore.SERVER_TIMESTAMP
                })
                
        except Exception as e:
            # Log the error but don't fail the upload
            print(f"Warning: Failed to update organization settings with new logo URL: {str(e)}")
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={
                "success": True,
                "logo_url": public_url,
                "message": "Organization logo uploaded and updated successfully"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload organization logo: {str(e)}"
        )
    finally:
        # Ensure file is closed
        await file.close()