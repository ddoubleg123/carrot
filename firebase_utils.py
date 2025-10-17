# firebase_utils.py
import os
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, storage

_initialized = False

def init_firebase():
    global _initialized
    if _initialized:
        return
    cred_path = os.environ.get("FIREBASE_CREDENTIALS", "")
    bucket_name = os.environ.get("FIREBASE_BUCKET", "")
    
    if not cred_path or not bucket_name:
        print("Warning: Firebase credentials not configured")
        return
    
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred, {"storageBucket": bucket_name})
    _initialized = True

def save_png_bytes_and_get_url(png_bytes: bytes, filename_prefix: str = "sdxl"):
    try:
        init_firebase()
        if not _initialized:
            return None
        
        bucket = storage.bucket()
        ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
        blob = bucket.blob(f"images/{filename_prefix}_{ts}.png")
        blob.upload_from_string(png_bytes, content_type="image/png")
        # Make public (or use signed URL depending on your policy)
        blob.make_public()
        return blob.public_url
    except Exception as e:
        print(f"Error saving to Firebase: {e}")
        return None
