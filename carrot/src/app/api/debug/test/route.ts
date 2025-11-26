import { NextRequest, NextResponse } from 'next/server';
import { requireDebugAuth } from '@/lib/middleware/debugAuth';

export async function GET(request: NextRequest) {
  // Require org-admin auth
  const authResponse = await requireDebugAuth(request)
  if (authResponse) return authResponse
  
  try {
    // Test basic functionality
    const testData = {
      message: 'API is working',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
    };

    return NextResponse.json(testData);
  } catch (error) {
    console.error('Test API error:', error);
    return NextResponse.json({ 
      error: 'Test API failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
