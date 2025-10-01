import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, context: { params: Promise<{}> }) {
  try {
    const { tempPatchId, realPatchId } = await req.json();

    if (!tempPatchId || !realPatchId) {
      return NextResponse.json({ error: 'Both tempPatchId and realPatchId are required' }, { status: 400 });
    }

    // Update all discovered content with the temporary patch ID to use the real patch ID
    const updated = await prisma.discoveredContent.updateMany({
      where: {
        patchId: tempPatchId
      },
      data: {
        patchId: realPatchId
      }
    });

    return NextResponse.json({
      success: true,
      updatedCount: updated.count,
      message: `Updated ${updated.count} discovered content items`
    });

  } catch (error) {
    console.error('Error updating discovery patch ID:', error);
    return NextResponse.json(
      { error: 'Failed to update discovery patch ID' },
      { status: 500 }
    );
  }
}
