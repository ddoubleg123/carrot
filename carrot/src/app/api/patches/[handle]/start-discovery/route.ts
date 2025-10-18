import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  console.log('[Start Discovery] POST endpoint called');
  
  // Check if SSE streaming is requested
  const url = new URL(request.url)
  const isStreaming = url.searchParams.get('stream') === 'true'
  
  try {
    const session = await auth();
    console.log('[Start Discovery] Session check:', session ? 'Found' : 'Not found');
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { handle } = await params;
    const body = await request.json().catch(() => ({ action: 'start_deepseek_search' }));
    const { action } = body;

    if (action !== 'start_deepseek_search') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Get the patch to access its tags and description
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: {
        id: true,
        name: true,
        description: true,
        tags: true,
        createdBy: true
      }
    });

    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 });
    }

    // Check if user has permission to start discovery
    const isOwner = patch.createdBy === session.user.id;
    const isMember = await prisma.patchMember.findUnique({
      where: {
        patch_user_member_unique: {
          patchId: patch.id,
          userId: session.user.id
        }
      }
    });

    if (!isOwner && !isMember) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Check if DeepSeek API key is configured
    if (!process.env.DEEPSEEK_API_KEY) {
      console.error('[Start Discovery] DEEPSEEK_API_KEY not configured', {
        patchId: patch.id,
        handle,
        userId: session.user.id,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json({ 
        error: 'Discovery service not configured. Please set DEEPSEEK_API_KEY environment variable.',
        code: 'MISSING_API_KEY',
        patchId: patch.id
      }, { status: 500 });
    }

    // Start DeepSeek-powered content discovery
    console.log('[Start Discovery] Starting DeepSeek search for patch:', {
      patchId: patch.id,
      handle,
      name: patch.name,
      tags: patch.tags,
      description: patch.description
    });

    // Call DeepSeek API to search for relevant content
    const deepSeekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `You are a research assistant that finds high-quality, relevant content about specific topics. 
            Given a topic name, description, and tags, you should search for and return URLs to authoritative sources, 
            recent articles, academic papers, videos, and other educational content that would be valuable for learning about this topic.
            
            Focus on:
            - Academic sources and research papers
            - News articles from reputable sources
            - Educational videos and documentaries
            - Government and institutional reports
            - Expert analysis and commentary
            
            Return your findings as a JSON array of objects with this structure:
            [
              {
                "title": "Content title",
                "url": "https://example.com/article",
                "type": "article|video|paper|report|news",
                "description": "Brief description of the content",
                "relevance_score": 0.95,
                "source_authority": "high|medium|low"
              }
            ]
            
            Only return content that is highly relevant (relevance_score > 0.7) and from authoritative sources.`
          },
          {
            role: 'user',
            content: `Find high-quality content about: "${patch.name}"
            
            Description: ${patch.description || 'No description provided'}
            
            Tags: ${patch.tags.join(', ')}
            
            Please search for and return relevant, authoritative content that would help someone learn about this topic.`
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })
    });

    if (!deepSeekResponse.ok) {
      console.error('[Start Discovery] DeepSeek API error:', {
        status: deepSeekResponse.status,
        statusText: deepSeekResponse.statusText,
        patchId: patch.id,
        handle,
        userId: session.user.id,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json({ 
        error: 'Failed to search for content',
        code: 'DEEPSEEK_API_ERROR',
        status: deepSeekResponse.status,
        patchId: patch.id
      }, { status: 500 });
    }

    const deepSeekData = await deepSeekResponse.json();
    const content = deepSeekData.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[Start Discovery] No content returned from DeepSeek');
      return NextResponse.json({ error: 'No content found' }, { status: 500 });
    }

    // Parse the JSON response from DeepSeek
    let discoveredItems;
    try {
      // Extract JSON from the response (it might be wrapped in markdown)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      discoveredItems = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('[Start Discovery] Failed to parse DeepSeek response:', parseError);
      return NextResponse.json({ error: 'Failed to parse search results' }, { status: 500 });
    }

    // If streaming, create SSE stream
    if (isStreaming) {
      const stream = new TransformStream()
      const writer = stream.writable.getWriter()
      const encoder = new TextEncoder()
      
      const sendEvent = (event: string, data: any) => {
        writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }
      
      // Process in background
      ;(async () => {
        try {
          sendEvent('state', { phase: 'searching' })
          sendEvent('heartbeat', {})
          
          // ... rest of processing will be here
          const savedItems: any[] = []
          const rejectedItems: any[] = []
          
          sendEvent('found', { count: discoveredItems.length })
          sendEvent('state', { phase: 'processing' })
          
          // Process items one by one
          for (let i = 0; i < discoveredItems.length; i++) {
            const item = discoveredItems[i]
            
            try {
              sendEvent('progress', { done: i, total: discoveredItems.length })
              
              // Verify relevance
              const relevanceScore = item.relevance_score || 0
              if (relevanceScore < 0.7) {
                console.log('[Start Discovery] ❌ Rejected (low relevance):', item.title)
                rejectedItems.push({ url: item.url, title: item.title, reason: 'low_relevance' })
                continue
              }
              
              // Generate AI image
              console.log('[Start Discovery] Generating AI image for:', item.title)
              const aiImageResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3005'}/api/ai/generate-hero-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: item.title,
                  summary: item.description || '',
                  contentType: item.type,
                  artisticStyle: 'photorealistic',
                  enableHiresFix: false
                })
              })
              
              let aiImageUrl = null
              let aiImageSource = 'fallback'
              
              if (aiImageResponse.ok) {
                const aiImageData = await aiImageResponse.json()
                if (aiImageData.success && aiImageData.imageUrl) {
                  aiImageUrl = aiImageData.imageUrl
                  aiImageSource = 'ai-generated'
                }
              }
              
              if (!aiImageUrl) {
                console.log('[Start Discovery] ❌ Rejected (no image):', item.title)
                rejectedItems.push({ url: item.url, title: item.title, reason: 'no_image' })
                continue
              }
              
              // Save to database
              const discoveredContent = await prisma.discoveredContent.create({
                data: {
                  patchId: patch.id,
                  type: item.type || 'article',
                  title: item.title,
                  content: item.description || '',
                  sourceUrl: item.url,
                  relevanceScore: relevanceScore,
                  tags: patch.tags.slice(0, 3),
                  status: 'ready',
                  mediaAssets: {
                    heroImage: {
                      url: aiImageUrl,
                      source: aiImageSource,
                      license: 'generated'
                    }
                  }
                }
              })
              
              // Send item-ready event with complete DiscoveredItem format
              sendEvent('item-ready', {
                id: discoveredContent.id,
                type: discoveredContent.type as 'article'|'video'|'pdf'|'image'|'text',
                title: discoveredContent.title,
                displayTitle: discoveredContent.title,
                url: discoveredContent.sourceUrl || '',
                canonicalUrl: discoveredContent.sourceUrl,
                status: 'ready' as const,
                media: {
                  hero: aiImageUrl,
                  source: aiImageSource as 'og'|'oembed'|'inline'|'video'|'pdf'|'image'|'generated',
                  license: 'generated' as const
                },
                content: {
                  summary150: (discoveredContent.content || '').substring(0, 180),
                  keyPoints: [],
                  readingTimeMin: Math.ceil((discoveredContent.content || '').length / 1000)
                },
                meta: {
                  sourceDomain: item.url ? new URL(item.url).hostname : 'unknown',
                  publishDate: new Date().toISOString()
                }
              })
              
              savedItems.push(discoveredContent)
              
            } catch (itemError) {
              console.error('[Start Discovery] Error processing item:', item.title, itemError)
              rejectedItems.push({ url: item.url, title: item.title, reason: 'processing_error' })
            }
          }
          
          // Send complete event
          sendEvent('complete', { done: savedItems.length, rejected: rejectedItems.length })
          sendEvent('state', { phase: 'completed' })
          
        } catch (error) {
          console.error('[Start Discovery] Stream error:', error)
          sendEvent('error', { message: error instanceof Error ? error.message : 'Unknown error' })
          sendEvent('state', { phase: 'error' })
        } finally {
          writer.close()
        }
      })()
      
      return new Response(stream.readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      })
    }
    
    // Non-streaming fallback (original flow)
    const savedItems = [];
    const rejectedItems = [];
    
    for (const item of discoveredItems) {
      try {
        console.log('[Start Discovery] Processing item:', item.title);
        
        // STEP 1: Verify relevance (use DeepSeek score)
        const relevanceScore = item.relevance_score || 0;
        if (relevanceScore < 0.7) {
          console.log('[Start Discovery] ❌ Item rejected (low relevance):', item.title, `Score: ${relevanceScore}`);
          rejectedItems.push({
            url: item.url,
            title: item.title,
            reason: 'low_relevance',
            score: relevanceScore
          });
          
          // Log rejection to prevent future attempts
          fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3005'}/api/dev/rejected-content`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: item.url,
              patchId: patch.id,
              reason: `Low relevance score: ${relevanceScore}`
            })
          }).catch(() => {}); // Don't fail if logging fails
          
          continue; // Skip this item
        }
        
        console.log('[Start Discovery] ✅ Item passed relevance check:', item.title, `Score: ${relevanceScore}`);
        
        // STEP 2: Generate AI image BEFORE saving to database
        let aiImageUrl = null;
        let aiImageSource = 'fallback';
        
        try {
          console.log('[Start Discovery] Generating AI image for:', item.title);
          
          const aiImageResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3005'}/api/ai/generate-hero-image`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: item.title,
              summary: item.description || '',
              contentType: item.type,
              artisticStyle: 'photorealistic',
              enableHiresFix: false
            })
          });
          
          if (aiImageResponse.ok) {
            const aiImageData = await aiImageResponse.json();
            if (aiImageData.success && aiImageData.imageUrl) {
              aiImageUrl = aiImageData.imageUrl;
              aiImageSource = 'ai-generated';
              console.log('[Start Discovery] ✅ AI image generated successfully');
            } else {
              console.warn('[Start Discovery] ⚠️ AI image generation returned no image');
            }
          } else {
            console.warn('[Start Discovery] ⚠️ AI image generation failed:', aiImageResponse.status);
          }
        } catch (aiImageError) {
          console.warn('[Start Discovery] ⚠️ AI image generation error:', aiImageError);
        }
        
        // If AI image failed, try fallback enrichment
        if (!aiImageUrl) {
          try {
            console.log('[Start Discovery] Trying fallback enrichment for image...');
            
            // Use the enrichment API as fallback
            const enrichResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/media/fallback-image`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                url: item.url,
                title: item.title,
                type: item.type
              })
            });
            
            if (enrichResponse.ok) {
              const enrichData = await enrichResponse.json();
              aiImageUrl = enrichData.imageUrl || enrichData.url;
              aiImageSource = 'fallback';
              console.log('[Start Discovery] ✅ Fallback image obtained');
            }
          } catch (fallbackError) {
            console.warn('[Start Discovery] ⚠️ Fallback image failed:', fallbackError);
          }
        }
        
        // If still no image, skip this item
        if (!aiImageUrl) {
          console.log('[Start Discovery] ❌ Item rejected (no image):', item.title);
          rejectedItems.push({
            url: item.url,
            title: item.title,
            reason: 'no_image',
            score: relevanceScore
          });
          
          // Log rejection
          fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3005'}/api/dev/rejected-content`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: item.url,
              patchId: patch.id,
              reason: 'Failed to generate image'
            })
          }).catch(() => {});
          
          continue; // Skip this item
        }
        
        // STEP 3: ONLY NOW save to database with status: 'ready'
        const discoveredContent = await prisma.discoveredContent.create({
          data: {
            patchId: patch.id,
            type: item.type || 'article',
            title: item.title,
            content: item.description || '',
            sourceUrl: item.url,
            relevanceScore: relevanceScore,
            tags: patch.tags.slice(0, 3),
            status: 'ready', // ← READY because it passed all checks!
            mediaAssets: {
              heroImage: {
                url: aiImageUrl,
                source: aiImageSource,
                license: 'generated'
              }
            }
          }
        });
        
        console.log('[Start Discovery] ✅ Item saved with image:', discoveredContent.id);

        savedItems.push({
          id: discoveredContent.id,
          title: discoveredContent.title,
          url: discoveredContent.sourceUrl,
          type: discoveredContent.type,
          description: discoveredContent.content,
          relevanceScore: discoveredContent.relevanceScore,
          status: discoveredContent.status,
          imageUrl: aiImageUrl
        });
        
      } catch (itemError) {
        console.error('[Start Discovery] Failed to process item:', item.title, itemError);
        rejectedItems.push({
          url: item.url,
          title: item.title,
          reason: 'processing_error',
          error: itemError instanceof Error ? itemError.message : String(itemError)
        });
      }
    }

    console.log('[Start Discovery] Summary:', {
      discovered: discoveredItems.length,
      saved: savedItems.length,
      rejected: rejectedItems.length
    });

    return NextResponse.json({
      success: true,
      message: `Started content discovery for "${patch.name}"`,
      itemsDiscovered: discoveredItems.length,
      itemsSaved: savedItems.length,
      itemsRejected: rejectedItems.length,
      items: savedItems,
      rejections: rejectedItems.map(r => ({ title: r.title, reason: r.reason }))
    });

  } catch (error) {
    console.error('[Start Discovery] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
