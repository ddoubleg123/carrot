import { NextResponse } from 'next/server';

export async function GET() {
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
