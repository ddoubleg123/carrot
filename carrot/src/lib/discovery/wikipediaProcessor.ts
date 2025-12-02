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
/**
 * Score citation content using DeepSeek after fetching actual article content
 * This is called in Phase 2 after content is fetched
 */
async function scoreCitationContent(
  title: string,
  url: string,
  contentText: string,
  topic: string
): Promise<{ score: number; isRelevant: boolean; reason: string }> {
  try {
    const { chatStream } = await import('@/lib/llm/providers/DeepSeekClient')
    
    const prompt = `Analyze this article for relevance to "${topic}":

Title: ${title}
URL: ${url}
Content: ${contentText.substring(0, 10000)}${contentText.length > 10000 ? '...' : ''}

Score 0-100 based on relevance to "${topic}".
Consider:
1. How directly the article relates to "${topic}"
2. Whether it contains valuable information about "${topic}"
3. The depth and quality of information provided

Return ONLY valid JSON:
{"score": 85, "isRelevant": true, "reason": "Article discusses key events and players related to the topic"}

Return ONLY valid JSON, no other text.`

    let response = ''
    for await (const chunk of chatStream({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are a content relevance analyzer. Return only valid JSON objects with score (0-100), isRelevant (boolean), and reason (string).'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    })) {
      if (chunk.type === 'token' && chunk.token) {
        response += chunk.token
      }
    }

    // Clean and extract JSON from response
    let cleanResponse = response.replace(/```json/gi, '').replace(/```/g, '').trim()
    
    // Try to extract JSON object if response contains other text
    const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleanResponse = jsonMatch[0]
    }
    
    const result = JSON.parse(cleanResponse) as { score: number; isRelevant: boolean; reason: string }
    
    // Ensure score is in valid range
    const score = Math.max(0, Math.min(100, result.score || 0))
    const isRelevant = result.isRelevant ?? (score >= 60)
    
    return {
      score,
      isRelevant,
      reason: result.reason || `Scored ${score}/100`
    }
  } catch (error) {
    console.warn('[WikipediaProcessor] Content scoring failed, using default:', error)
    return {
      score: 50,
      isRelevant: false,
      reason: 'Scoring failed - default score'
    }
  }
}

// Note: prioritizeCitations is no longer used in Phase 1, but kept for backward compatibility
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
      max_tokens: Math.min(8000, Math.max(2000, citations.length * 15)) // Scale tokens with citation count, max 8000
    })) {
      if (chunk.type === 'token' && chunk.token) {
        response += chunk.token
      }
    }

    // Clean and extract JSON from response
    let cleanResponse = response.replace(/```json/gi, '').replace(/```/g, '').trim()
    
    // Try to extract JSON array if response contains other text
    const jsonMatch = cleanResponse.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      cleanResponse = jsonMatch[0]
    }
    
    // Try to fix common JSON issues
    let scores: Array<{ index: number; score: number; reason?: string }> = []
    try {
      scores = JSON.parse(cleanResponse) as Array<{ index: number; score: number; reason?: string }>
    } catch (parseError: any) {
      // If JSON is incomplete, try to extract valid partial JSON
      console.warn(`[WikipediaProcessor] JSON parse error at position ${parseError.message.match(/position (\d+)/)?.[1] || 'unknown'}, attempting recovery...`)
      
      // Try to extract valid JSON objects from the response
      const jsonObjects = cleanResponse.match(/\{[^}]*"index"[^}]*\}/g)
      if (jsonObjects && jsonObjects.length > 0) {
        try {
          scores = jsonObjects.map(obj => JSON.parse(obj))
          console.log(`[WikipediaProcessor] Recovered ${scores.length} scores from partial JSON`)
        } catch (recoveryError) {
          console.warn('[WikipediaProcessor] Could not recover JSON, using default scores')
          throw parseError // Re-throw original error
        }
      } else {
        throw parseError // Re-throw if we can't recover
      }
    }
    
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
import { canonicalizeUrlFast, getDomainFromUrl } from './canonicalize'

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
    console.log(`[WikipediaProcessor] No Wikipedia pages available to process for patch ${patchId}`)
    return { processed: false }
  }

  console.log(`[WikipediaProcessor] Processing Wikipedia page: ${nextPage.title}`)
  
  // Structured logging
  try {
    const { structuredLog } = await import('./structuredLogger')
    structuredLog('wikipedia_page_processing', {
      patchId,
      pageId: nextPage.id,
      pageTitle: nextPage.title,
      pageUrl: nextPage.url,
      timestamp: new Date().toISOString()
    })
  } catch {
    // Non-fatal
  }
  
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

    // Use citations already extracted by WikipediaSource.getPage()
    // It uses a method that works with REST API HTML format
    // Convert WikipediaSource citations to the format expected by extractAndStoreCitations
    const citationsFromPage = page.citations || []
    console.log(`[WikipediaProcessor] Using ${citationsFromPage.length} citations already extracted by WikipediaSource`)
    
    if (citationsFromPage.length === 0) {
      console.log(`[WikipediaProcessor] No citations found in page.citations, trying HTML extraction as fallback`)
      
      // Fallback: try HTML extraction if page.citations is empty
      let htmlForExtraction = page.rawHtml
      if (!htmlForExtraction) {
        try {
          const htmlUrl = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(nextPage.title)}`
          const htmlResponse = await fetch(htmlUrl, {
            headers: { 'User-Agent': 'CarrotApp/1.0 (Educational research platform)' }
          })
          if (htmlResponse.ok) {
            htmlForExtraction = await htmlResponse.text()
          }
        } catch (error) {
          console.error(`[WikipediaProcessor] Failed to fetch HTML:`, error)
        }
      }
      
      if (htmlForExtraction) {
        const { extractWikipediaCitationsWithContext } = await import('./wikiUtils')
        const extractedCitations = extractWikipediaCitationsWithContext(htmlForExtraction, nextPage.url, 10000)
        console.log(`[WikipediaProcessor] HTML extraction found ${extractedCitations.length} citations`)
        
        // Convert to format for storage
        const convertedCitations = extractedCitations.map(c => ({
          url: c.url,
          title: c.title,
          context: c.context,
          text: c.text || c.title || c.context
        }))
        
        const prioritizeFn = options.prioritizeCitationsFn || ((citations, sourceUrl) => 
          prioritizeCitations(citations, sourceUrl, options.patchName, [options.patchHandle])
        )
        const prioritized = await prioritizeFn(convertedCitations, nextPage.url)
        
        // Store citations
        const { extractAndStoreCitations } = await import('./wikipediaCitation')
        const result = await extractAndStoreCitations(
          nextPage.id,
          nextPage.url,
          htmlForExtraction,
          prioritizeFn
        )
        
        await markCitationsExtracted(nextPage.id, result.citationsFound)
        return { processed: true, pageTitle: nextPage.title, citationsFound: result.citationsFound }
      } else {
        console.error(`[WikipediaProcessor] No citations and no HTML available for ${nextPage.title}`)
        await markWikipediaPageError(nextPage.id, 'No citations found and no HTML available')
        return { processed: true, pageTitle: nextPage.title }
      }
    }
    
    // Convert WikipediaSource citations to format expected by storage
    const convertedCitations = citationsFromPage
      .filter(c => c.url && !c.url.includes('wikipedia.org')) // Filter out Wikipedia links
      .map(c => ({
        url: c.url!,
        title: c.title || c.text?.substring(0, 100),
        context: c.text,
        text: c.text || c.title
      }))
    
    console.log(`[WikipediaProcessor] Converted ${convertedCitations.length} citations (filtered from ${citationsFromPage.length})`)
    
    // Phase 1: Store citations WITHOUT scoring (scoring happens in Phase 2 after content fetch)
    // Store citations in database without aiPriorityScore (will be scored after content fetch)
    const { prisma } = await import('@/lib/prisma')
    let citationsStored = 0
    for (let i = 0; i < convertedCitations.length; i++) {
      const citation = convertedCitations[i]
      const sourceNumber = i + 1
      
      try {
        const existing = await prisma.wikipediaCitation.findUnique({
          where: {
            monitoringId_sourceNumber: {
              monitoringId: nextPage.id,
              sourceNumber
            }
          }
        })
        
        if (existing) continue
        
        await prisma.wikipediaCitation.create({
          data: {
            monitoringId: nextPage.id,
            sourceNumber,
            citationUrl: citation.url,
            citationTitle: citation.title,
            citationContext: citation.context,
            aiPriorityScore: null, // Will be scored in Phase 2 after content fetch
            verificationStatus: 'pending',
            scanStatus: 'not_scanned'
          }
        })
        citationsStored++
      } catch (error) {
        console.error(`[WikipediaProcessor] Error storing citation ${sourceNumber}:`, error)
      }
    }
    
    const citationsFound = convertedCitations.length
    await markCitationsExtracted(nextPage.id, citationsFound)
    
    // DON'T mark page as complete yet - wait until ALL citations are processed
    // Page will be marked complete when checkAndMarkPageCompleteIfAllCitationsProcessed is called

    console.log(`[WikipediaProcessor] Completed page "${nextPage.title}": ${citationsStored} citations stored`)
    
    // Structured logging for completion
    try {
      const { structuredLog } = await import('./structuredLogger')
      structuredLog('wikipedia_page_complete', {
        patchId,
        pageId: nextPage.id,
        pageTitle: nextPage.title,
        citationsFound,
        citationsStored,
        timestamp: new Date().toISOString()
      })
    } catch {
      // Non-fatal
    }
    
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
    saveAsContent?: (url: string, title: string, content: string, relevanceData?: { aiScore?: number; relevanceScore?: number; isRelevant?: boolean }) => Promise<string | null> // Returns DiscoveredContent.id
    saveAsMemory?: (url: string, title: string, content: string, patchHandle: string, wikipediaPageTitle?: string) => Promise<string | null> // Returns AgentMemory.id
  }
): Promise<{ processed: boolean; citationUrl?: string; saved?: boolean; monitoringId?: string }> {
  const nextCitation = await getNextCitationToProcess(patchId)
  
  if (!nextCitation) {
    console.log(`[WikipediaProcessor] No citations available to process for patch ${patchId}`)
    return { processed: false }
  }

  console.log(`[WikipediaProcessor] Processing citation: ${nextCitation.citationUrl}`)

  try {
    // Get Wikipedia page info for URL conversion and tagging
    const monitoring = await prisma.wikipediaMonitoring.findUnique({
      where: { id: nextCitation.monitoringId },
      select: { wikipediaUrl: true, wikipediaTitle: true }
    })

    if (!monitoring) {
      console.error(`[WikipediaProcessor] Monitoring record not found for citation ${nextCitation.id}`)
      return { processed: false }
    }

    // Convert relative Wikipedia URLs to absolute URLs
    let citationUrl = nextCitation.citationUrl
    if (citationUrl.startsWith('./') || citationUrl.startsWith('../') || !citationUrl.startsWith('http')) {
      // This is a relative Wikipedia link - convert to full URL
      const pageTitle = citationUrl.replace(/^\.\//, '').replace(/^\.\.\//, '')
      citationUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, '_'))}`
      console.log(`[WikipediaProcessor] Converted relative URL to: ${citationUrl}`)
    }

    // Check for duplicate in DiscoveredContent (deduplication)
    const canonicalUrl = canonicalizeUrlFast(citationUrl) || citationUrl
    if (canonicalUrl) {
      const existing = await prisma.discoveredContent.findUnique({
        where: {
          patchId_canonicalUrl: {
            patchId,
            canonicalUrl
          }
        },
        select: { id: true }
      })

      if (existing) {
        console.log(`[WikipediaProcessor] Citation already exists in DiscoveredContent, skipping: ${canonicalUrl}`)
        // Mark as saved (already exists)
        await markCitationScanned(
          nextCitation.id,
          'saved',
          existing.id,
          undefined
        )
        // Check if page can be marked complete
        await checkAndMarkPageCompleteIfAllCitationsProcessed(nextCitation.monitoringId)
        return { 
          processed: true, 
          citationUrl: citationUrl, 
          saved: true,
          monitoringId: nextCitation.monitoringId
        }
      }
    }

    // Mark as verifying
    await markCitationVerifying(nextCitation.id)

    // Verify URL is accessible
    let response: Response
    try {
      response = await fetch(citationUrl, {
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
      return { processed: true, citationUrl: citationUrl }
    }

    // Mark as scanning
    await markCitationScanning(nextCitation.id)

    // Fetch and process content
    try {
      response = await fetch(citationUrl, {
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

      // Phase 2: Content validation - ensure meaningful content
      const MIN_CONTENT_LENGTH = 500
      const meaningfulContent = textContent.trim()
      const hasSufficientContent = meaningfulContent.length >= MIN_CONTENT_LENGTH
      
      if (!hasSufficientContent) {
        console.log(`[WikipediaProcessor] Citation "${nextCitation.citationTitle}" rejected: insufficient content (${meaningfulContent.length} chars, need ${MIN_CONTENT_LENGTH})`)
        await markCitationScanned(
          nextCitation.id,
          'denied',
          undefined,
          undefined,
          meaningfulContent, // Store content even if rejected
          undefined // No score if content is insufficient
        )
        await checkAndMarkPageCompleteIfAllCitationsProcessed(nextCitation.monitoringId)
        return { processed: true, citationUrl: citationUrl, monitoringId: nextCitation.monitoringId }
      }

      // Phase 2: Score content using DeepSeek with actual article content
      console.log(`[WikipediaProcessor] Scoring citation content for "${nextCitation.citationTitle}"...`)
      const scoringResult = await scoreCitationContent(
        nextCitation.citationTitle || 'Untitled',
        citationUrl,
        meaningfulContent,
        options.patchName
      )
      
      const aiPriorityScore = scoringResult.score
      const isRelevantFromDeepSeek = scoringResult.isRelevant && aiPriorityScore >= 60
      
      console.log(`[WikipediaProcessor] DeepSeek content scoring for "${nextCitation.citationTitle}":`, {
        score: aiPriorityScore,
        isRelevant: scoringResult.isRelevant,
        reason: scoringResult.reason,
        finalDecision: isRelevantFromDeepSeek ? 'RELEVANT' : 'NOT RELEVANT'
      })

      // Optional: Secondary validation using RelevanceEngine
      let relevanceEngineResult: { score: number; isRelevant: boolean; reason?: string; matchedEntities: string[] } | null = null
      try {
        const { RelevanceEngine } = await import('./relevance')
        const relevanceEngine = new RelevanceEngine()
        await relevanceEngine.buildEntityProfile(options.patchHandle, options.patchName)
        const domain = new URL(citationUrl).hostname.replace(/^www\./, '')
        relevanceEngineResult = await relevanceEngine.checkRelevance(
          options.patchHandle,
          nextCitation.citationTitle || 'Untitled',
          meaningfulContent,
          domain
        )
        console.log(`[WikipediaProcessor] RelevanceEngine validation:`, {
          score: relevanceEngineResult.score,
          isRelevant: relevanceEngineResult.isRelevant,
          matchedEntities: relevanceEngineResult.matchedEntities,
          reason: relevanceEngineResult.reason
        })
      } catch (error) {
        console.warn(`[WikipediaProcessor] RelevanceEngine validation failed (non-fatal):`, error)
      }

      // Final relevance decision: Primary check is DeepSeek score (>= 60 and isRelevant)
      // Secondary check (optional): RelevanceEngine can override if it strongly disagrees
      const finalIsRelevant = isRelevantFromDeepSeek && 
        (!relevanceEngineResult || relevanceEngineResult.isRelevant || relevanceEngineResult.score >= 0.5)
      
      console.log(`[WikipediaProcessor] Final relevance decision for "${nextCitation.citationTitle}":`, {
        deepSeekScore: aiPriorityScore,
        deepSeekRelevant: isRelevantFromDeepSeek,
        relevanceEngineScore: relevanceEngineResult?.score,
        relevanceEngineRelevant: relevanceEngineResult?.isRelevant,
        finalDecision: finalIsRelevant ? 'RELEVANT' : 'NOT RELEVANT'
      })
      
      let savedContentId: string | null = null
      let savedMemoryId: string | null = null

      // Save citations to DiscoveredContent
      // Only save if DeepSeek approves (score >= 60 and isRelevant)
      // isUseful flag will determine if it's published to the page
      if (finalIsRelevant && options.saveAsContent) {
        savedContentId = await options.saveAsContent(
          citationUrl, // Use converted URL
          nextCitation.citationTitle || 'Untitled',
          meaningfulContent,
          {
            aiScore: aiPriorityScore,
            relevanceScore: relevanceEngineResult?.score ?? 0,
            isRelevant: true
          }
        ) || null
        
        // Trigger hero image generation in background (non-blocking)
        if (savedContentId) {
          // Fire and forget - don't await
          const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
          fetch(`${baseUrl}/api/internal/enrich/${savedContentId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Internal-Token': process.env.INTERNAL_ENRICH_TOKEN || 'internal-token'
            }
          }).catch(err => {
            console.warn(`[WikipediaProcessor] Failed to trigger hero generation for ${savedContentId}:`, err)
            // Non-fatal - hero can be generated later
          })
        }
      } else if (!finalIsRelevant) {
        console.log(`[WikipediaProcessor] Citation "${nextCitation.citationTitle}" rejected: ${scoringResult.reason || 'Failed DeepSeek relevance check'}`)
      }

      // Only save to AgentMemory if relevant (for AI knowledge)
      // Pass Wikipedia page title for segregation
      if (finalIsRelevant && options.saveAsMemory) {
        savedMemoryId = await options.saveAsMemory(
          citationUrl, // Use converted URL
          nextCitation.citationTitle || 'Untitled',
          meaningfulContent,
          options.patchHandle,
          monitoring?.wikipediaTitle // Pass Wikipedia page title for segregation
        ) || null
      }

      // Mark as scanned - store content, score, and decision
      await markCitationScanned(
        nextCitation.id,
        savedContentId ? 'saved' : 'denied', // 'saved' if successfully stored in DiscoveredContent
        savedContentId || undefined,
        savedMemoryId || undefined,
        meaningfulContent, // Store extracted content
        aiPriorityScore // Store DeepSeek score from actual content
      )

      console.log(`[WikipediaProcessor] Citation processed: ${savedContentId ? 'saved to database' : 'rejected'}${finalIsRelevant ? ' (relevant - added to memory)' : ' (not relevant - content stored for audit)'}`)

      // Check if page can be marked complete after processing this citation
      await checkAndMarkPageCompleteIfAllCitationsProcessed(nextCitation.monitoringId)

      return {
        processed: true,
        citationUrl: citationUrl,
        saved: finalIsRelevant,
        monitoringId: nextCitation.monitoringId
      }
    } catch (error) {
      await markCitationVerificationFailed(
        nextCitation.id,
        error instanceof Error ? error.message : 'Content fetch failed'
      )
      // Check if page can be marked complete even on error
      await checkAndMarkPageCompleteIfAllCitationsProcessed(nextCitation.monitoringId)
      return { processed: true, citationUrl: citationUrl, monitoringId: nextCitation.monitoringId }
    }
  } catch (error) {
    console.error(`[WikipediaProcessor] Error processing citation:`, error)
    await markCitationVerificationFailed(
      nextCitation.id,
      error instanceof Error ? error.message : 'Unknown error'
    )
    // Check if page can be marked complete even on error
    await checkAndMarkPageCompleteIfAllCitationsProcessed(nextCitation.monitoringId)
    return { processed: true, citationUrl: nextCitation.citationUrl, monitoringId: nextCitation.monitoringId }
  }
}

/**
 * Check if all citations for a Wikipedia page have been processed
 * If so, mark the page as complete
 */
/**
 * Check if all citations for a page have been processed, and mark page as complete if so.
 * 
 * A citation is considered "processed" if:
 * - It has been scanned (scanStatus: 'scanned'), OR
 * - Verification failed (verificationStatus: 'failed') - these are processed even if not scanned
 * 
 * This ensures pages are only marked complete when ALL citations have been reviewed.
 */
async function checkAndMarkPageCompleteIfAllCitationsProcessed(monitoringId: string): Promise<void> {
  try {
    // Count total citations and processed citations
    const totalCitations = await prisma.wikipediaCitation.count({
      where: { monitoringId }
    })

    if (totalCitations === 0) {
      // No citations to process - page can be marked complete
      await markWikipediaPageComplete(monitoringId)
      console.log(`[WikipediaProcessor] Page has no citations, marking as complete`)
      return
    }

    // A citation is "processed" if:
    // 1. It has been scanned (scanStatus: 'scanned'), OR
    // 2. Verification failed (verificationStatus: 'failed') - these are processed even if not scanned
    const processedCitations = await prisma.wikipediaCitation.count({
      where: {
        monitoringId,
        OR: [
          { scanStatus: 'scanned' }, // Any scanned citation is processed
          { verificationStatus: 'failed' } // Failed citations are processed even if not scanned
        ]
      }
    })

    console.log(`[WikipediaProcessor] Page completion check: ${processedCitations}/${totalCitations} citations processed`)

    // If all citations are processed, mark page as complete
    if (processedCitations >= totalCitations) {
      await markWikipediaPageComplete(monitoringId)
      console.log(`[WikipediaProcessor] ✅ All ${totalCitations} citations processed, marking page as complete`)
    } else {
      const unprocessed = totalCitations - processedCitations
      console.log(`[WikipediaProcessor] ⏳ Page not complete: ${unprocessed} citations still need processing`)
    }
  } catch (error) {
    console.error(`[WikipediaProcessor] Error checking page completion:`, error)
    // Non-fatal - continue
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
    saveAsContent?: (url: string, title: string, content: string, relevanceData?: { aiScore?: number; relevanceScore?: number; isRelevant?: boolean }) => Promise<string | null>
    saveAsMemory?: (url: string, title: string, content: string, patchHandle: string, wikipediaPageTitle?: string) => Promise<string | null>
  }
): Promise<{
  pagesProcessed: number
  citationsProcessed: number
  citationsSaved: number
}> {
  console.log(`[WikipediaProcessor] processWikipediaIncremental called for patch ${patchId}`)
  const maxPages = options.maxPagesPerRun || 1
  const maxCitations = options.maxCitationsPerRun || 50 // Process more citations per run (was 5)

  // Quick check: verify Wikipedia monitoring exists for this patch
  const { prisma } = await import('@/lib/prisma')
  const monitoringCount = await prisma.wikipediaMonitoring.count({
    where: { patchId }
  })
  if (monitoringCount === 0) {
    console.warn(`[WikipediaProcessor] ⚠️ No Wikipedia pages in monitoring table for patch ${patchId}. Wikipedia monitoring may not have been initialized.`)
    return { pagesProcessed: 0, citationsProcessed: 0, citationsSaved: 0 }
  }

  let pagesProcessed = 0
  let citationsProcessed = 0
  let citationsSaved = 0

  // Process Wikipedia pages first
  console.log(`[WikipediaProcessor] Processing up to ${maxPages} pages and ${maxCitations} citations (${monitoringCount} pages in monitoring table)`)
  for (let i = 0; i < maxPages; i++) {
    const result = await processNextWikipediaPage(patchId, {
      patchName: options.patchName,
      patchHandle: options.patchHandle,
      prioritizeCitationsFn: options.prioritizeCitationsFn
    })

    if (!result.processed) {
      console.log(`[WikipediaProcessor] No more pages to process (attempted ${i + 1})`)
      break
    }
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

    if (!result.processed) {
      if (i === 0) {
        console.log(`[WikipediaProcessor] No citations to process`)
      }
      break
    }
    citationsProcessed++
    if (result.saved) citationsSaved++
  }

  console.log(`[WikipediaProcessor] Completed: ${pagesProcessed} pages, ${citationsProcessed} citations, ${citationsSaved} saved`)
  return {
    pagesProcessed,
    citationsProcessed,
    citationsSaved
  }
}

