import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const credentials = {
      gcs_sa_json_exists: !!process.env.GCS_SA_JSON,
      google_app_creds_exists: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      firebase_storage_bucket: process.env.FIREBASE_STORAGE_BUCKET,
      firebase_project_id: process.env.FIREBASE_PROJECT_ID,
      firebase_client_email: process.env.FIREBASE_CLIENT_EMAIL ? '***' : 'NOT_SET',
      firebase_private_key: process.env.FIREBASE_PRIVATE_KEY ? '***' : 'NOT_SET',
    };

    // Test Firebase Storage connection
    let storageTest = 'NOT_TESTED';
    try {
      const { Storage } = require('@google-cloud/storage');
      let storage;
      
      if (process.env.GCS_SA_JSON) {
        const creds = JSON.parse(process.env.GCS_SA_JSON);
        storage = new Storage({
          projectId: creds.project_id,
          credentials: {
            client_email: creds.client_email,
            private_key: creds.private_key,
          },
        });
      } else {
        storage = new Storage();
      }
      
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'involuted-river-466315-p0.firebasestorage.app';
      const bucket = storage.bucket(bucketName);
      const [files] = await bucket.getFiles({ maxResults: 1 });
      
      storageTest = `SUCCESS - Found ${files.length} files`;
      
      // Test signed URL generation
      if (files.length > 0) {
        const file = files[0];
        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 60 * 60 * 1000,
        });
        storageTest += ` - Signed URL generated successfully`;
      }
      
    } catch (error: any) {
      storageTest = `ERROR: ${error.message}`;
    }

    return NextResponse.json({
      credentials,
      storageTest,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
