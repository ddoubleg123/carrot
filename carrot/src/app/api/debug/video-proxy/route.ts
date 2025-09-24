import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // Check environment variables
    const envCheck = {
      FIREBASE_PROJECT_ID: !!process.env.FIREBASE_PROJECT_ID,
      FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
      FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
      FIREBASE_STORAGE_BUCKET: !!process.env.FIREBASE_STORAGE_BUCKET,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: !!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    };

    // Check if Firebase Admin SDK is available
    let adminStatus = 'not available';
    try {
      const admin = require('firebase-admin');
      adminStatus = 'available';
    } catch (error) {
      adminStatus = `error: ${error instanceof Error ? error.message : String(error)}`;
    }

    // Test a simple video proxy request
    const testUrl = 'https://firebasestorage.googleapis.com/v0/b/involuted-river-466315-p0.firebasestorage.app/o/users%252F6937a112-4c93-4bd2-a4a6-3972a3bb61fd%252Fposts%252F1758665445272_0_benjamin%2520h%2520freedman%25201961%2520speech%2520at%2520the%2520willard%2520hotel.mp4%3Falt%3Dmedia%26token%3Da69fcc02-8464-46b0-babb-1b1f0befa9ce';
    
    let proxyTest = 'not tested';
    try {
      const response = await fetch(`http://localhost:3000/api/video?url=${encodeURIComponent(testUrl)}`);
      proxyTest = `status: ${response.status}`;
    } catch (error) {
      proxyTest = `error: ${error.message}`;
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: envCheck,
      firebaseAdmin: adminStatus,
      proxyTest,
      nodeVersion: process.version,
      platform: process.platform,
    });
  } catch (error) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
