import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { canonicalize } from '@/lib/discovery/canonicalization';
import { BatchedLogger } from '@/lib/discovery/logger';

export const runtime = 'nodejs';

// GET handler for SSE streaming (EventSource compatibility)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  console.log('[Start Discovery] GET endpoint called (SSE streaming)');
  
  // GET is always streaming
  const url = new URL(request.url);
  const modifiedRequest = new Request(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({ action: 'start_deepseek_search' })
  });
  
  // Reuse POST logic
  return POST(modifiedRequest, { params });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  console.log('[Start Discovery] POST endpoint called');
  
  // Check if SSE streaming is requested
  const url = new URL(request.url)
  const isStreaming = url.searchParams.get('stream') === 'true' || request.method === 'GET'
  
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

    // For streaming mode, we'll loop and call DeepSeek ONE item at a time
    // For non-streaming, keep the batch approach for backward compatibility
    const batchSize = isStreaming ? 1 : 10;
    const maxIterations = isStreaming ? 10 : 1;
    
    // 🚀 OPTIMIZATION: Build URL cache of ALL processed URLs (approved + denied)
    // This prevents re-processing the same URLs through DeepSeek
    const processedUrls = await prisma.discoveredContent.findMany({
      where: { patchId: patch.id },
      select: { 
        sourceUrl: true, 
        canonicalUrl: true,
        title: true,
        status: true 
      }
    });
    
    // Create URL cache for fast lookups (both original and canonical)
    const urlCache = new Set<string>();
    processedUrls.forEach(item => {
      if (item.sourceUrl) urlCache.add(item.sourceUrl);
      if (item.canonicalUrl) urlCache.add(item.canonicalUrl);
    });
    
    console.log('[Start Discovery] 🗄️ URL Cache built:', {
      totalProcessed: processedUrls.length,
      approved: processedUrls.filter(p => p.status === 'ready').length,
      denied: processedUrls.filter(p => p.status === 'denied' || p.status === 'rejected').length,
      cacheSize: urlCache.size
    });
    
    // Build avoidance context for DeepSeek (recent titles only, not all URLs)
    const recentTitles = processedUrls
      .filter(p => p.status === 'ready')
      .slice(0, 20);
    
    const avoidanceContext = recentTitles.length > 0 
      ? `\n\nAVOID these topics (already covered):\n${recentTitles.map(t => `- ${t.title}`).join('\n')}`
      : '';
    
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
            content: isStreaming 
              ? `You are a research assistant. Find the SINGLE BEST, most recent piece of content.
                Return ONLY ONE result as a JSON object (not an array):
                {
                  "title": "Specific title",
                  "url": "https://example.com/article",
                  "type": "article|video|news",
                  "description": "Brief description",
                  "relevance_score": 0.95
                }
                Focus on authoritative sources and recent content (last 7-14 days preferred).
                Only return if relevance_score > 0.8.`
              : `You are a research assistant that finds high-quality, relevant content about specific topics. 
                Return your findings as a JSON array of objects with relevance_score > 0.7.`
          },
          {
            role: 'user',
            content: isStreaming
              ? `Find the SINGLE BEST piece of recent content about: "${patch.name}"
                
                Description: ${patch.description || 'No description'}
                Tags: ${patch.tags.join(', ')}${avoidanceContext}
                
                Return ONE result as JSON object (not array).`
              : `Find high-quality content about: "${patch.name}"
                
                Description: ${patch.description || 'No description provided'}
                Tags: ${patch.tags.join(', ')}
                
                Please search for and return relevant, authoritative content.`
          }
        ],
        temperature: isStreaming ? 0.7 : 0.3,
        max_tokens: isStreaming ? 500 : 4000
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
          
          // Initialize batched logger for duplicate tracking
          const duplicateLogger = new BatchedLogger(30000) // Flush every 30s
          let duplicateCount = 0
          
          const savedItems: any[] = []
          const rejectedItems: any[] = []
          
          sendEvent('found', { count: discoveredItems.length })
          sendEvent('state', { phase: 'processing' })
          
          // Process items one by one
          for (let i = 0; i < discoveredItems.length; i++) {
            const item = discoveredItems[i]
            
            try {
              sendEvent('progress', { done: i, total: discoveredItems.length })
              
              // 🚀 STEP 1: Canonicalize URL FIRST (before any other checks)
              const canonicalResult = await canonicalize(item.url)
              const canonicalUrl = canonicalResult.canonicalUrl
              
              // 🚀 STEP 2: Check URL cache IMMEDIATELY (no DB query needed)
              if (urlCache.has(item.url) || urlCache.has(canonicalUrl)) {
                console.log('[Start Discovery] ⚡ Skipped (URL in cache):', item.url)
                duplicateLogger.logDuplicate(item.url, 'A', 'cache')
                duplicateCount++
                continue
              }
              
              // 🚀 STEP 3: Verify relevance BEFORE generating image
              const relevanceScore = item.relevance_score || 0
              if (relevanceScore < 0.7) {
                console.log('[Start Discovery] ❌ Rejected (low relevance):', item.title)
                
                // Save denied URL to database so we never check it again
                await prisma.discoveredContent.create({
                  data: {
                    patchId: patch.id,
                    type: item.type || 'article',
                    title: item.title || 'Untitled',
                    content: item.description || '',
                    sourceUrl: item.url,
                    canonicalUrl: canonicalUrl,
                    relevanceScore: Math.round(relevanceScore * 100), // Convert 0.0-1.0 to 0-100
                    tags: [],
                    status: 'denied', // 🚀 Mark as denied
                  }
                })
                
                // Add to cache immediately
                urlCache.add(item.url)
                urlCache.add(canonicalUrl)
                
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
                
                // Save denied URL to database so we never check it again
                await prisma.discoveredContent.create({
                  data: {
                    patchId: patch.id,
                    type: item.type || 'article',
                    title: item.title || 'Untitled',
                    content: item.description || '',
                    sourceUrl: item.url,
                    canonicalUrl: canonicalUrl,
                    relevanceScore: Math.round(relevanceScore * 100), // Convert 0.0-1.0 to 0-100
                    tags: [],
                    status: 'denied', // 🚀 Mark as denied
                  }
                })
                
                // Add to cache immediately
                urlCache.add(item.url)
                urlCache.add(canonicalUrl)
                
                rejectedItems.push({ url: item.url, title: item.title, reason: 'no_image' })
                continue
              }
              
              // 🚀 Save to database with status='ready' (approved)
              const discoveredContent = await prisma.discoveredContent.create({
                data: {
                  patchId: patch.id,
                  type: item.type || 'article',
                  title: item.title,
                  content: item.description || '',
                  sourceUrl: item.url,
                  canonicalUrl: canonicalUrl,
                  relevanceScore: Math.round(relevanceScore * 100), // Convert 0.0-1.0 to 0-100
                  tags: patch.tags.slice(0, 3),
                  status: 'ready', // 🚀 Mark as approved
                  mediaAssets: {
                    heroImage: {
                      url: aiImageUrl,
                      source: aiImageSource,
                      license: 'generated'
                    }
                  }
                }
              })
              
              // 🚀 Add approved URL to cache immediately
              urlCache.add(item.url)
              urlCache.add(canonicalUrl)
              
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
          
          // Flush batched logs and send final summary
          duplicateLogger.flush()
          
          console.log(`[Start Discovery] Processing complete:`, {
            saved: savedItems.length,
            rejected: rejectedItems.length,
            duplicates: duplicateCount,
            total: discoveredItems.length
          })
          
          // Send complete event
          sendEvent('complete', { 
            done: savedItems.length, 
            rejected: rejectedItems.length,
            duplicates: duplicateCount
          })
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
    const duplicateLogger = new BatchedLogger(30000) // Flush every 30s
    let duplicateCount = 0
    const savedItems = [];
    const rejectedItems = [];
    
    for (const item of discoveredItems) {
      try {
        console.log('[Start Discovery] Processing item:', item.title);
        
        // 🚀 STEP 1: Canonicalize URL FIRST
        const canonicalResult = await canonicalize(item.url)
        const canonicalUrl = canonicalResult.canonicalUrl
        
        // 🚀 STEP 2: Check URL cache IMMEDIATELY
        if (urlCache.has(item.url) || urlCache.has(canonicalUrl)) {
          console.log('[Start Discovery] ⚡ Skipped (URL in cache):', item.url)
          duplicateLogger.logDuplicate(item.url, 'A', 'cache')
          duplicateCount++
          continue
        }
        
        // 🚀 STEP 3: Verify relevance BEFORE generating image
        const relevanceScore = item.relevance_score || 0;
        if (relevanceScore < 0.7) {
          console.log('[Start Discovery] ❌ Item rejected (low relevance):', item.title, `Score: ${relevanceScore}`);
          
          // Save denied URL to database
          await prisma.discoveredContent.create({
            data: {
              patchId: patch.id,
              type: item.type || 'article',
              title: item.title || 'Untitled',
              content: item.description || '',
              sourceUrl: item.url,
              canonicalUrl: canonicalUrl,
              relevanceScore: Math.round(relevanceScore * 100), // Convert 0.0-1.0 to 0-100
              tags: [],
              status: 'denied',
            }
          })
          
          // Add to cache immediately
          urlCache.add(item.url)
          urlCache.add(canonicalUrl)
          
          rejectedItems.push({
            url: item.url,
            title: item.title,
            reason: 'low_relevance',
            score: relevanceScore
          });
          
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
            canonicalUrl: canonicalUrl,
            relevanceScore: Math.round(relevanceScore * 100), // Convert 0.0-1.0 to 0-100
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
        
        // 🚀 Add approved URL to cache immediately
        urlCache.add(item.url)
        urlCache.add(canonicalUrl)
        
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

    // Flush batched logs
    duplicateLogger.flush()
    
    console.log('[Start Discovery] Summary:', {
      discovered: discoveredItems.length,
      saved: savedItems.length,
      rejected: rejectedItems.length,
      duplicates: duplicateCount
    });

    return NextResponse.json({
      success: true,
      message: `Started content discovery for "${patch.name}"`,
      itemsDiscovered: discoveredItems.length,
      itemsSaved: savedItems.length,
      itemsRejected: rejectedItems.length,
      itemsDuplicate: duplicateCount,
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
