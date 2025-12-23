/**
 * API endpoint to trigger content enrichment for Israel patch
 * POST /api/dev/enrich-israel-content
 * 
 * This endpoint runs on the server where DEEPSEEK_API_KEY is available
 * and enriches all content with quotes and grammar cleanup.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { chatStream, type ChatMessage } from '@/lib/llm/providers/DeepSeekClient'

// Verify internal API key
function verifyInternalKey(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const apiKey = request.headers.get('x-internal-key')
  const expectedKey = process.env.INTERNAL_API_KEY
  
  if (!expectedKey) {
    console.warn('[EnrichIsrael] INTERNAL_API_KEY not set, allowing request')
    return true // Allow if not configured (for development)
  }
  
  return apiKey === expectedKey || authHeader === `Bearer ${expectedKey}`
}

async function cleanupContent(summary: string, keyFacts: string[], title: string) {
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

export async function POST(request: NextRequest) {
  try {
    // Verify internal API key
    if (!verifyInternalKey(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const patch = await prisma.patch.findUnique({
      where: { handle: 'israel' },
      select: { id: true }
    })

    if (!patch) {
      return NextResponse.json(
        { error: 'Patch "israel" not found' },
        { status: 404 }
      )
    }

    // Get content items that need enrichment
    const contentItems = await prisma.discoveredContent.findMany({
      where: {
        patchId: patch.id,
        OR: [
          { summary: { not: null } },
          { facts: { not: null } }
        ]
      },
      select: {
        id: true,
        title: true,
        summary: true,
        textContent: true,
        quotes: true,
        facts: true,
        metadata: true
      },
      take: 50 // Process in batches
    })

    console.log(`[EnrichIsrael] Found ${contentItems.length} items to enrich`)

    const results = {
      total: contentItems.length,
      enriched: 0,
      failed: 0,
      skipped: 0,
      errors: [] as string[]
    }

    for (let i = 0; i < contentItems.length; i++) {
      const item = contentItems[i]
      const metadata = (item.metadata as any) || {}

      // Skip if recently cleaned (within 24 hours)
      if (metadata.grammarCleaned && metadata.grammarCleanedAt) {
        const cleanedAt = new Date(metadata.grammarCleanedAt).getTime()
        const hoursSinceCleaned = (Date.now() - cleanedAt) / (1000 * 60 * 60)
        if (hoursSinceCleaned < 24) {
          results.skipped++
          continue
        }
      }

      try {
        console.log(`[EnrichIsrael] [${i + 1}/${contentItems.length}] Enriching: ${item.id}`)

        // Grammar cleanup
        if (item.summary || (item.facts && Array.isArray(item.facts) && item.facts.length > 0)) {
          const keyFacts = Array.isArray(item.facts)
            ? item.facts.map((f: any) => f.value || f.text || f).filter(Boolean)
            : []

          const cleanupResult = await cleanupContent(
            item.summary || '',
            keyFacts,
            item.title || 'Untitled'
          )

          const updates: any = {
            metadata: {
              ...metadata,
              grammarCleaned: true,
              grammarCleanedAt: new Date().toISOString()
            }
          }

          if (cleanupResult.summary && cleanupResult.summary.length > 0) {
            updates.summary = cleanupResult.summary
          }

          if (cleanupResult.keyFacts && cleanupResult.keyFacts.length > 0) {
            updates.facts = cleanupResult.keyFacts.map((fact: string) => ({
              label: 'Fact',
              value: fact
            }))
          }

          await prisma.discoveredContent.update({
            where: { id: item.id },
            data: updates
          })

          results.enriched++
          console.log(`[EnrichIsrael] ✅ Enriched ${item.id}`)
        } else {
          results.skipped++
        }
      } catch (error: any) {
        results.failed++
        const errorMsg = `Failed to enrich ${item.id}: ${error.message}`
        results.errors.push(errorMsg)
        console.error(`[EnrichIsrael] ❌ ${errorMsg}`)
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    return NextResponse.json({
      success: true,
      message: `Enrichment complete: ${results.enriched} enriched, ${results.failed} failed, ${results.skipped} skipped`,
      results
    })

  } catch (error: any) {
    console.error('[EnrichIsrael] Error:', error)
    return NextResponse.json(
      { error: 'Failed to enrich content', details: error.message },
      { status: 500 }
    )
  }
}

