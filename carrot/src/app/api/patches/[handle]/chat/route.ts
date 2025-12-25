import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { AgentRegistry } from '@/lib/ai-agents/agentRegistry'
import { FeedService } from '@/lib/ai-agents/feedService'

export const dynamic = 'force-dynamic'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { handle } = await params
    const { message, messages = [] } = await req.json()

    if (!message && messages.length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    // Get patch
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: {
        id: true,
        title: true,
        description: true,
        tags: true
      }
    })

    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 })
    }

    // Get patch-specific agent
    const agents = await AgentRegistry.getAgentsByPatches([handle])
    const agent = agents.find(a => 
      a.metadata?.patchId === patch.id || 
      a.associatedPatches.includes(handle)
    ) || agents[0]

    if (!agent) {
      return NextResponse.json({ 
        error: 'No agent found for this patch',
        fallback: true 
      }, { status: 404 })
    }

    // Get relevant context from discovered content
    const userQuery = message || (messages.length > 0 ? messages[messages.length - 1].content : '')
    
    // Retrieve relevant discovered content for RAG context
    const discoveredContent = await prisma.discoveredContent.findMany({
      where: {
        patchId: patch.id,
        textContent: { not: null },
        isUseful: true // Only use useful/published content
      },
      select: {
        id: true,
        title: true,
        summary: true,
        whyItMatters: true,
        facts: true,
        textContent: true,
        sourceUrl: true,
        relevanceScore: true
      },
      orderBy: {
        relevanceScore: 'desc'
      },
      take: 10 // Get top 10 most relevant items
    })

    // Search agent memories for relevant context
    let agentMemories: any[] = []
    try {
      agentMemories = await FeedService.searchMemories(agent.id, userQuery, 5)
    } catch (err) {
      console.warn('[Patch Chat] Failed to search agent memories:', err)
    }

    // Build context from discovered content
    const contextParts: string[] = []
    
    if (discoveredContent.length > 0) {
      contextParts.push('\n\n=== RELEVANT DISCOVERED CONTENT ===')
      discoveredContent.slice(0, 5).forEach((content, idx) => {
        const text = content.textContent?.substring(0, 500) || content.summary || ''
        if (text) {
          contextParts.push(`\n[Source ${idx + 1}: ${content.title}]`)
          contextParts.push(text)
          if (content.facts && typeof content.facts === 'object') {
            const facts = Array.isArray(content.facts) ? content.facts : []
            if (facts.length > 0) {
              contextParts.push(`\nKey Facts: ${facts.slice(0, 3).map((f: any) => f.text || f).join('; ')}`)
            }
          }
          if (content.sourceUrl) {
            contextParts.push(`Source: ${content.sourceUrl}`)
          }
        }
      })
    }

    // Add agent memories if available
    if (agentMemories.length > 0) {
      contextParts.push('\n\n=== RELEVANT MEMORIES ===')
      agentMemories.slice(0, 3).forEach((memory, idx) => {
        contextParts.push(`\n[Memory ${idx + 1}]`)
        contextParts.push(memory.content?.substring(0, 300) || '')
        if (memory.sourceTitle) {
          contextParts.push(`Source: ${memory.sourceTitle}`)
        }
      })
    }

    const context = contextParts.join('\n')

    // Build system prompt with agent persona and context
    const systemPrompt = `${agent.persona || `You are ${agent.name}, an AI agent specialized in ${patch.title}.`}

You have access to the following discovered content and memories about this topic. Use this information to provide accurate, detailed, and helpful responses. If the information doesn't fully answer the question, you can use your general knowledge but always prioritize the discovered content.

${context}

When answering questions:
- Reference specific sources when possible
- Provide accurate information based on the discovered content
- If you're uncertain about something, acknowledge it
- Be thorough but concise`

    // Build messages array
    const chatMessages = messages.length > 0 
      ? [
          { role: 'system', content: systemPrompt },
          ...messages.map((m: any) => ({
            role: m.role || (m.type === 'user' ? 'user' : 'assistant'),
            content: m.content || m.text
          }))
        ]
      : [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ]

    // Call the AI chat API with streaming
    const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3005'}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'deepseek',
        model: 'deepseek-chat',
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 2048
      })
    })

    if (!response.ok) {
      throw new Error(`AI API failed: ${response.status}`)
    }

    // Return the streaming response
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      }
    })

  } catch (error: any) {
    console.error('[Patch Chat] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

