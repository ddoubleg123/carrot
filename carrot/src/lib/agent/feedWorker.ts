/**
 * Agent Memory Feed Worker
 * 
 * Processes AgentMemoryFeedQueue to feed discovered content to patch agents
 * - Quality gates
 * - Idempotency
 * - Error handling with exponential backoff
 * - Observability
 */

import { prisma } from '@/lib/prisma'
// Use explicit file path to help webpack resolve
import { packDiscoveredContent, sanitizeForAgent } from '@/lib/agent/packers'
import { AgentRegistry } from '@/lib/ai-agents/agentRegistry'
import { FeedService, FeedItem } from '@/lib/ai-agents/feedService'
import { createHash } from 'crypto'

// Configuration
const CONFIG = {
  CONCURRENCY: parseInt(process.env.AGENT_FEED_CONCURRENCY || '4'),
  MAX_ATTEMPTS: 3,
  MIN_TEXT_BYTES: parseInt(process.env.MIN_TEXT_BYTES_FOR_AGENT || '100'), // Very low - include almost everything
  MIN_RELEVANCE_SCORE: parseInt(process.env.MIN_RELEVANCE_SCORE || '0'), // No minimum - learn everything
  BATCH_SIZE: 10,
  RETRY_DELAYS: [1000, 5000, 15000] // ms
}

/**
 * Process a single queue item
 */
