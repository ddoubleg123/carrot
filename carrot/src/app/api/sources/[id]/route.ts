import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check if source exists and user has permission to delete it
    const source = await prisma.source.findUnique({
      where: { id },
      select: { 
        id: true, 
        addedBy: true,
        patch: {
          select: { createdBy: true }
        }
      }
    });

    if (!source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // Check if user is the creator of the source or the patch owner
    const isSourceCreator = source.addedBy === session.user.id;
    const isPatchOwner = source.patch.createdBy === session.user.id;

    if (!isSourceCreator && !isPatchOwner) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Delete the source
    await prisma.source.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Delete Source] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
