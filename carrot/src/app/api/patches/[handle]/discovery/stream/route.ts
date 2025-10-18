import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// In-memory store for discovery sessions
const sessions = new Map<string, { active: boolean; count: number }>()

/**
 * SSE endpoint for single-item discovery stream
 * GET /api/patches/[handle]/discovery/stream?mode=single&batch=10
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { handle } = await params
    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'single'
    const batchSize = parseInt(searchParams.get('batch') || '10')

    // Get patch
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: { id: true, name: true, description: true, tags: true }
    })

    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }

    // Create SSE stream
    const stream = new TransformStream()
    const writer = stream.writable.getWriter()
    const encoder = new TextEncoder()

    const sendEvent = (event: string, data: any) => {
      try {
        writer.write(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      } catch (err) {
        console.error('[Discovery Stream] Failed to send event:', err)
      }
    }

    // Start discovery loop in background
    ;(async () => {
      try {
        // Initialize session
        const sessionKey = `${patch.id}:${session.user.id}`
        sessions.set(sessionKey, { active: true, count: 0 })

        sendEvent('discovery:start', { patchId: patch.id, patchName: patch.name })
        
        let itemsAdded = 0
        const maxItems = 25 // Safety cap

        // Discovery loop
        while (itemsAdded < maxItems && sessions.get(sessionKey)?.active) {
          try {
            // Send heartbeat
            sendEvent('heartbeat', {})
            
            // STEP 1: Search for one candidate
            sendEvent('discovery:searching', { cycle: itemsAdded + 1 })
            
            // Call DeepSeek to find one item
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
                    content: 'Find ONE highly relevant, recent article/video about the topic. Return JSON: {"url":"...","title":"...","description":"...","type":"article|video","relevance_score":0.9,"source_authority":"high"}'
                  },
                  {
                    role: 'user',
                    content: `Find one recent, authoritative source about: "${patch.name}". Tags: ${patch.tags.join(', ')}. Return ONE item only.`
                  }
                ],
                temperature: 0.7,
                max_tokens: 500
              })
            })

            if (!deepSeekResponse.ok) {
              throw new Error(`DeepSeek API error: ${deepSeekResponse.status}`)
            }

            const deepSeekData = await deepSeekResponse.json()
            const content = deepSeekData.choices?.[0]?.message?.content

            if (!content) {
              throw new Error('No content from DeepSeek')
            }

            // Parse response
            const jsonMatch = content.match(/\{[\s\S]*\}/)
            const candidate = jsonMatch ? JSON.parse(jsonMatch[0]) : null

            if (!candidate || !candidate.url) {
              sendEvent('discovery:error', { stage: 'searching', message: 'No valid candidate found' })
              continue
            }

            sendEvent('discovery:candidate', { 
              url: candidate.url,
              sourceDomain: new URL(candidate.url).hostname
            })

            // STEP 2: Check relevance
            const relevanceScore = candidate.relevance_score || 0
            if (relevanceScore < 0.7) {
              sendEvent('discovery:error', { stage: 'relevance', message: 'Low relevance score' })
              continue
            }

            // STEP 3: Check for duplicates
            const existing = await prisma.discoveredContent.findFirst({
              where: {
                patchId: patch.id,
                sourceUrl: candidate.url
              }
            })

            if (existing) {
              sendEvent('discovery:error', { stage: 'duplicate', message: 'Item already exists' })
              continue
            }

            // STEP 4: Fetch content
            sendEvent('discovery:fetching', { url: candidate.url })

            // STEP 5: Generate hero image
            const tempId = `temp-${Date.now()}`
            sendEvent('discovery:imagizing:start', { itemId: tempId })

            let heroUrl = null
            let heroSource = 'generated'

            try {
              const aiResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3005'}/api/ai/generate-hero-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: candidate.title,
                  summary: candidate.description || '',
                  contentType: candidate.type,
                  artisticStyle: 'photorealistic',
                  enableHiresFix: false
                }),
                signal: AbortSignal.timeout(10000) // 10s timeout
              })

              if (aiResponse.ok) {
                const aiData = await aiResponse.json()
                if (aiData.success && aiData.imageUrl) {
                  heroUrl = aiData.imageUrl
                  heroSource = 'ai'
                }
              }
            } catch (imgErr) {
              console.warn('[Discovery Stream] Image generation failed, will use placeholder')
            }

            // Fallback: Generate programmatic cover if no hero
            if (!heroUrl) {
              const domain = new URL(candidate.url).hostname
              heroUrl = `data:image/svg+xml,${encodeURIComponent(`
                <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
                      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
                    </linearGradient>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#bg)"/>
                  <rect x="40" y="620" width="200" height="60" rx="30" fill="white" opacity="0.9"/>
                  <text x="140" y="655" text-anchor="middle" font-size="16" fill="#333" font-family="system-ui" font-weight="500">
                    ${domain}
                  </text>
                </svg>
              `)}`
            }

            // STEP 6: Save to database with status: 'ready'
            const discoveredContent = await prisma.discoveredContent.create({
              data: {
                patchId: patch.id,
                type: candidate.type || 'article',
                title: candidate.title,
                content: candidate.description || '',
                sourceUrl: candidate.url,
                relevanceScore: relevanceScore,
                tags: patch.tags.slice(0, 3),
                status: 'ready',
                mediaAssets: {
                  heroImage: {
                    url: heroUrl,
                    source: heroSource,
                    license: 'generated'
                  }
                }
              }
            })

            // STEP 7: Send item-ready event
            const sourceDomain = new URL(candidate.url).hostname
            sendEvent('discovery:saved', {
              item: {
                id: discoveredContent.id,
                type: discoveredContent.type,
                title: discoveredContent.title,
                displayTitle: discoveredContent.title,
                url: discoveredContent.sourceUrl,
                canonicalUrl: discoveredContent.sourceUrl,
                status: 'ready',
                media: {
                  hero: heroUrl,
                  source: heroSource,
                  license: 'generated'
                },
                content: {
                  summary150: (discoveredContent.content || '').substring(0, 180),
                  keyPoints: [],
                  readingTimeMin: Math.ceil((discoveredContent.content || '').length / 1000)
                },
                meta: {
                  sourceDomain,
                  publishDate: new Date().toISOString()
                }
              }
            })

            itemsAdded++
            const sessionData = sessions.get(sessionKey)
            if (sessionData) {
              sessionData.count = itemsAdded
            }

            sendEvent('discovery:cycle', { count: itemsAdded })

            // Jitter delay (0-2s) before next iteration
            await new Promise(resolve => setTimeout(resolve, Math.random() * 2000))

          } catch (iterationError) {
            console.error('[Discovery Stream] Iteration error:', iterationError)
            sendEvent('discovery:error', {
              stage: 'iteration',
              message: iterationError instanceof Error ? iterationError.message : 'Unknown error'
            })
            
            // Continue to next iteration after error
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }

        // Cleanup
        sessions.delete(sessionKey)
        sendEvent('discovery:complete', { total: itemsAdded })

      } catch (error) {
        console.error('[Discovery Stream] Fatal error:', error)
        sendEvent('discovery:error', {
          stage: 'fatal',
          message: error instanceof Error ? error.message : 'Unknown error'
        })
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

  } catch (error) {
    console.error('[Discovery Stream] Error:', error)
    return NextResponse.json(
      { error: 'Failed to start discovery stream' },
      { status: 500 }
    )
  }
}

