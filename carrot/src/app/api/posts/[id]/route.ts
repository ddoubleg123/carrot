import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';
import { auth } from '../../../../auth';
import { projectPost } from '../_project';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/posts/[id] - fetch a single post (normalized for modal)
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        User: {
          select: {
            id: true,
            username: true,
            image: true,
            profilePhoto: true,
            profilePhotoPath: true,
            country: true, // treat as homeCountry
          },
        },
      },
    });
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Parse imageUrls if serialized
    const row: any = { ...post };
    if (typeof row.imageUrls === 'string') {
      try { row.imageUrls = JSON.parse(row.imageUrls); } catch {}
    }
    const dto = projectPost(row);
    return NextResponse.json(dto);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}

// PATCH /api/posts/[id] - update a post (for audio URL updates)
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: postId } = await context.params;
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
    // Prepare content update (optional)
    const contentUpdate: any = {};
    if (typeof body?.content === 'string') {
      const next = String(body.content).trim();
      // Enforce 0..1000 chars (align with Composer)
      if (next.length > 1000) {
        return NextResponse.json({ error: 'Content too long (max 1000)' }, { status: 400 });
      }
      contentUpdate.content = next;
      contentUpdate.editedAt = new Date();
      contentUpdate.editCount = { increment: 1 } as any;
      contentUpdate.lastEditedBy = session.user.id;
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        ...(body.audioUrl && { audioUrl: body.audioUrl }),
        ...(body.transcriptionStatus && { transcriptionStatus: body.transcriptionStatus }),
        ...(body.audioTranscription && { audioTranscription: body.audioTranscription }),
        ...contentUpdate,
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            profilePhoto: true,
            username: true,
          },
        },
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
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const t0 = Date.now();
    const { id } = await context.params;
    console.log('🗑️ DELETE /api/posts/[id] start', { id });
    const session = await auth();
    const tAuth = Date.now();
    console.log('🗑️ auth() completed in ms:', tAuth - t0);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const postId = id as string;
    
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
