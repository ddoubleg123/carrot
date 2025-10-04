import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ batchId: string }> }
) {
  try {
    const { batchId } = await context.params;
    
    if (!batchId) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Batch ID is required' 
      }, { status: 400 });
    }

    // For now, return a basic status response
    // This can be enhanced to check actual batch status from database
    return NextResponse.json({
      ok: true,
      batch: {
        id: batchId,
        status: 'completed',
        message: 'Batch processing completed',
        totals: {
          discovered: 0,
          fed: 0,
          failed: 0
        },
        tasks: [],
        updatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching batch status:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Failed to fetch batch status' 
    }, { status: 500 });
  }
}
