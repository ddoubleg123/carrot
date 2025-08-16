import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';
import { auth } from '../../../auth';

// POST /api/posts - create a new post
export async function POST(req: NextRequest) {
  console.log('🚨 POST /api/posts - ROUTE ENTERED');
  
  const session = await auth();
  if (!session?.user?.id) {
    console.log('🚨 POST /api/posts - UNAUTHORIZED');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  console.log('🚨 POST /api/posts - SESSION VALID');
  const body = await req.json();
  if (process.env.NODE_ENV !== 'production') {
    try {
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
  } = body;
  try {
    console.log(`🔍 POST /api/posts - Creating post with audioUrl: ${audioUrl ? 'Present' : 'Missing'}`);
    console.log(`🔍 POST /api/posts - User ID: ${session.user.id}`);
    
    // If an externalUrl is provided and no explicit media URLs exist, default it to videoUrl
    const effectiveVideoUrl = videoUrl || (externalUrl && !audioUrl ? externalUrl : null);
    const effectiveAudioUrl = audioUrl || null;

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
            username: true,
          }
        }
      },
    });

    console.log(`✅ POST /api/posts - Post created successfully with ID: ${post.id}`);
    console.log(`🔍 POST /api/posts - Post audioUrl: ${post.audioUrl ? 'Present' : 'Missing'}`);
    console.log(`🔍 POST /api/posts - Transcription status: ${post.transcriptionStatus}`);

    // Trigger background transcription for audio and video posts
    if (process.env.NODE_ENV !== 'production') {
      console.debug('Derived media URLs:', { effectiveAudioUrl, effectiveVideoUrl });
    }
    if (effectiveAudioUrl || effectiveVideoUrl) {
      try {
        const mediaUrl = effectiveAudioUrl || effectiveVideoUrl;
        const mediaType = effectiveAudioUrl ? 'audio' : 'video';
        console.log(`🎵 Triggering transcription for post ${post.id} with ${mediaType} URL: ${mediaUrl.substring(0, 80)}...`);
        
        // Use fire-and-forget approach - don't wait for response
        fetch(`http://localhost:3005/api/transcribe`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            postId: post.id,
            audioUrl: effectiveAudioUrl || null,
            videoUrl: effectiveVideoUrl || null,
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

    return NextResponse.json(post, { status: 201 });
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
export async function GET() {
  try {
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
            username: true,
          }
        }
      },
    });
    if (process.env.NODE_ENV !== 'production') {
      console.debug('GET /api/posts fetched posts:', posts.length);
    }
    return NextResponse.json(posts);
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
