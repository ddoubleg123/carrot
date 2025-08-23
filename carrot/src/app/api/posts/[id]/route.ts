import { NextRequest, NextResponse } from 'next/server';
import { auth } from '../../../../auth';
import { prisma } from '@/lib/prisma';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Uses shared Prisma singleton from '@/lib/prisma'

// PATCH /api/posts/[id] - update a post (for audio URL updates)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const postId = params.id;
    const body = await request.json();
    
    // First, check if the post exists and if the user is the owner
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true }
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Check if the current user is the owner of the post
    if (post.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden: You can only update your own posts' }, { status: 403 });
    }

    // Update the post with provided fields
    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        ...(body.audioUrl && { audioUrl: body.audioUrl }),
        ...(body.transcriptionStatus && { transcriptionStatus: body.transcriptionStatus }),
        ...(body.audioTranscription && { audioTranscription: body.audioTranscription }),
      },
      include: { 
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true
          }
        }
      },
    });

    console.log(`✅ PATCH /api/posts/[id] - Post ${postId} updated successfully`);

    // Trigger transcription if audio URL was added
    if (body.audioUrl && body.transcriptionStatus === 'processing') {
      try {
        console.log(`🎵 Triggering transcription for updated post ${postId} with audio URL: ${body.audioUrl.substring(0, 80)}...`);
        
        // Use fire-and-forget approach - don't wait for response
        fetch(`http://localhost:3005/api/transcribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            postId: postId,
            audioUrl: body.audioUrl,
          }),
        }).then(async (transcriptionResponse) => {
          if (transcriptionResponse.ok) {
            console.log(`🎵 Background transcription triggered successfully for updated post ${postId}`);
          } else {
            console.error(`❌ Failed to trigger transcription for updated post ${postId}: ${transcriptionResponse.status}`);
            const errorText = await transcriptionResponse.text().catch(() => 'Unknown error');
            console.error(`❌ Transcription error details:`, errorText);
          }
        }).catch((transcriptionError) => {
          console.error(`❌ Transcription trigger failed for updated post ${postId}:`, transcriptionError);
        });
        
        console.log(`🎵 Background transcription request sent for updated post ${postId}`);
      } catch (transcriptionError) {
        console.error('Failed to trigger background transcription:', transcriptionError);
        // Don't fail the update if transcription trigger fails
      }
    }

    return NextResponse.json(updatedPost);

  } catch (error) {
    console.error('Error updating post:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const t0 = Date.now();
    console.log('🗑️ DELETE /api/posts/[id] start', { id: params?.id });
    const session = await auth();
    const tAuth = Date.now();
    console.log('🗑️ auth() completed in ms:', tAuth - t0);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const postId = params.id;
    
    // First, check if the post exists and if the user is the owner
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true }
    });
    const tFind = Date.now();
    console.log('🗑️ findUnique() completed in ms:', tFind - tAuth);

    if (!post) {
      // Gracefully handle optimistic deletes where the post was never persisted or already removed
      console.log('🗑️ Post not found; returning success');
      return NextResponse.json({ success: true, message: 'Post already deleted or never existed' });
    }

    // Check if the current user is the owner of the post
    if (post.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden: You can only delete your own posts' }, { status: 403 });
    }

    // Kick off delete without blocking the response to improve UX in dev
    // Any error will be logged server-side
    prisma.post.delete({ where: { id: postId } })
      .then(() => {
        console.log('🗑️ prisma.delete() completed in ms:', Date.now() - tFind, { id: postId });
      })
      .catch((e) => {
        console.error('🗑️ prisma.delete() failed', e);
      });

    // Return immediately; client UI can optimistically remove the post
    return NextResponse.json({ success: true, message: 'Post deletion scheduled' }, { status: 202 });

  } catch (error: any) {
    console.error('Error deleting post:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
