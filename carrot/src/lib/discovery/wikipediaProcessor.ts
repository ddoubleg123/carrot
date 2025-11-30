/**
 * Wikipedia Processor Service
 * Handles incremental processing of Wikipedia pages and citations
 * Integrates with discovery engine for resume capability
 */

import { prisma } from '@/lib/prisma'
import {
  getNextWikipediaPageToProcess,
  markWikipediaPageScanning,
  updateWikipediaPageContent,
  markCitationsExtracted,
  markWikipediaPageComplete,
  markWikipediaPageError
} from './wikipediaMonitoring'
import {
  extractAndStoreCitations,
  getNextCitationToProcess,
  markCitationVerifying,
  markCitationVerificationFailed,
  markCitationScanning,
  markCitationScanned
} from './wikipediaCitation'
import { WikipediaSource } from './wikipediaSource'
// Note: prioritizeCitations will be imported from a shared utility
// For now, using a simple wrapper
async function prioritizeCitations(
  citations: Array<{ url: string; title?: string; context?: string; text?: string }>,
  sourceUrl: string,
  topic: string,
  aliases: string[]
): Promise<Array<{ url: string; title?: string; context?: string; text?: string; score?: number }>> {
  if (citations.length === 0) return []
  if (citations.length <= 10) {
    return citations.map(c => ({ ...c, score: 70 }))
  }

  try {
    const { chatStream } = await import('@/lib/llm/providers/DeepSeekClient')
    const citationsText = citations.map((c, i) => 
      `${i + 1}. ${c.title || c.url}\n   URL: ${c.url}\n   Context: ${c.context || c.text || 'No context'}\n`
    ).join('\n')

    const prompt = `You are analyzing Wikipedia citations to prioritize the most important sources for the topic: "${topic}".

Topic: "${topic}" (aliases: ${aliases.join(', ')})
Source Wikipedia page: ${sourceUrl}

Citations found:
${citationsText}

Task: Score each citation (0-100) based on:
1. Relevance to the core topic (${topic})
2. Importance/authority of the source
3. Likelihood of containing valuable, factual information
4. Recency (if date is mentioned in title/context)

Return JSON array with scores:
[
  {"index": 1, "score": 85, "reason": "Official source about key event"},
  {"index": 2, "score": 45, "reason": "Generic news article"},
  ...
]

Return ONLY valid JSON array, no other text.`

    let response = ''
    for await (const chunk of chatStream({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are a citation prioritization expert. Return only valid JSON arrays.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    })) {
      if (chunk.type === 'token' && chunk.token) {
        response += chunk.token
      }
    }

    const cleanResponse = response.replace(/```json/gi, '').replace(/```/g, '').trim()
    const scores = JSON.parse(cleanResponse) as Array<{ index: number; score: number; reason?: string }>
    
    const scored = citations.map((citation, index) => {
      const scoreData = scores.find(s => s.index === index + 1)
      return {
        ...citation,
        score: scoreData?.score ?? 50,
        reason: scoreData?.reason
      }
    })

    scored.sort((a, b) => (b.score ?? 50) - (a.score ?? 50))
    return scored
  } catch (error) {
    console.warn('[WikipediaProcessor] Citation prioritization failed, using default scores:', error)
    return citations.map(c => ({ ...c, score: 50 }))
  }
}
import { canonicalizeUrlFast } from './canonicalize'

/**
 * Process next Wikipedia page (scan content and extract citations)
 * Returns true if a page was processed, false if none available
 */
export async function processNextWikipediaPage(
  patchId: string,
  options: {
    patchName: string
    patchHandle: string
    prioritizeCitationsFn?: (citations: any[], sourceUrl: string) => Promise<Array<any & { score?: number }>>
  }
): Promise<{ processed: boolean; pageTitle?: string; citationsFound?: number }> {
  const nextPage = await getNextWikipediaPageToProcess(patchId)
  
  if (!nextPage) {
    return { processed: false }
  }

  console.log(`[WikipediaProcessor] Processing Wikipedia page: ${nextPage.title}`)
  
  try {
    // Mark as scanning
    await markWikipediaPageScanning(nextPage.id)

    // Fetch Wikipedia page content
    const page = await WikipediaSource.getPage(nextPage.title)
    
    if (!page) {
      await markWikipediaPageError(nextPage.id, 'Failed to fetch Wikipedia page')
      return { processed: true, pageTitle: nextPage.title }
    }

    // Store content for memory
    await updateWikipediaPageContent(nextPage.id, page.content)

    // Extract and store citations
    const prioritizeFn = options.prioritizeCitationsFn || ((citations, sourceUrl) => 
      prioritizeCitations(citations, sourceUrl, options.patchName, [options.patchHandle])
    )
    const { citationsFound, citationsStored } = await extractAndStoreCitations(
      nextPage.id,
      nextPage.url,
      page.content,
      prioritizeFn
    )

    // Mark citations as extracted
    await markCitationsExtracted(nextPage.id, citationsFound)
    
    // Mark page as complete
    await markWikipediaPageComplete(nextPage.id)

    console.log(`[WikipediaProcessor] Completed page "${nextPage.title}": ${citationsStored} citations stored`)
    
    return {
      processed: true,
      pageTitle: nextPage.title,
      citationsFound
    }
  } catch (error) {
    console.error(`[WikipediaProcessor] Error processing page "${nextPage.title}":`, error)
    await markWikipediaPageError(
      nextPage.id,
      error instanceof Error ? error.message : 'Unknown error'
    )
    return { processed: true, pageTitle: nextPage.title }
  }
}