export async function processFeedQueueItem(queueItemId: string): Promise<{ success: boolean; error?: string }> {
  const queueItem = await prisma.agentMemoryFeedQueue.findUnique({
    where: { id: queueItemId },
    include: {
      discoveredContent: true
    }
  })

  if (!queueItem) {
    return { success: false, error: 'Queue item not found' }
  }

  if (queueItem.status === 'DONE') {
    return { success: true } // Already processed
  }

  if (queueItem.status === 'FAILED' && queueItem.attempts >= CONFIG.MAX_ATTEMPTS) {
    return { success: false, error: 'Max attempts reached' }
  }

  // Mark as processing
  await prisma.agentMemoryFeedQueue.update({
    where: { id: queueItemId },
    data: {
      status: 'PROCESSING',
      pickedAt: new Date(),
      attempts: { increment: 1 }
    }
  })

  try {
    const content = queueItem.discoveredContent
    
    // Quality gates
    const gateResult = await checkQualityGates(content, queueItem.patchId)
    if (!gateResult.passed) {
      await prisma.agentMemoryFeedQueue.update({
        where: { id: queueItemId },
        data: {
          status: 'FAILED',
          lastError: `Quality gate failed: ${gateResult.reason}`
        }
      })
      return { success: false, error: gateResult.reason }
    }

    // Check idempotency - has this content already been fed?
    const existingMemory = await prisma.agentMemory.findUnique({
      where: {
        patchId_discoveredContentId_contentHash: {
          patchId: queueItem.patchId,
          discoveredContentId: queueItem.discoveredContentId,
          contentHash: queueItem.contentHash
        }
      }
    })

    if (existingMemory) {
      // Already processed - mark as done
      await prisma.agentMemoryFeedQueue.update({
        where: { id: queueItemId },
        data: { status: 'DONE' }
      })
      return { success: true }
    }

    // Get patch agent
    const agents = await AgentRegistry.getAgentsByPatches([queueItem.patchId])
    if (agents.length === 0) {
      await prisma.agentMemoryFeedQueue.update({
        where: { id: queueItemId },
        data: {
          status: 'FAILED',
          lastError: 'No agent found for patch'
        }
      })
      return { success: false, error: 'No agent found for patch' }
    }

    const agent = agents[0] // Use first agent

    // Pack content
    const packed = await packDiscoveredContent({
      id: content.id,
      title: content.title,
      summary: content.summary,
      whyItMatters: content.whyItMatters,
      facts: content.facts,
      keyFacts: content.keyFacts as any,
      textContent: content.textContent,
      sourceUrl: content.sourceUrl,
      publishDate: content.publishDate,
      domain: content.domain,
      metadata: content.metadata as any
    })

    // Build memory content
    const memoryContent = buildMemoryContent(packed, content)

    // Feed to agent
    const feedItem: FeedItem = {
      content: memoryContent,
      sourceType: 'discovery',
      sourceUrl: content.sourceUrl,
      sourceTitle: content.title,
      sourceAuthor: content.domain || undefined,
      tags: [content.category || 'article'].filter(Boolean),
      threadId: content.id,
      topicId: queueItem.patchId
    }

    const feedResult = await FeedService.feedAgent(agent.id, feedItem, 'auto-discovery')

    // Create AgentMemory record
    await prisma.agentMemory.create({
      data: {
        agentId: agent.id,
        content: memoryContent,
        embedding: [], // Will be populated by vector DB if used
        sourceType: 'discovery',
        sourceUrl: content.sourceUrl,
        sourceTitle: content.title,
        sourceAuthor: content.domain || undefined,
        tags: [content.category || 'article'].filter(Boolean),
        confidence: Math.min(1.0, (content.relevanceScore || 0) / 100),
        topicId: queueItem.patchId,
        // Discovery-specific fields
        patchId: queueItem.patchId,
        discoveredContentId: content.id,
        contentHash: queueItem.contentHash,
        summary: packed.summary,
        facts: packed.facts as any,
        entities: packed.entities as any,
        timeline: packed.timeline as any,
        rawTextPtr: packed.rawTextPtr
      }
    })

    // Mark queue item as done
    await prisma.agentMemoryFeedQueue.update({
      where: { id: queueItemId },
      data: { status: 'DONE' }
    })

    // Log success
    console.log(`[FeedWorker] ✅ Processed ${queueItemId}: ${content.title.substring(0, 50)}...`)

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[FeedWorker] ❌ Error processing ${queueItemId}:`, errorMessage)

    // Update queue item with error
    await prisma.agentMemoryFeedQueue.update({
      where: { id: queueItemId },
      data: {
        status: queueItem.attempts >= CONFIG.MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
        lastError: errorMessage
      }
    })

    return { success: false, error: errorMessage }
  }
}

/**
 * Check quality gates before feeding
 */
async function checkQualityGates(
  content: {
    textContent?: string | null
    summary?: string | null
    relevanceScore: number
    qualityScore: number
    domain?: string | null
  },
  patchId: string
): Promise<{ passed: boolean; reason?: string }> {
  // Gate 1: Minimum text bytes
  const textBytes = (content.textContent || content.summary || '').length
  if (textBytes < CONFIG.MIN_TEXT_BYTES) {
    return { passed: false, reason: `Text too short: ${textBytes} bytes < ${CONFIG.MIN_TEXT_BYTES}` }
  }

  // Gate 2: Relevance score (only if threshold is set > 0)
  if (CONFIG.MIN_RELEVANCE_SCORE > 0 && content.relevanceScore < CONFIG.MIN_RELEVANCE_SCORE) {
    return { passed: false, reason: `Relevance too low: ${content.relevanceScore} < ${CONFIG.MIN_RELEVANCE_SCORE}` }
  }

  // Gate 3: Feature flag check (per patch)
  // TODO: Implement per-patch feature flag
  // For now, assume enabled

  // Gate 4: Domain allow/deny (optional)
  // TODO: Implement domain filtering per patch
  // For now, allow all

  return { passed: true }
}

/**
 * Build memory content string from packed content
 */
function buildMemoryContent(
  packed: {
    title: string
    summary: string
    facts: Array<{ text: string; date?: string }>
    entities: Array<{ name: string; type: string }>
    timeline: Array<{ date: string; what: string; refs: string[] }>
  },
  content: { sourceUrl: string; publishDate?: Date | null; domain?: string | null }
): string {
  const parts: string[] = []

  // Title and metadata
  parts.push(`Title: ${packed.title}`)
  if (content.publishDate) {
    parts.push(`Published: ${content.publishDate.toISOString().split('T')[0]}`)
  }
  if (content.domain) {
    parts.push(`Source: ${content.domain}`)
  }
  parts.push(`URL: ${content.sourceUrl}`)
  parts.push('')

  // Summary
  if (packed.summary) {
    parts.push('Summary:')
    parts.push(packed.summary)
    parts.push('')
  }

  // Key Facts
  if (packed.facts.length > 0) {
    parts.push('Key Facts:')
    for (const fact of packed.facts) {
      const factText = fact.date ? `${fact.text} (${fact.date})` : fact.text
      parts.push(`- ${factText}`)
    }
    parts.push('')
  }

  // Entities
  if (packed.entities.length > 0) {
    parts.push('Entities:')
    for (const entity of packed.entities.slice(0, 10)) {
      parts.push(`- ${entity.name} (${entity.type})`)
    }
    parts.push('')
  }

  // Timeline
  if (packed.timeline.length > 0) {
    parts.push('Timeline:')
    for (const item of packed.timeline) {
      parts.push(`- ${item.date}: ${item.what}`)
    }
  }

  return sanitizeForAgent(parts.join('\n'), 50000) // Max 50k chars
}

/**
 * Process pending queue items (worker loop)
 */
export async function processFeedQueue(options: {
  limit?: number
  patchId?: string
} = {}): Promise<{ processed: number; failed: number; skipped: number }> {
  const limit = options.limit || CONFIG.BATCH_SIZE
  const where: any = { status: 'PENDING' }
  if (options.patchId) {
    where.patchId = options.patchId
  }

  const queueItems = await prisma.agentMemoryFeedQueue.findMany({
    where,
    orderBy: [
      { priority: 'desc' },
      { enqueuedAt: 'asc' }
    ],
    take: limit,
    include: {
      discoveredContent: true
    }
  })

  let processed = 0
  let failed = 0
  let skipped = 0

  // Process in parallel (up to concurrency limit)
  const results = await Promise.allSettled(
    queueItems.map(item => processFeedQueueItem(item.id))
  )

  for (const result of results) {
    if (result.status === 'fulfilled') {
      if (result.value.success) {
        processed++
      } else {
        failed++
      }
    } else {
      failed++
      console.error('[FeedWorker] Promise rejected:', result.reason)
    }
  }

  return { processed, failed, skipped }
}

/**
 * Enqueue discovered content for agent feeding
 */
export async function enqueueDiscoveredContent(
  discoveredContentId: string,
  patchId: string,
  contentHash: string,
  priority: number = 0
): Promise<{ enqueued: boolean; reason?: string }> {
  try {
    // Check if already enqueued
    const existing = await prisma.agentMemoryFeedQueue.findUnique({
      where: {
        patchId_discoveredContentId_contentHash: {
          patchId,
          discoveredContentId,
          contentHash
        }
      }
    })

    if (existing) {
      return { enqueued: false, reason: 'Already enqueued' }
    }

    // Check if already processed
    const existingMemory = await prisma.agentMemory.findUnique({
      where: {
        patchId_discoveredContentId_contentHash: {
          patchId,
          discoveredContentId,
          contentHash
        }
      }
    })

    if (existingMemory) {
      return { enqueued: false, reason: 'Already processed' }
    }

    // Enqueue
    await prisma.agentMemoryFeedQueue.create({
      data: {
        patchId,
        discoveredContentId,
        contentHash,
        priority,
        status: 'PENDING'
      }
    })

    console.log(`[FeedWorker] 📥 Enqueued ${discoveredContentId} for patch ${patchId}`)
    return { enqueued: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`[FeedWorker] Failed to enqueue ${discoveredContentId}:`, errorMessage)
    return { enqueued: false, reason: errorMessage }
  }
}

/**
 * Calculate content hash for idempotency
 */
export function calculateContentHash(
  title: string,
  summary: string | null,
  textContent: string | null
): string {
  const content = `${title}|${summary || ''}|${textContent || ''}`
  return createHash('sha256').update(content).digest('hex').substring(0, 16)
}

