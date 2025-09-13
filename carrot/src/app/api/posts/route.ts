import { NextResponse } from 'next/server';
import { runtime } from 'node:process';
import prisma from '../../../lib/prisma';
import { auth } from '@/auth';
import { projectPost } from './_project';

// POST /api/posts - create a new post
export async function POST(req: Request, _ctx: { params: Promise<{}> }) {
  console.log('🚨 POST /api/posts - ROUTE ENTERED');
  
  // Resolve session via NextAuth v5 pattern
  const session: any = await auth();
  if (!session?.user?.id) {
    console.log('🚨 POST /api/posts - UNAUTHORIZED');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  console.log('🚨 POST /api/posts - SESSION VALID');
  const body = await req.json();
  const idemKey = req.headers.get('idempotency-key') || null;
  if (process.env.NODE_ENV !== 'production') {
    try {
    // Best-effort idempotency: if the same user just created a post with the same videoUrl & content in the last 5 minutes, reuse it
    if (idemKey || (body?.videoUrl && body?.content)) {
      const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
      const existing = await prisma.post.findFirst({
        where: {
          userId: session.user.id,
          createdAt: { gte: fiveMinAgo },
          ...(body?.videoUrl ? { videoUrl: body.videoUrl } : {}),
          ...(body?.content ? { content: body.content } : {}),
        },
        include: {
          User: { select: { id: true, name: true, email: true, image: true, profilePhoto: true, profilePhotoPath: true, country: true, username: true } }
        }
      });
      if (existing) {
        const row: any = { ...existing };
        if (typeof row.imageUrls === 'string') { try { row.imageUrls = JSON.parse(row.imageUrls); } catch {} }
        return NextResponse.json(projectPost(row), { status: 200, headers: idemKey ? { 'Idempotency-Key': idemKey } : undefined });
      }
    }
      console.debug('POST /api/posts payload keys:', Object.keys(body));
    } catch {}
  }
  const {
    content,
    gradientDirection,
    gradientFromColor,
    gradientViaColor,
    gradientToColor,
    imageUrls,
    videoUrl,
    thumbnailUrl,
    gifUrl,
    audioUrl,
    audioTranscription,
    emoji,
    carrotText,
    stickText,
    externalUrl,
    // Cloudflare Stream fields (optional on create)
    cfUid,
    cfStatus,
  } = body;
  try {
    // In mock feed mode, avoid DB and echo a fake-created post for local testing
    if (process.env.NEXT_PUBLIC_USE_MOCK_FEED === '1') {
      const now = new Date().toISOString();
      const fakeId = `post-${Date.now()}`;
      const effectiveVideoUrl = videoUrl || (externalUrl && !audioUrl ? externalUrl : null);
      const effectiveAudioUrl = audioUrl || null;
      const post: any = {
        id: fakeId,
        userId: session.user.id,
        content: content || '',
        gradientDirection: gradientDirection || null,
        gradientFromColor: gradientFromColor || null,
        gradientViaColor: gradientViaColor || null,
        gradientToColor: gradientToColor || null,
        imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
        videoUrl: effectiveVideoUrl,
        thumbnailUrl: thumbnailUrl || null,
        gifUrl: gifUrl || null,
        audioUrl: effectiveAudioUrl,
        audioTranscription: audioTranscription || null,
        transcriptionStatus: (effectiveAudioUrl || effectiveVideoUrl) ? 'pending' : null,
        cfUid: cfUid || null,
        cfStatus: cfUid ? (cfStatus || 'queued') : null,
        emoji: emoji || '🎯',
        carrotText: carrotText || '',
        stickText: stickText || '',
        createdAt: now,
        updatedAt: now,
        User: {
          id: session.user.id,
          name: session.user.name || '',
          email: session.user.email,
          image: session.user.image || null,
          profilePhoto: (session.user as any).profilePhoto || null,
          username: (session.user as any).username || 'demo',
        },
      };
      // Normalize/shape via projector
    // Parse imageUrls JSON back to array for the projector if needed
    if (typeof post.imageUrls === 'string') {
      try { (post as any).imageUrls = JSON.parse(post.imageUrls); } catch {}
    }
    const dto = projectPost(post);
    return NextResponse.json(dto, { status: 201 });
    }

    console.log(`🔍 POST /api/posts - Creating post with audioUrl: ${audioUrl ? 'Present' : 'Missing'}`);
    console.log(`🔍 POST /api/posts - User ID: ${session.user.id}`);
    
    // If an externalUrl is provided and no explicit media URLs exist, default it to videoUrl
    const effectiveVideoUrl = videoUrl || (externalUrl && !audioUrl ? externalUrl : null);
    const effectiveAudioUrl = audioUrl || null;

    // Create post first
    const post = await prisma.post.create({
      data: {
        userId: session.user.id,
        content,
        gradientDirection,
        gradientFromColor,
        gradientViaColor,
        gradientToColor,
        imageUrls: Array.isArray(imageUrls)
          ? JSON.stringify(imageUrls)
          : typeof imageUrls === 'string'
            ? JSON.stringify([imageUrls])
            : '[]',
        videoUrl: effectiveVideoUrl,
        thumbnailUrl,
        gifUrl,
        audioUrl: effectiveAudioUrl,
        audioTranscription,
        transcriptionStatus: (effectiveAudioUrl || effectiveVideoUrl) ? 'pending' : null,
        // Persist Cloudflare Stream identifiers if present
        cfUid: cfUid || null,
        cfStatus: cfUid ? (cfStatus || 'queued') : null,
        emoji,
        carrotText,
        stickText,
      },
      include: { 
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            profilePhoto: true,
            profilePhotoPath: true,
            country: true,
            username: true,
          }
        }
      },
    });

    console.log(`✅ POST /api/posts - Post created successfully with ID: ${post.id}`);
    console.log(`🔍 POST /api/posts - Post audioUrl: ${post.audioUrl ? 'Present' : 'Missing'}`);
    console.log(`🔍 POST /api/posts - Transcription status: ${post.transcriptionStatus}`);

    // Ensure gallery/media entry exists for the video (best-effort)
    if (effectiveVideoUrl) {
      try {
        const exists = await prisma.mediaAsset.findFirst({ where: { userId: session.user.id, url: effectiveVideoUrl } });
        if (!exists) {
          const createdMedia = await prisma.mediaAsset.create({
            data: {
              userId: session.user.id,
              url: effectiveVideoUrl,
              type: 'video',
              title: (content && typeof content === 'string') ? content.slice(0, 80) : null,
              thumbUrl: thumbnailUrl || null,
              source: 'post',
            },
            select: { id: true }
          });
          console.log('📚 Media asset created for post video:', createdMedia.id);
        }
      } catch (e) {
        console.warn('⚠️ Failed to create media asset for video; will retry once shortly');
        try {
          await new Promise(r => setTimeout(r, 1000));
          const exists2 = await prisma.mediaAsset.findFirst({ where: { userId: session.user.id, url: effectiveVideoUrl } });
          if (!exists2) {
            await prisma.mediaAsset.create({
              data: {
                userId: session.user.id,
                url: effectiveVideoUrl,
                type: 'video',
                title: (content && typeof content === 'string') ? content.slice(0, 80) : null,
                thumbUrl: thumbnailUrl || null,
                source: 'post-retry',
              },
              select: { id: true }
            });
            console.log('📚 Media asset created on retry.');
          }
        } catch {}
      }
    }

    // Trigger background transcription for audio and video posts
    if (process.env.NODE_ENV !== 'production') {
      console.debug('Derived media URLs:', { effectiveAudioUrl, effectiveVideoUrl });
    }
    if (effectiveAudioUrl || effectiveVideoUrl) {
      try {
        const mediaUrl = effectiveAudioUrl || effectiveVideoUrl;
        const mediaType = effectiveAudioUrl ? 'audio' : 'video';
        console.log(`🎵 Triggering transcription for post ${post.id} with ${mediaType} URL: ${mediaUrl.substring(0, 80)}...`);
        
        // Use fire-and-forget approach - trigger transcription via internal API
        fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3005'}/api/audio/trigger-transcription`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            postId: post.id,
            audioUrl: effectiveAudioUrl || effectiveVideoUrl,
          }),
        }).then(async (transcriptionResponse) => {
          if (transcriptionResponse.ok) {
            console.log(`🎵 Background transcription triggered successfully for ${mediaType} post ${post.id}`);
          } else {
            console.error(`❌ Failed to trigger transcription for ${mediaType} post ${post.id}: ${transcriptionResponse.status}`);
            const errorText = await transcriptionResponse.text().catch(() => 'Unknown error');
            console.error(`❌ Transcription error details:`, errorText);
          }
        }).catch((transcriptionError) => {
          console.error(`❌ Transcription trigger failed for ${mediaType} post ${post.id}:`, transcriptionError);
        });
        
        console.log(`🎵 Background transcription request sent for ${mediaType} post ${post.id}`);
      } catch (transcriptionError) {
        console.error('Failed to trigger background transcription:', transcriptionError);
        // Don't fail the post creation if transcription trigger fails
      }
    }

    // Return projected DTO (parse imageUrls if needed)
    const row: any = { ...post };
    if (typeof row.imageUrls === 'string') { try { row.imageUrls = JSON.parse(row.imageUrls); } catch {} }
    const dto = projectPost(row);
    return NextResponse.json(dto, { status: 201, headers: idemKey ? { 'Idempotency-Key': idemKey } : undefined });
  } catch (error) {
    console.error('💥 Detailed error creating post:', error);
    if (error instanceof Error) {
      console.error('💥 Error name:', error.name);
      console.error('💥 Error message:', error.message);
      console.error('💥 Error stack:', error.stack);
    }
    return NextResponse.json({ 
      error: 'Failed to create post',
      details: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'UnknownError'
    }, { status: 500 });
  }
}

