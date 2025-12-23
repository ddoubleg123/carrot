/**
 * Automatic content cleanup hook
 * Runs DeepSeek cleanup on newly created content in the background
 */

import { prisma } from '@/lib/prisma'
import { chatStream, type ChatMessage } from '@/lib/llm/providers/DeepSeekClient'

/**
 * Automatically clean content after creation
 * This runs in the background and doesn't block content creation
 */
export async function autoCleanupContent(contentId: string): Promise<void> {
  // Run in background - don't await, don't throw
  setImmediate(async () => {
    try {
      await cleanupContentInternal(contentId)
    } catch (error) {
      // Silently fail - cleanup can happen later via preview API
      console.warn(`[AutoCleanup] Failed to cleanup ${contentId}:`, error)
    }
  })
}

/**
 * Internal cleanup function
 */
async function cleanupContentInternal(contentId: string): Promise<void> {
  const content = await prisma.discoveredContent.findUnique({
    where: { id: contentId },
    select: {
      id: true,
      title: true,
      summary: true,
      facts: true,
      metadata: true
    }
  })

  if (!content) {
    return
  }

  const metadata = (content.metadata as any) || {}

  // Skip if already cleaned recently (within 24 hours)
  if (metadata.grammarCleaned && metadata.grammarCleanedAt) {
    const cleanedAt = new Date(metadata.grammarCleanedAt).getTime()
    const hoursSinceCleaned = (Date.now() - cleanedAt) / (1000 * 60 * 60)
    if (hoursSinceCleaned < 24 && metadata.contentQuality !== 'poor') {
      return
    }
  }

  const summary = content.summary || ''
  const keyFacts = Array.isArray(content.facts)
    ? content.facts.map((f: any) => f.value || f.text || f).filter(Boolean)
    : []

  // Check if content needs cleanup
  const hasUIText = summary.includes('Bookreader') ||
                   summary.includes('Item Preview') ||
                   summary.includes('Share or Embed') ||
                   summary.includes('Openlibrary_edition') ||
                   summary.includes('Page_number_confidence')

  if (!summary || (summary.length < 50 && !hasUIText)) {
    return // No meaningful content to clean
  }

  console.log(`[AutoCleanup] Cleaning content ${contentId}`)

  try {
    const cleanupResult = await cleanupWithDeepSeek(summary, keyFacts, content.title || 'Untitled')

    const updates: any = {
      metadata: {
        ...metadata,
        grammarCleaned: true,
        grammarCleanedAt: new Date().toISOString(),
        contentQuality: 'good'
      }
    }

    let hasChanges = false

    if (cleanupResult.summary && cleanupResult.summary.length > 0 && cleanupResult.summary !== summary) {
      updates.summary = cleanupResult.summary
      hasChanges = true
    }

    if (cleanupResult.keyFacts && cleanupResult.keyFacts.length > 0) {
      updates.facts = cleanupResult.keyFacts.map((fact: string) => ({
        label: 'Fact',
        value: fact
      }))
      hasChanges = true
    }

    if (hasChanges) {
      await prisma.discoveredContent.update({
        where: { id: contentId },
        data: updates
      })
      console.log(`[AutoCleanup] ✅ Cleaned and saved ${contentId}`)
    }
  } catch (error: any) {
    console.warn(`[AutoCleanup] Cleanup failed for ${contentId}:`, error.message)
    // Mark as failed so preview API can retry
    try {
      await prisma.discoveredContent.update({
        where: { id: contentId },
        data: {
          metadata: {
            ...metadata,
            cleanupFailed: true,
            cleanupFailedAt: new Date().toISOString(),
            cleanupError: error.message.substring(0, 200)
          } as any
        }
      })
    } catch (updateError) {
      // Ignore update errors
    }
  }
}

/**
 * Clean content with DeepSeek
 */
async function cleanupWithDeepSeek(summary: string, keyFacts: string[], title: string) {
  const prompt = `You are an expert editor. Clean up and improve the following content:

EXECUTIVE SUMMARY (current):
${summary}

${keyFacts && keyFacts.length > 0 ? `KEY FACTS (current):
${keyFacts.map((fact: string, i: number) => `${i + 1}. ${fact}`).join('\n')}

Requirements:
- Each fact must be a COMPLETE, meaningful sentence with proper subject and predicate
- Fix grammar, spelling, and punctuation
- COMPLETE fragments and incomplete thoughts - if a fact is incomplete, either complete it with context or remove it
- Remove standalone phrases, sentence fragments, and incomplete statements
- If a fact starts with "It", "That", "This", "They", etc. without clear context, either add context or remove it
- If a fact is a quote fragment, complete it or remove it
- Ensure each fact is substantive and informative (standalone and understandable)
- Each fact should be 20-200 characters
- Maintain factual accuracy
- DO NOT include facts that are incomplete or require context from other facts

` : ''}Requirements for Summary:
- Fix all grammar, spelling, and punctuation errors
- Ensure proper sentence structure and flow
- Make it clear, concise, and professional
- Remove fragments and incomplete thoughts
- Ensure it's a complete, well-written paragraph (2-4 sentences, 120-240 words)
- Remove UI text like "Share or Embed", "Item Preview", "Bookreader", etc.
- Remove metadata like "Openlibrary_edition", "Page_number_confidence", etc.
- Maintain factual accuracy

Return ONLY valid JSON in this exact format:
{
  "summary": "Cleaned and improved executive summary (2-4 sentences, 120-240 words)",
  "keyFacts": ${keyFacts && keyFacts.length > 0 ? `["Fact 1 (complete sentence)", "Fact 2 (complete sentence)", ...]` : '[]'},
  "improvements": ["List of improvements made", "e.g., Fixed grammar", "e.g., Completed fragment"]
}

CRITICAL: Return ONLY the JSON object, no other text.`

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are an expert editor that improves content quality. Always return valid JSON only, no other text.'
    },
    {
      role: 'user',
      content: prompt
    }
  ]

  let fullResponse = ''
  const stream = chatStream({
    model: 'deepseek-chat',
    messages,
    temperature: 0.3,
    max_tokens: 1500
  })

  for await (const chunk of stream) {
    if (chunk.type === 'token' && chunk.token) {
      fullResponse += chunk.token
    } else if (chunk.type === 'error') {
      throw new Error(chunk.error || 'DeepSeek API error')
    }
  }

  // Parse JSON response
  const jsonMatch = fullResponse.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in response')
  }

  const jsonData = JSON.parse(jsonMatch[0])
  return {
    summary: jsonData.summary || summary,
    keyFacts: Array.isArray(jsonData.keyFacts) ? jsonData.keyFacts : keyFacts,
    improvements: Array.isArray(jsonData.improvements) ? jsonData.improvements : []
  }
}