/**
 * Process next citation (verify, scan, and save if relevant)
 * Returns true if a citation was processed, false if none available
 */
export async function processNextCitation(
  patchId: string,
  options: {
    patchName: string
    patchHandle: string
    saveAsContent?: (url: string, title: string, content: string) => Promise<string | null> // Returns DiscoveredContent.id
    saveAsMemory?: (url: string, title: string, content: string, patchHandle: string) => Promise<string | null> // Returns AgentMemory.id // Returns AgentMemory.id
  }
): Promise<{ processed: boolean; citationUrl?: string; saved?: boolean }> {
  const nextCitation = await getNextCitationToProcess(patchId)
  
  if (!nextCitation) {
    return { processed: false }
  }

  console.log(`[WikipediaProcessor] Processing citation: ${nextCitation.citationUrl}`)

  try {
    // Mark as verifying
    await markCitationVerifying(nextCitation.id)

    // Verify URL is accessible
    let response: Response
    try {
      response = await fetch(nextCitation.citationUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      await markCitationVerificationFailed(
        nextCitation.id,
        error instanceof Error ? error.message : 'URL verification failed'
      )
      return { processed: true, citationUrl: nextCitation.citationUrl }
    }

    // Mark as scanning
    await markCitationScanning(nextCitation.id)

    // Fetch and process content
    try {
      response = await fetch(nextCitation.citationUrl, {
        signal: AbortSignal.timeout(30000) // 30 second timeout
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const html = await response.text()
      
      // Extract text content (simplified - could use better extraction)
      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 50000) // Limit to 50k chars

      // Determine relevance (simplified - should use actual relevance engine)
      const isRelevant = textContent.length > 500 // Basic heuristic
      
      let savedContentId: string | null = null
      let savedMemoryId: string | null = null

      if (isRelevant) {
        // Save as discovered content if function provided
        if (options.saveAsContent) {
          savedContentId = await options.saveAsContent(
            nextCitation.citationUrl,
            nextCitation.citationTitle || 'Untitled',
            textContent
          ) || null
        }

        // Save as agent memory if function provided
        if (options.saveAsMemory) {
          savedMemoryId = await options.saveAsMemory(
            nextCitation.citationUrl,
            nextCitation.citationTitle || 'Untitled',
            textContent,
            options.patchHandle
          ) || null
        }
      }

      // Mark as scanned with decision
      await markCitationScanned(
        nextCitation.id,
        isRelevant ? 'saved' : 'denied',
        savedContentId || undefined,
        savedMemoryId || undefined
      )

      console.log(`[WikipediaProcessor] Citation processed: ${isRelevant ? 'saved' : 'denied'}`)

      return {
        processed: true,
        citationUrl: nextCitation.citationUrl,
        saved: isRelevant
      }
    } catch (error) {
      await markCitationVerificationFailed(
        nextCitation.id,
        error instanceof Error ? error.message : 'Content fetch failed'
      )
      return { processed: true, citationUrl: nextCitation.citationUrl }
    }
  } catch (error) {
    console.error(`[WikipediaProcessor] Error processing citation:`, error)
    await markCitationVerificationFailed(
      nextCitation.id,
      error instanceof Error ? error.message : 'Unknown error'
    )
    return { processed: true, citationUrl: nextCitation.citationUrl }
  }
}

/**
 * Process Wikipedia pages and citations incrementally
 * Can be called from discovery engine to continue from last checkpoint
 */
export async function processWikipediaIncremental(
  patchId: string,
  options: {
    patchName: string
    patchHandle: string
    maxPagesPerRun?: number
    maxCitationsPerRun?: number
    prioritizeCitationsFn?: (citations: any[], sourceUrl: string) => Promise<Array<any & { score?: number }>>
    saveAsContent?: (url: string, title: string, content: string) => Promise<string | null>
    saveAsMemory?: (url: string, title: string, content: string, patchHandle: string) => Promise<string | null>
  }
): Promise<{
  pagesProcessed: number
  citationsProcessed: number
  citationsSaved: number
}> {
  const maxPages = options.maxPagesPerRun || 1
  const maxCitations = options.maxCitationsPerRun || 5

  let pagesProcessed = 0
  let citationsProcessed = 0
  let citationsSaved = 0

  // Process Wikipedia pages first
  for (let i = 0; i < maxPages; i++) {
    const result = await processNextWikipediaPage(patchId, {
      patchName: options.patchName,
      patchHandle: options.patchHandle,
      prioritizeCitationsFn: options.prioritizeCitationsFn
    })

    if (!result.processed) break
    pagesProcessed++
  }

  // Then process citations
  for (let i = 0; i < maxCitations; i++) {
    const result = await processNextCitation(patchId, {
      patchName: options.patchName,
      patchHandle: options.patchHandle,
      saveAsContent: options.saveAsContent,
      saveAsMemory: options.saveAsMemory
    })

    if (!result.processed) break
    citationsProcessed++
    if (result.saved) citationsSaved++
  }

  return {
    pagesProcessed,
    citationsProcessed,
    citationsSaved
  }
}

