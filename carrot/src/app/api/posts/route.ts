import { NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { auth } from '@/auth';
import { projectPost } from './_project';
import { cache, cacheKeys, cacheTTL } from '../../../lib/cache';
import { createResilientFetch } from '@/lib/retryUtils';

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
    // Cloudflare fields removed for Firebase-only plan
  } = body;
  // Attempt to derive a durable storage path from a Firebase thumbnail URL
  const deriveThumbInfo = (u?: string | null): { url?: string | null; path?: string | null } => {
    if (!u || typeof u !== 'string') return { url: u || null, path: null };
    try {
      const url = new URL(u);
      const host = url.hostname;
      const sp = url.searchParams;
      let path: string | undefined;
      let originalPath: string | undefined;
      // firebasestorage.googleapis.com/v0/b/<bucket>/o/<ENCODED_PATH>
      const m1 = url.pathname.match(/\/v0\/b\/([^/]+)\/o\/(.+)$/);
      if (host === 'firebasestorage.googleapis.com' && m1) {
        path = decodeURIComponent(m1[2]);
        originalPath = m1[2];
      }
      // <sub>.appspot.com/o/<ENCODED_PATH>
      if (!path) {
        const m4 = url.pathname.match(/^\/o\/([^?]+)$/);
        if (host.endsWith('.appspot.com') && m4) {
          path = decodeURIComponent(m4[1]);
          originalPath = m4[1];
        }
      }
      // Generic: any /o/<ENCODED_PATH>
      if (!path) {
        const m3 = url.pathname.match(/\/o\/([^?]+)$/);
        if (m3) {
          path = decodeURIComponent(m3[1]);
          originalPath = m3[1];
        }
      }
      // Build normalized URL that ensures alt=media is present and preserves token if any
      let normalized: string | null = null;
      try {
        if (host === 'firebasestorage.googleapis.com') {
          const m = url.pathname.match(/\/v0\/b\/([^/]+)\/o\/(.+)$/);
          if (m) {
            const bucket = decodeURIComponent(m[1]);
            const encPath = (originalPath && path && originalPath !== path) ? originalPath : encodeURIComponent(path || '');
            const token = sp.get('token');
            const durable = new URL(`https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encPath}?alt=media`);
            if (token) durable.searchParams.set('token', token);
            normalized = durable.toString();
          }
        } else if (host.endsWith('.appspot.com') && path) {
          const enc = (originalPath && originalPath !== path) ? originalPath : encodeURIComponent(path);
          const token = sp.get('token');
          const durable = new URL(`https://${host}/o/${enc}?alt=media`);
          if (token) durable.searchParams.set('token', token);
          normalized = durable.toString();
        }
      } catch {}
      return { url: normalized || u, path: path || null };
    } catch {
      return { url: u, path: null };
    }
  };
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
        // Cloudflare fields removed in Firebase-only plan
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
    
    // Normalize Firebase/Storage signed URLs to durable alt=media path form to avoid ExpiredToken later
    const normalizeVideoUrl = (u?: string | null): string | null => {
      if (!u || typeof u !== 'string') return null;
      try {
        const url = new URL(u);
        const host = url.hostname;
        const sp = url.searchParams;
        const isStorage = host.includes('firebasestorage.googleapis.com') || host.includes('storage.googleapis.com') || host.endsWith('.appspot.com');
        // If it's not a Google storage URL, leave as-is
        if (!isStorage) return u;
        // Try to extract bucket and path
        let bucket: string | undefined;
        let path: string | undefined;
        let originalPath: string | undefined;
        
        // firebasestorage.googleapis.com/v0/b/<bucket>/o/<ENCODED_PATH>
        const m1 = url.pathname.match(/\/v0\/b\/([^/]+)\/o\/(.+)$/);
        if (host === 'firebasestorage.googleapis.com' && m1) {
          bucket = decodeURIComponent(m1[1]);
          // Keep .appspot.com bucket names as-is for modern Firebase projects
          if (bucket.endsWith('.appspot.com')) {
            console.log('[posts] Keeping Firebase bucket name:', bucket);
          }
          path = decodeURIComponent(m1[2]);
          originalPath = m1[2];
        }
        // storage.googleapis.com/<bucket>/<path>
        if (!bucket || !path) {
          const m2 = url.pathname.match(/^\/([^/]+)\/(.+)$/);
          if (host === 'storage.googleapis.com' && m2) {
            bucket = decodeURIComponent(m2[1]);
            path = decodeURIComponent(m2[2]);
            originalPath = m2[2];
          }
        }
        // <sub>.appspot.com/o/<ENCODED_PATH>
        if (!bucket || !path) {
          const m4 = url.pathname.match(/^\/o\/([^?]+)$/);
          if (host.endsWith('.appspot.com') && m4) {
            path = decodeURIComponent(m4[1]);
            originalPath = m4[1];
            // Infer bucket from GoogleAccessId if present
            const ga = sp.get('GoogleAccessId') || '';
            const projectMatch = ga.match(/@([a-z0-9-]+)\.iam\.gserviceaccount\.com$/i);
            if (projectMatch) bucket = `${projectMatch[1]}.appspot.com`;
          }
        }
        // Generic: any /o/<ENCODED_PATH> segment, infer bucket
        if (!bucket || !path) {
          const m3 = url.pathname.match(/\/o\/([^?]+)$/);
          if (m3) {
            path = decodeURIComponent(m3[1]);
            originalPath = m3[1];
            const ga = sp.get('GoogleAccessId') || '';
            const projectMatch = ga.match(/@([a-z0-9-]+)\.iam\.gserviceaccount\.com$/i);
            if (projectMatch) bucket = `${projectMatch[1]}.appspot.com`;
          }
        }
        if (bucket && path) {
          // Don't re-encode the path if it's already properly encoded
          // Check if the original path was already encoded by comparing with the original URL
          const encPath = (originalPath === path) ? encodeURIComponent(path) : originalPath;
          const token = sp.get('token');
          const durable = new URL(`https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encPath}?alt=media`);
          if (token) durable.searchParams.set('token', token);
          return durable.toString();
        }
        // As a fallback, ensure alt=media for firebase endpoint
        if (host === 'firebasestorage.googleapis.com' && !sp.has('alt')) {
          url.searchParams.set('alt', 'media');
          return url.toString();
        }
        return u;
      } catch {
        return u || null;
      }
    };
    // If an externalUrl is provided and no explicit media URLs exist, default it to videoUrl
    let effectiveVideoUrl = normalizeVideoUrl(videoUrl || (externalUrl && !audioUrl ? externalUrl : null));
    // Persist a server-owned playable URL if normalization failed but externalUrl exists
    if (!effectiveVideoUrl && externalUrl && !audioUrl) {
      try {
        const base = process.env.NEXTAUTH_URL || 'https://carrot-app.onrender.com';
        const enc = encodeURIComponent(String(externalUrl));
        effectiveVideoUrl = `${base}/api/video?url=${enc}`;
        console.log('[POST /api/posts] using proxy URL for playback');
      } catch {}
    }
    const effectiveAudioUrl = audioUrl || null;
    // Coerce gradients to safe strings so Prisma includes them in INSERT
    const gDir = typeof gradientDirection === 'string' && gradientDirection ? gradientDirection : 'to-br';
    // Provide safe defaults to prevent missing gradients
    const DEFAULT_FROM = '#0f172a';
    const DEFAULT_VIA = '#1f2937';
    const DEFAULT_TO = '#0f172a';
    const gFrom = typeof gradientFromColor === 'string' && gradientFromColor ? gradientFromColor : DEFAULT_FROM;
    const gVia = typeof gradientViaColor === 'string' && gradientViaColor ? gradientViaColor : DEFAULT_VIA;
    const gTo = typeof gradientToColor === 'string' && gradientToColor ? gradientToColor : DEFAULT_TO;
    if (process.env.NODE_ENV !== 'production') {
      try {
        console.debug('POST /api/posts media+gradient snapshot:', {
          effectiveVideoUrl: !!effectiveVideoUrl,
          effectiveAudioUrl: !!effectiveAudioUrl,
          gDir, gFrom, gVia, gTo,
        });
      } catch {}
    }

    // Normalize incoming thumbnail if present and capture thumbPath
    const thumbInfo = deriveThumbInfo(thumbnailUrl);
    const safeThumbUrl = thumbInfo.url ?? thumbnailUrl ?? null;

    // Create post first
    const post = await prisma.post.create({
      data: {
        userId: session.user.id,
        content,
        gradientDirection: gDir,
        gradientFromColor: gFrom,
        gradientViaColor: gVia,
        gradientToColor: gTo,
        imageUrls: Array.isArray(imageUrls)
          ? JSON.stringify(imageUrls)
          : typeof imageUrls === 'string'
            ? JSON.stringify([imageUrls])
            : '[]',
        videoUrl: effectiveVideoUrl,
        thumbnailUrl: safeThumbUrl,
        gifUrl,
        audioUrl: effectiveAudioUrl,
        audioTranscription,
        transcriptionStatus: (effectiveAudioUrl || effectiveVideoUrl) ? 'pending' : null,
        // Cloudflare fields removed in Firebase-only plan
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
    
    // Create or update corresponding media asset for gallery display
    if (effectiveVideoUrl || effectiveAudioUrl || (imageUrls && imageUrls.length > 0)) {
      const mediaUrl = effectiveVideoUrl || effectiveAudioUrl || (Array.isArray(imageUrls) ? imageUrls[0] : imageUrls);
      const mediaType = effectiveVideoUrl ? 'video' : (effectiveAudioUrl ? 'audio' : 'image');
      
      if (mediaUrl) {
        try {
          // Check if media asset already exists
          const existingAsset = await prisma.mediaAsset.findFirst({
            where: { userId: session.user.id, url: mediaUrl }
          });

          if (existingAsset) {
            // Update existing asset with thumbnail if we have one
            if (safeThumbUrl && !existingAsset.thumbUrl) {
              await prisma.mediaAsset.update({
                where: { id: existingAsset.id },
                data: { thumbUrl: safeThumbUrl }
              });
            }
          } else {
            // Create new media asset
            await prisma.mediaAsset.create({
              data: {
                userId: session.user.id,
                url: mediaUrl,
                type: mediaType,
                title: content?.slice(0, 80) || null,
                thumbUrl: safeThumbUrl,
                source: 'post'
              }
            });
          }
        } catch (e) {
          console.warn('[POST /api/posts] Failed to create/update media asset:', e);
          // Non-fatal error, continue
        }
      }
    }
    
    // Invalidate posts cache when new post is created
    cache.delete(cacheKeys.posts());
    try {
      console.log('[POST /api/posts] persisted media+gradients', {
        postId: post.id,
        videoUrl: !!post.videoUrl,
        audioUrl: !!post.audioUrl,
        thumbnailUrl: !!post.thumbnailUrl,
        gDir: post.gradientDirection,
        gFrom: post.gradientFromColor,
        gVia: post.gradientViaColor,
        gTo: post.gradientToColor,
      });
    } catch {}

    // Ensure gallery/media entry exists for the video (best-effort)
    if (effectiveVideoUrl) {
      try {
        const exists = await prisma.mediaAsset.findFirst({ where: { userId: session.user.id, url: effectiveVideoUrl } });
        if (!exists) {
          const createdMedia = await (prisma as any).mediaAsset.create({
            data: {
              userId: session.user.id,
              url: effectiveVideoUrl || null,
              type: 'video',
              title: (content && typeof content === 'string') ? content.slice(0, 80) : null,
              thumbUrl: safeThumbUrl || null,
              thumbPath: thumbInfo.path || null,
              source: 'post',
              // CF fields removed
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
            await (prisma as any).mediaAsset.create({
              data: {
                userId: session.user.id,
                url: effectiveVideoUrl || null,
                type: 'video',
                title: (content && typeof content === 'string') ? content.slice(0, 80) : null,
                thumbUrl: safeThumbUrl || null,
                thumbPath: thumbInfo.path || null,
                source: 'post-retry',
                // CF fields removed
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
        const resilientFetch = createResilientFetch();
        resilientFetch(`${process.env.NEXTAUTH_URL || 'https://carrot-app.onrender.com'}/api/audio/trigger-transcription`, {
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

    // If trim parameters are provided, kick off ingest/trim job via internal API
    let trimJobId: string | null = null;
    try {
      const { trimInMs, trimOutMs, trimAspect } = body || {};
      if ((typeof trimInMs === 'number' || typeof trimOutMs === 'number') && effectiveVideoUrl) {
        const base = process.env.NEXTAUTH_URL || 'https://carrot-app.onrender.com';
        const resilientFetch = createResilientFetch();
        const resp = await resilientFetch(`${base}/api/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: effectiveVideoUrl, inMs: trimInMs ?? null, outMs: trimOutMs ?? null, aspect: trimAspect ?? null, postId: post.id }),
        });
        if (resp.ok) {
          const data = await resp.json().catch(() => null);
          trimJobId = data?.job?.id || null;
          console.log('[POST /api/posts] ingest trim job started', { trimJobId });
        } else {
          const et = await resp.text().catch(() => '');
          console.warn('[POST /api/posts] failed to start ingest trim job', resp.status, et?.slice(0,200));
        }
      }
    } catch (e) {
      console.warn('[POST /api/posts] exception while starting trim job', e);
    }

    // Return projected DTO (parse imageUrls if needed)
    const row: any = { ...post };
    if (typeof row.imageUrls === 'string') { try { row.imageUrls = JSON.parse(row.imageUrls); } catch {} }
    const dto: any = projectPost(row);
    if (trimJobId) {
      dto.status = 'processing';
      dto.trimJobId = trimJobId;
    }
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
  try { {
    // In mock feed mode, avoid touching the database and return an empty list
    if (process.env.NEXT_PUBLIC_USE_MOCK_FEED === '1') {
      if (process.env.NODE_ENV !== 'production') {
        try { console.warn('[api/posts] Mock mode enabled, returning 0 posts.'); } catch {}
      }
      return NextResponse.json([]);
    }
    
    // Check cache first
    const cacheKey = cacheKeys.posts();
    const cachedPosts = cache.get(cacheKey);
    
    if (cachedPosts) {
      console.log('[GET /api/posts] Cache hit, returning cached data');
      const response = NextResponse.json(cachedPosts);
      response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      response.headers.set('CDN-Cache-Control', 'public, s-maxage=300');
      response.headers.set('X-Cache', 'HIT');
      return response;
    }

    console.log('[GET /api/posts] Cache miss, fetching from database');
    // Add caching for frequently accessed posts data
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
    try {
      const total = shaped.length;
      const missingGrad = shaped.filter((x: any) => !x.gradientFromColor || !x.gradientToColor).length;
      const signedUrls = shaped.filter((x: any) => typeof x.videoUrl === 'string' && x.videoUrl.includes('GoogleAccessId=')).length;
      console.log('[GET /api/posts] summary', { total, missingGrad, signedUrls });
    } catch {}
    // Store in cache for future requests
    cache.set(cacheKey, shaped, cacheTTL.posts);
    
    // Add caching headers for better performance
    const response = NextResponse.json(shaped);
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    response.headers.set('CDN-Cache-Control', 'public, s-maxage=300');
    response.headers.set('X-Cache', 'MISS');
    return response;
  }
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