// GET /api/posts - get all posts (latest first)
export async function GET(_req: Request, _ctx: { params: Promise<{}> }) {
  try {
    // In mock feed mode, avoid touching the database and return an empty list
    if (process.env.NEXT_PUBLIC_USE_MOCK_FEED === '1') {
      if (process.env.NODE_ENV !== 'production') {
        try { console.warn('[api/posts] Mock mode enabled, returning 0 posts.'); } catch {}
      }
      return NextResponse.json([]);
    }
    const posts = await prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      include: { 
        User: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            profilePhoto: true,
            profilePhotoPath: true,
            country: true,
            username: true,
          }
        }
      },
    });
    // Parse imageUrls and project
    const shaped = posts.map(p => {
      const r: any = { ...p };
      if (typeof r.imageUrls === 'string') {
        try { r.imageUrls = JSON.parse(r.imageUrls); } catch {}
      }
      return projectPost(r);
    });
    if (process.env.NODE_ENV !== 'production') {
      console.debug('GET /api/posts fetched posts:', shaped.length);
    }
    return NextResponse.json(shaped);
  } catch (error) {
    console.error('💥 Detailed error fetching posts:', error);
    if (error instanceof Error) {
      console.error('💥 Error name:', error.name);
      console.error('💥 Error message:', error.message);
      console.error('💥 Error stack:', error.stack);
    }
    return NextResponse.json({ 
      error: 'Failed to fetch posts',
      details: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'UnknownError'
    }, { status: 500 });
  }
}
