import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const sp = url.searchParams
  const rawUrl = sp.get('url')
  
  console.log('[debug/img] Debug request received', {
    rawUrl: rawUrl?.substring(0, 200),
    userAgent: req.headers.get('user-agent')?.substring(0, 50),
    referer: req.headers.get('referer')?.substring(0, 50),
    timestamp: new Date().toISOString()
  });

  // Check environment variables
  const envCheck = {
    GCS_SA_JSON: process.env.GCS_SA_JSON ? 'SET' : 'NOT SET',
    GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
    STORAGE_PUBLIC_BASE: process.env.STORAGE_PUBLIC_BASE || 'NOT SET',
    PUBLIC_THUMBNAIL_BASE: process.env.PUBLIC_THUMBNAIL_BASE || 'NOT SET'
  };

  console.log('[debug/img] Environment check', envCheck);

  // Try to test storage client
  let storageTest = 'NOT TESTED';
  try {
    const GCS = require('@google-cloud/storage');
    const storage = new GCS.Storage();
    storageTest = 'STORAGE_CLIENT_CREATED';
  } catch (e: any) {
    storageTest = `ERROR: ${e.message}`;
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    request: {
      rawUrl: rawUrl?.substring(0, 200),
      userAgent: req.headers.get('user-agent')?.substring(0, 50),
      referer: req.headers.get('referer')?.substring(0, 50)
    },
    environment: envCheck,
    storageTest,
    message: 'Debug endpoint - check server logs for detailed information'
  });
}

