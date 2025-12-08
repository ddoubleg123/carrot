/**
 * Wikipedia Processor Service
 * Handles incremental processing of Wikipedia pages and citations
 * Integrates with discovery engine for resume capability
 */

import { prisma } from '@/lib/prisma'
import { createHash } from 'crypto'
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
 * Check if URL is a low-quality source (library catalog, authority file, metadata page)
 * These should be filtered out before processing
 */
function isLowQualityUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.replace(/^www\./, '')
    const pathname = urlObj.pathname.toLowerCase()
    
    // Low-quality domains
    const lowQualityDomains = [
      'viaf.org',
      'id.loc.gov',
      'id.ndl.go.jp',
      'nli.org.il',
      'collections.yale.edu',
      'web.archive.org', // Archive pages are usually not primary sources
      'commons.wikimedia.org', // Media files, not articles
      'upload.wikimedia.org',
      'wikidata.org',
    ]
    
    // Check domain
    if (lowQualityDomains.some(domain => hostname.includes(domain))) {
      return true
    }
    
    // Low-quality URL patterns
    const lowQualityPatterns = [
      /\/authorities\//,
      /\/viaf\//,
      /\/auth\//,
      /\/catalog\//,
      /\/authority\//,
      /\/authority-control/,
      /\/bibliographic/,
      /\/metadata/,
      /\/record\//,
      /\/item\//, // Wikidata items
    ]
    
    // Check path patterns
    if (lowQualityPatterns.some(pattern => pattern.test(pathname))) {
      return true
    }
    
    return false
  } catch (error) {
    // If URL parsing fails, assume it's valid (let verification catch it)
    return false
  }
}

/**
 * Check if content is an actual article (not a metadata/catalog page)
 * Made more lenient - some articles are formatted as single paragraphs
 */
function isActualArticle(content: string, url: string): boolean {
  // Must have substantial content
  if (content.length < 1000) {
    return false
  }
  
  // Check for article structure (paragraphs, not just metadata)
  // Made more lenient: accept if >= 1 paragraph (some articles are single long paragraphs)
  const paragraphCount = (content.match(/\n\n/g) || []).length + 1
  if (paragraphCount < 1) {
    return false
  }
  
  // Check for narrative indicators (sentences with proper structure)
  // Made more lenient: check for multiple sentences (not just one)
  const sentenceCount = (content.match(/[.!?]\s+[A-Z]/g) || []).length
  if (sentenceCount < 3) {
    // If very few sentences, might be metadata
    return false
  }
  
  // Reject if it looks like a catalog/authority page
  const catalogIndicators = [
    'authority control',
    'catalog record',
    'bibliographic',
    'metadata',
    'viaf',
    'lccn',
    'isni',
    'library of congress',
    'national library',
    'authority file',
    'controlled vocabulary',
  ]
  
  const lowerContent = content.toLowerCase()
  const catalogScore = catalogIndicators.filter(ind => 
    lowerContent.includes(ind)
  ).length
  
  // If more than 2 catalog indicators, likely not an article
  if (catalogScore >= 2) {
    return false
  }
  
  // Check for actual article indicators
  const articleIndicators = [
    'article',
    'published',
    'wrote',
    'said',
    'according to',
    'reported',
    'interview',
    'analysis',
  ]
  
  const articleScore = articleIndicators.filter(ind => 
    lowerContent.includes(ind)
  ).length
  
  // If has article indicators, likely an article
  return articleScore >= 1
}

/**
 * Check if a Wikipedia page (including Portal pages) is relevant to the topic
 * This is more lenient than scoreCitationContent - we want Portal pages if they're topic-relevant
 * because we want to crawl them to extract their citations
 */
async function checkWikipediaPageRelevance(
  title: string,
  url: string,
  contentText: string,
  topic: string
): Promise<{ score: number; isRelevant: boolean; reason: string }> {
  try {
    const { chatStream } = await import('@/lib/llm/providers/DeepSeekClient')
    
    const prompt = `Analyze this Wikipedia page for relevance to "${topic}":

Title: ${title}
URL: ${url}
Content: ${contentText.substring(0, 10000)}${contentText.length > 10000 ? '...' : ''}

NOTE: This is a Wikipedia page (may be a Portal, article, or other page type). We want to know if it's relevant to "${topic}" so we can crawl it and extract citations from it.

Return JSON:
{
  "score": 0-100,
  "isRelevant": boolean,
  "reason": string
}

Scoring criteria:
1. How directly does this page relate to "${topic}"?
2. Would this page likely contain links or citations relevant to "${topic}"?
3. Is this page about topics related to "${topic}"?

Be inclusive - Portal pages, category pages, and navigation pages are acceptable if they relate to "${topic}".

Return ONLY valid JSON, no other text.`

    let response = ''
    for await (const chunk of chatStream({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are a Wikipedia page relevance analyzer. Return only valid JSON objects with score (0-100), isRelevant (boolean), and reason (string).'
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
    
    const result = JSON.parse(cleanResponse) as { 
      score: number
      isRelevant: boolean
      reason: string
    }
    
    // Ensure score is in valid range
    const score = Math.max(0, Math.min(100, result.score || 0))
    
    // Determine relevance - be more lenient for Wikipedia pages
    const isRelevant = result.isRelevant ?? (score >= 40)
    
    return {
      score,
      isRelevant,
      reason: result.reason || `Scored ${score}/100`
    }
  } catch (error) {
    console.warn('[WikipediaProcessor] Wikipedia page relevance check failed, using default:', error)
    return {
      score: 50,
      isRelevant: false,
      reason: 'Relevance check failed - default score'
    }
  }
}

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
    
    const prompt = `Analyze this content for relevance to "${topic}":

Title: ${title}
URL: ${url}
Content: ${contentText.substring(0, 10000)}${contentText.length > 10000 ? '...' : ''}

IMPORTANT: First verify this is an actual article, not a metadata/catalog page.

Return JSON:
{
  "score": 0-100,
  "isRelevant": boolean,
  "isActualArticle": boolean,
  "contentQuality": "high" | "medium" | "low",
  "reason": string
}

Scoring criteria:
1. Is this an actual article? (not a library catalog, authority file, or metadata page)
2. How directly does it relate to "${topic}"?
3. Does it contain valuable, substantive information about "${topic}"?
4. What is the depth and quality of information?

Reject (score < 60) if:
- It's a library catalog entry
- It's an authority file or metadata page
- It's just metadata with no narrative content
- Content is too short or lacks substance
- It's not actually about "${topic}"

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
    
    const result = JSON.parse(cleanResponse) as { 
      score: number
      isRelevant: boolean
      isActualArticle?: boolean
      contentQuality?: string
      reason: string
    }
    
    // Ensure score is in valid range
    const score = Math.max(0, Math.min(100, result.score || 0))
    
    // Check if it's an actual article (from DeepSeek or our own check)
    // Trust AI's judgment more - if AI says it's an article and content is substantial, accept it
    const isActualArticleFromAI = result.isActualArticle ?? true
    const isActualArticleFromContent = isActualArticle(contentText, url)
    
    // More lenient: If AI says it's an article OR our check passes, accept it
    // Only reject if BOTH fail AND content is clearly metadata
    const isActuallyAnArticle = isActualArticleFromAI || isActualArticleFromContent
    
    // Only reject if AI explicitly says it's NOT an article AND our check also fails
    // AND content is clearly a catalog/metadata page
    if (!isActuallyAnArticle && result.isActualArticle === false) {
      const paragraphCount = (contentText.match(/\n\n/g) || []).length + 1
      const textBytes = Buffer.byteLength(contentText, 'utf8')
      const sentenceCount = (contentText.match(/[.!?]\s+[A-Z]/g) || []).length
      
      // Additional check: if content is very long (>5000 chars) and has many sentences, it's likely an article
      // even if paragraph count is low (some sites format as single paragraph)
      const isLikelyArticle = textBytes > 5000 && sentenceCount >= 10
      
      if (!isLikelyArticle) {
        console.warn(JSON.stringify({
          tag: 'content_validate_fail',
          url: url,
          reason: 'not_article',
          textBytes,
          paragraphCount,
          sentenceCount,
          isActualArticleFromAI,
          isActualArticleFromContent,
          isLikelyArticle
        }))
        return {
          score: 30, // Low score for non-articles
          isRelevant: false,
          reason: 'Not an actual article (metadata/catalog page)'
        }
      }
    }
    
    // Determine relevance (must be actual article AND relevant)
    const RELEVANCE_THRESHOLD = 60
    const isRelevant = result.isRelevant ?? (score >= RELEVANCE_THRESHOLD)
    
    return {
      score,
      isRelevant: isRelevant && isActuallyAnArticle, // Must be both relevant AND an article
      reason: result.reason || `Scored ${score}/100${!isActuallyAnArticle ? ' (not an article)' : ''}`
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
// Export for use in wikipediaMonitoring
export async function prioritizeCitations(
  citations: Array<{ url: string; title?: string; context?: string; text?: string }>,
  sourceUrl: string,
  topic?: string,
  aliases?: string[]
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

    const prompt = `You are analyzing Wikipedia citations to prioritize the most important sources for the topic: "${topic || 'unknown'}".

Topic: "${topic || 'unknown'}" (aliases: ${(aliases || []).join(', ')})
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
      const positionMatch = parseError.message.match(/position (\d+)/)
      const position = positionMatch ? parseInt(positionMatch[1]) : 0
      console.warn(`[WikipediaProcessor] JSON parse error at position ${position}, attempting recovery...`)
      
      // Try multiple recovery strategies
      // Strategy 1: Extract valid JSON objects from the response
      const jsonObjects = cleanResponse.match(/\{[^}]*"index"[^}]*\}/g)
      if (jsonObjects && jsonObjects.length > 0) {
        try {
          scores = jsonObjects.map(obj => JSON.parse(obj))
          console.log(`[WikipediaProcessor] Recovered ${scores.length} scores from partial JSON`)
        } catch (recoveryError) {
          // Strategy 2: Try to fix unterminated strings by truncating at error position
          if (position > 0 && position < cleanResponse.length) {
            try {
              const truncated = cleanResponse.substring(0, position).trim()
              // Try to find the last complete JSON object
              const lastBrace = truncated.lastIndexOf('}')
              if (lastBrace > 0) {
                const partialJson = truncated.substring(0, lastBrace + 1)
                // Try to extract array from partial JSON
                const arrayMatch = partialJson.match(/\[[\s\S]*\]/)
                if (arrayMatch) {
                  scores = JSON.parse(arrayMatch[0])
                  console.log(`[WikipediaProcessor] Recovered ${scores.length} scores by truncating at error position`)
                } else {
                  throw new Error('Could not extract array from truncated JSON')
                }
              } else {
                throw new Error('No complete JSON objects found')
              }
            } catch (truncateError) {
              console.warn('[WikipediaProcessor] Could not recover JSON, using default scores')
              throw parseError // Re-throw original error
            }
          } else {
            console.warn('[WikipediaProcessor] Could not recover JSON, using default scores')
            throw parseError // Re-throw if we can't recover
          }
        }
      } else {
        // Strategy 3: Try to extract any valid JSON array from the response
        const arrayMatches = cleanResponse.match(/\[[\s\S]{0,5000}\]/) // Limit to 5000 chars to avoid issues
        if (arrayMatches && arrayMatches.length > 0) {
          try {
            scores = JSON.parse(arrayMatches[0])
            console.log(`[WikipediaProcessor] Recovered ${scores.length} scores from array match`)
          } catch {
            console.warn('[WikipediaProcessor] Could not recover JSON, using default scores')
            throw parseError
          }
        } else {
          console.warn('[WikipediaProcessor] Could not recover JSON, using default scores')
          throw parseError
        }
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

  // Ensure title is never undefined - extract from URL if needed
  let pageTitle = nextPage.title
  if (!pageTitle || pageTitle === 'Unknown') {
    // Extract title from URL as fallback
    try {
      const urlObj = new URL(nextPage.url)
      pageTitle = decodeURIComponent(urlObj.pathname.replace('/wiki/', '').replace(/_/g, ' '))
    } catch {
      pageTitle = 'Unknown'
    }
  }

  console.log(`[WikipediaProcessor] Processing Wikipedia page: ${pageTitle}`)
  
  // Structured logging
  try {
    const { structuredLog } = await import('./structuredLogger')
    structuredLog('wikipedia_page_processing', {
      patchId,
      pageId: nextPage.id,
      pageTitle: pageTitle,
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
    const page = await WikipediaSource.getPage(pageTitle)
    
    if (!page) {
      await markWikipediaPageError(nextPage.id, 'Failed to fetch Wikipedia page')
      return { processed: true, pageTitle: pageTitle }
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
          const htmlUrl = `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(pageTitle)}`
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
        
        // Store citations with live tracking
        const { extractAndStoreCitations } = await import('./wikipediaCitation')
        
        // Create progress callback for live tracking
        const sessionId = options.patchHandle || 'default'
        const onProgress = async (event: { type: string; data: any }) => {
          try {
            await fetch('/api/test/extraction/live', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId, type: event.type, data: event.data })
            }).catch(() => {}) // Ignore errors - tracking is non-blocking
          } catch {}
        }
        
        const result = await extractAndStoreCitations(
          nextPage.id,
          nextPage.url,
          htmlForExtraction,
          prioritizeFn,
          onProgress
        )
        
        await markCitationsExtracted(nextPage.id, result.citationsFound)
        return { processed: true, pageTitle: pageTitle, citationsFound: result.citationsFound }
      } else {
        console.error(`[WikipediaProcessor] No citations and no HTML available for ${pageTitle}`)
        await markWikipediaPageError(nextPage.id, 'No citations found and no HTML available')
        return { processed: true, pageTitle: pageTitle }
      }
    }
    
    // Convert WikipediaSource citations to format expected by storage
    // Additional filtering to ensure no Wikipedia links slip through
    const convertedCitations = citationsFromPage
      .filter(c => {
        if (!c.url) return false
        
        // Skip relative Wikipedia links
        if (c.url.startsWith('./') || c.url.startsWith('/wiki/') || c.url.startsWith('../')) {
          return false
        }
        
        // Skip Wikipedia domains
        if (c.url.includes('wikipedia.org') || c.url.includes('wikimedia.org') || c.url.includes('wikidata.org')) {
          return false
        }
        
        // Only include http/https URLs
        if (!c.url.startsWith('http') && !c.url.startsWith('//')) {
          return false
        }
        
        // Double-check with URL parsing
        try {
          const urlObj = new URL(c.url, 'https://en.wikipedia.org')
          const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, '')
          if (hostname.includes('wikipedia.org') || hostname.includes('wikimedia.org') || hostname.includes('wikidata.org')) {
            return false
          }
        } catch {
          return false // Invalid URL
        }
        
        return true
      })
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

    console.log(`[WikipediaProcessor] Completed page "${pageTitle}": ${citationsStored} citations stored`)
    
    // Structured logging for completion
    try {
      const { structuredLog } = await import('./structuredLogger')
      structuredLog('wikipedia_page_complete', {
        patchId,
        pageId: nextPage.id,
        pageTitle: pageTitle,
        citationsFound,
        citationsStored,
        timestamp: new Date().toISOString()
      })
    } catch {
      // Non-fatal
    }
    
    return {
      processed: true,
      pageTitle: pageTitle,
      citationsFound
    }
  } catch (error) {
    console.error(`[WikipediaProcessor] Error processing page "${pageTitle}":`, error)
    await markWikipediaPageError(
      nextPage.id,
      error instanceof Error ? error.message : 'Unknown error'
    )
    return { processed: true, pageTitle: pageTitle }
  }
}

// Fix 7: Idempotency + Rate Limits
// Job queue with idempotency keys
const processingJobs = new Set<string>()

// Per-domain rate limiter (2 rps, burst 4)
const domainRateLimits = new Map<string, { count: number; resetAt: number }>()

function getJobKey(patchId: string, url: string): string {
  const canonicalUrl = canonicalizeUrlFast(url) || url
  return createHash('sha256')
    .update(`${patchId}|${canonicalUrl}`)
    .digest('hex')
    .substring(0, 16)
}

async function checkRateLimit(domain: string): Promise<boolean> {
  const limit = domainRateLimits.get(domain)
  const now = Date.now()
  
  if (!limit || now > limit.resetAt) {
    domainRateLimits.set(domain, { count: 1, resetAt: now + 1000 }) // 1 second window
    return true
  }
  
  if (limit.count >= 2) { // 2 requests per second
    return false
  }
  
  limit.count++
  return true
}

// Fix 8: Success Criteria (SLOs) Tracking
interface ProcessingMetrics {
  totalProcessed: number
  reachedExtraction: number
  passedMinLen500: number
  passedIsArticle: number
  reachedSave: number
  savedWithScore60Plus: number
  verifyFailures: Map<string, number>
}

const metrics: ProcessingMetrics = {
  totalProcessed: 0,
  reachedExtraction: 0,
  passedMinLen500: 0,
  passedIsArticle: 0,
  reachedSave: 0,
  savedWithScore60Plus: 0,
  verifyFailures: new Map()
}

function logMetrics() {
  if (metrics.totalProcessed === 0) return
  
  console.info(JSON.stringify({
    tag: 'processing_metrics',
    metrics: {
      totalProcessed: metrics.totalProcessed,
      extractionRate: ((metrics.reachedExtraction / metrics.totalProcessed) * 100).toFixed(1) + '%',
      minLen500Rate: ((metrics.passedMinLen500 / metrics.totalProcessed) * 100).toFixed(1) + '%',
      isArticleRate: ((metrics.passedIsArticle / metrics.totalProcessed) * 100).toFixed(1) + '%',
      saveRate: ((metrics.reachedSave / metrics.totalProcessed) * 100).toFixed(1) + '%',
      savedWithScore60Plus: metrics.savedWithScore60Plus
    }
  }))
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
  // Fix 8: Track metrics
  metrics.totalProcessed++
  
  const nextCitation = await getNextCitationToProcess(patchId)
  
  if (!nextCitation) {
    // Log metrics when no more citations
    logMetrics()
    console.log(`[WikipediaProcessor] No citations available to process for patch ${patchId}`)
    return { processed: false }
  }

  const citationUrl = nextCitation.citationUrl
  
  // Fix 7: Idempotency check - prevent duplicate processing
  const jobKey = getJobKey(patchId, citationUrl)
  if (processingJobs.has(jobKey)) {
    console.log(`[WikipediaProcessor] Citation already being processed (idempotency): ${citationUrl}`)
    return { processed: false }
  }
  processingJobs.add(jobKey)
  
  // Fix 7: Rate limit check
  const domain = getDomainFromUrl(citationUrl) || 'unknown'
  const canProcess = await checkRateLimit(domain)
  if (!canProcess) {
    console.log(`[WikipediaProcessor] Rate limit exceeded for domain ${domain}, skipping: ${citationUrl}`)
    processingJobs.delete(jobKey)
    return { processed: false }
  }
  
  // Clean up job key after processing
  let cleanupDone = false
  const cleanup = () => {
    if (!cleanupDone) {
      processingJobs.delete(jobKey)
      cleanupDone = true
    }
  }

  console.log(`[WikipediaProcessor] Processing citation: ${citationUrl}`)

  try {
    // Ensure cleanup is called on all exit paths
    // Get Wikipedia page info for URL conversion and tagging
    const monitoring = await prisma.wikipediaMonitoring.findUnique({
      where: { id: nextCitation.monitoringId },
      select: { wikipediaUrl: true, wikipediaTitle: true }
    })

    if (!monitoring) {
      cleanup()
      console.error(`[WikipediaProcessor] Monitoring record not found for citation ${nextCitation.id}`)
      return { processed: false }
    }

    // Convert relative Wikipedia URLs to absolute URLs
    let citationUrl = nextCitation.citationUrl
    
    // Convert relative Wikipedia links to absolute URLs
    if (citationUrl.startsWith('./')) {
      const pageName = citationUrl.replace('./', '').replace(/^\/wiki\//, '')
      citationUrl = `https://en.wikipedia.org/wiki/${pageName}`
      console.log(`[WikipediaProcessor] Converted relative Wikipedia link to absolute: ${citationUrl}`)
    } else if (citationUrl.startsWith('/wiki/')) {
      const pageName = citationUrl.replace('/wiki/', '')
      citationUrl = `https://en.wikipedia.org/wiki/${pageName}`
      console.log(`[WikipediaProcessor] Converted absolute path Wikipedia link to full URL: ${citationUrl}`)
    } else if (!citationUrl.startsWith('http') && !citationUrl.startsWith('//')) {
      // Skip non-URLs (anchors, etc.)
      console.log(`[WikipediaProcessor] Skipping non-URL citation: ${citationUrl}`)
      await markCitationVerificationFailed(
        nextCitation.id,
        'Not a valid URL (anchor or relative path)'
      )
      cleanup()
      await checkAndMarkPageCompleteIfAllCitationsProcessed(nextCitation.monitoringId)
      return { processed: true, citationUrl: citationUrl, monitoringId: nextCitation.monitoringId }
    }
    
    // Check if it's a Wikipedia URL - these should be added to monitoring if relevant
    // They should NOT be saved as external citations, but should be crawled via Wikipedia-to-Wikipedia crawling
    const isWikipediaUrl = citationUrl.includes('wikipedia.org/wiki/') || citationUrl.includes('wikipedia.org/w/')
    
    if (isWikipediaUrl) {
      console.log(`[WikipediaProcessor] Processing Wikipedia internal link: ${citationUrl} (will add to monitoring if relevant)`)
      
      // For Wikipedia URLs (including Portal pages, etc.), we need to:
      // 1. Check if it's relevant to the topic (even if it's a navigation/portal page)
      // 2. If relevant, add to Wikipedia monitoring (for Wikipedia-to-Wikipedia crawling)
      // 3. Mark as processed (not as external citation)
      // Note: We want to crawl ALL relevant Wikipedia pages, including portals, to extract their citations
      
      try {
        // Fetch the Wikipedia page to check relevance
        const response = await fetch(citationUrl, {
          signal: AbortSignal.timeout(30000) // 30 second timeout
        })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        
        const html = await response.text()
        
        // Extract title from URL
        const urlObj = new URL(citationUrl)
        const title = decodeURIComponent(urlObj.pathname.replace('/wiki/', '').replace(/_/g, ' '))
        
        // Extract basic text content for relevance check
        const textContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 2000) // Limit for relevance check
        
        // Relevance check for Wikipedia internal links
        // For Wikipedia pages (including Portal pages), we want to check if they're relevant to the topic
        // We don't care if they're "articles" - we want to crawl them to extract their citations
        // Get patch topic for relevance check
        const patch = await prisma.patch.findUnique({
          where: { id: patchId },
          select: { title: true }
        })
        const topic = patch?.title || 'unknown'
        
        // Use a more lenient relevance check for Wikipedia pages - we want Portal pages if they're topic-relevant
        const scoringResult = await checkWikipediaPageRelevance(
          title,
          citationUrl,
          textContent,
          topic
        )
        
        // Lower threshold for Wikipedia pages - we want to be inclusive to catch Portal pages
        const isRelevant = scoringResult.isRelevant && scoringResult.score >= 40
        
        if (isRelevant) {
          // Add to Wikipedia monitoring for Wikipedia-to-Wikipedia crawling
          const { addWikipediaPageToMonitoring } = await import('./wikipediaMonitoring')
          const result = await addWikipediaPageToMonitoring(
            patchId,
            citationUrl,
            title,
            `citation from ${monitoring?.wikipediaTitle || 'unknown page'}`
          )
          
          if (result.added) {
            console.log(`[WikipediaProcessor] ✅ Added relevant Wikipedia page to monitoring: ${title} (score: ${scoringResult.score})`)
            // Mark as scanned with a special status indicating it was added to monitoring
            await markCitationScanned(
              nextCitation.id,
              'denied', // Not saved as external citation
              undefined,
              undefined,
              '', // No content stored (it's in monitoring now)
              scoringResult.score // Store the relevance score
            )
            await markCitationVerificationFailed(
              nextCitation.id,
              'Wikipedia internal link - added to monitoring for crawling'
            )
          } else {
            console.log(`[WikipediaProcessor] Wikipedia page already in monitoring: ${title}`)
            await markCitationScanned(
              nextCitation.id,
              'denied',
              undefined,
              undefined,
              '',
              scoringResult.score
            )
            await markCitationVerificationFailed(
              nextCitation.id,
              'Wikipedia internal link - already in monitoring'
            )
          }
        } else {
          console.log(`[WikipediaProcessor] Wikipedia page not relevant: ${title} (score: ${scoringResult.score})`)
          await markCitationScanned(
            nextCitation.id,
            'denied',
            undefined,
            undefined,
            '',
            scoringResult.score
          )
          await markCitationVerificationFailed(
            nextCitation.id,
            `Wikipedia internal link - not relevant (score: ${scoringResult.score})`
          )
        }
        
        await checkAndMarkPageCompleteIfAllCitationsProcessed(nextCitation.monitoringId)
        return { processed: true, citationUrl: citationUrl, monitoringId: nextCitation.monitoringId }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to process Wikipedia URL'
        console.error(`[WikipediaProcessor] Error processing Wikipedia URL "${citationUrl}": ${errorMessage}`)
        await markCitationVerificationFailed(
          nextCitation.id,
          `Wikipedia internal link - processing failed: ${errorMessage}`
        )
      await markCitationScanned(
        nextCitation.id,
        'denied',
        undefined,
        undefined,
        '',
        undefined
      )
        cleanup()
        await checkAndMarkPageCompleteIfAllCitationsProcessed(nextCitation.monitoringId)
        return { processed: true, citationUrl: citationUrl, monitoringId: nextCitation.monitoringId }
      }
    }
    
    // Check for low-quality URLs (library catalogs, authority files, metadata pages)
    if (isLowQualityUrl(citationUrl)) {
      console.log(`[WikipediaProcessor] Skipping low-quality URL: ${citationUrl}`)
      // Mark as verification failed AND scanned with denied decision to prevent infinite loop
      await markCitationVerificationFailed(
        nextCitation.id,
        'Low-quality URL (library catalog, authority file, metadata page)'
      )
      // Also mark as scanned with denied decision so it doesn't get picked up again
      await markCitationScanned(
        nextCitation.id,
        'denied',
        undefined,
        undefined,
        '', // No content for low-quality URLs
        undefined // No AI score
      )
      cleanup()
      await checkAndMarkPageCompleteIfAllCitationsProcessed(nextCitation.monitoringId)
      return { processed: true, citationUrl: citationUrl, monitoringId: nextCitation.monitoringId }
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
        cleanup()
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

    // Fix 1 & 10: Kill HEAD-only gate with HEAD→GET fallback + per-domain force GET
    // Domains that reject HEAD but allow GET
    const FORCE_GET_DOMAINS = [
      'gov.il',
      'nba.com',
      'espn.com',
      'wikipedia.org' // Wikipedia internal links should use GET
    ]

    function shouldForceGet(url: string): boolean {
      try {
        const domain = new URL(url).hostname.replace(/^www\./, '')
        return FORCE_GET_DOMAINS.some(d => domain.includes(d))
      } catch {
        return false
      }
    }

    const reqHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }

    let response: Response | null = null
    let html = ''
    let ok = false
    let status = 0
    let verificationMethod = 'HEAD'

    // Try HEAD first (lightweight) unless domain forces GET
    if (!shouldForceGet(citationUrl)) {
      try {
        response = await fetch(citationUrl, {
          method: 'HEAD',
          headers: reqHeaders,
          redirect: 'follow',
          signal: AbortSignal.timeout(10000) // 10 second timeout
        })
        status = response.status
        ok = response.ok
        verificationMethod = 'HEAD'
      } catch (error) {
        // HEAD failed, will try GET
        ok = false
      }
    }

    // Fallback to GET if HEAD failed, returned 403/405/>=400, or domain forces GET
    if (!ok || status >= 400 || shouldForceGet(citationUrl)) {
      try {
        response = await fetch(citationUrl, {
          method: 'GET',
          headers: reqHeaders,
          redirect: 'follow',
          signal: AbortSignal.timeout(30000) // 30 second timeout for GET
        })
        status = response.status
        ok = response.ok
        verificationMethod = 'GET'
        
        if (ok && response.status >= 200 && response.status < 300) {
          html = await response.text() // Pass along to extractor
        }
      } catch (error) {
        // GET also failed
        ok = false
      }
    }

    // Only fail if both HEAD and GET failed
    if (!ok || (!html && status >= 400)) {
      const errorMessage = `HTTP ${status} - both ${verificationMethod === 'HEAD' ? 'HEAD and GET' : 'GET'} failed`
      console.log(`[WikipediaProcessor] Citation "${nextCitation.citationTitle}" verification failed: ${errorMessage}`)
      
      // Fix 4: Structured log for verification failure
      console.info(JSON.stringify({
        tag: 'verify_fail',
        url: citationUrl,
        status: status,
        method: verificationMethod,
        title: nextCitation.citationTitle
      }))
      
      await markCitationVerificationFailed(
        nextCitation.id,
        errorMessage
      )
      cleanup()
      await checkAndMarkPageCompleteIfAllCitationsProcessed(nextCitation.monitoringId)
      return { processed: true, citationUrl: citationUrl, monitoringId: nextCitation.monitoringId }
    }

    // Mark as scanning
    await markCitationScanning(nextCitation.id)

    // Fix 3: Always attempt extraction if we got HTML from GET fallback
    // If we already have HTML from verification, use it; otherwise fetch
    if (!html || html.length === 0) {
      // Fetch and process content
      try {
        response = await fetch(citationUrl, {
          headers: reqHeaders,
          signal: AbortSignal.timeout(30000) // 30 second timeout
        })
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        html = await response.text()
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Content fetch failed'
        console.error(`[WikipediaProcessor] Error fetching content for "${nextCitation.citationTitle}": ${errorMessage}`)
        await markCitationScanned(
          nextCitation.id,
          'denied',
          undefined,
          undefined,
          '',
          undefined
        )
        cleanup()
        await checkAndMarkPageCompleteIfAllCitationsProcessed(nextCitation.monitoringId)
        return { processed: true, citationUrl: citationUrl, monitoringId: nextCitation.monitoringId }
      }
    }
    
    // Robust content extraction with fallback chain
    // Try Readability first, then ContentExtractor, then simple fallback
    function normalizeText(t: string): string {
      return t
        .replace(/\u00A0/g, ' ')
        .replace(/\s+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    }

    let textContent = ''
    let extractionMethod = 'fallback-strip'
    let extractedTitle = nextCitation.citationTitle || 'Untitled'

    // Stage 1: Try Readability extraction (best for news/blogs)
    try {
      const { extractReadableContent } = await import('@/lib/readability')
      const readableResult = extractReadableContent(html, citationUrl)
      const readableText = readableResult.textContent || readableResult.content || ''
      if (readableText.length >= 600) {
        textContent = normalizeText(readableText)
        extractedTitle = readableResult.title || extractedTitle
        extractionMethod = 'readability'
      }
    } catch (error) {
      // Continue to next method
      console.warn(`[WikipediaProcessor] Readability extraction failed for ${citationUrl}:`, error)
    }

    // Stage 2: Try ContentExtractor (better boilerplate removal)
    if (textContent.length < 600) {
      try {
        const { ContentExtractor } = await import('./content-quality')
        const extracted = await ContentExtractor.extractFromHtml(html, citationUrl)
        const extractedText = extracted.text || ''
        if (extractedText.length >= 600) {
          textContent = normalizeText(extractedText)
          extractedTitle = extracted.title || extractedTitle
          extractionMethod = 'content-extractor'
        }
      } catch (error) {
        // Continue to fallback
        console.warn(`[WikipediaProcessor] ContentExtractor failed for ${citationUrl}:`, error)
      }
    }

    // Stage 3: Ultra last resort fallback (keeps us from total failure)
    if (textContent.length < 200) {
      extractionMethod = 'fallback-strip'
      textContent = normalizeText(
        html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
      )
    }

    // Calculate metrics for logging
    const paragraphCount = (textContent.match(/\n\n/g) || []).length + 1
    const textBytes = Buffer.byteLength(textContent, 'utf8')

    // Fix 8: Track extraction
    metrics.reachedExtraction++

    // Structured log for observability
    console.info(JSON.stringify({
      tag: 'content_extract',
      url: citationUrl,
      method: extractionMethod,
      textBytes,
      paragraphCount,
      title: extractedTitle
    }))

    // Phase 2: Content validation - ensure meaningful content
    const MIN_CONTENT_LENGTH = 500
    const meaningfulContent = textContent.trim()
    const hasSufficientContent = meaningfulContent.length >= MIN_CONTENT_LENGTH
    
    // Fix 8: Track min length 500
    if (hasSufficientContent) {
      metrics.passedMinLen500++
    }
    
    if (!hasSufficientContent) {
      console.warn(JSON.stringify({
        tag: 'content_validate_fail',
        url: citationUrl,
        reason: 'min_len_500',
        textBytes: meaningfulContent.length,
        method: extractionMethod
      }))
      console.log(`[WikipediaProcessor] Citation "${nextCitation.citationTitle}" rejected: insufficient content (${meaningfulContent.length} chars, need ${MIN_CONTENT_LENGTH})`)
      await markCitationScanned(
        nextCitation.id,
        'denied',
        undefined,
        undefined,
        meaningfulContent, // Store content even if rejected
        undefined // No score if content is insufficient
      )
      cleanup()
      await checkAndMarkPageCompleteIfAllCitationsProcessed(nextCitation.monitoringId)
      return { processed: true, citationUrl: citationUrl, monitoringId: nextCitation.monitoringId }
    }

    // Phase 2: Score content using DeepSeek with actual article content
    // Fix 9: Softening gates - Temporarily allow AI scoring down to 600 chars (keep isArticle at 1000/3 paras for save)
    // Only score if we have sufficient content (avoid sending garbage to AI)
    if (meaningfulContent.length < 600) { // Changed from 800 to 600 temporarily
      console.warn(JSON.stringify({
        tag: 'content_validate_fail',
        url: citationUrl,
        reason: 'min_len_600_for_ai', // Updated reason
        textBytes: meaningfulContent.length,
        method: extractionMethod
      }))
      await markCitationScanned(
        nextCitation.id,
        'denied',
        undefined,
        undefined,
        meaningfulContent,
        undefined
      )
      cleanup()
      await checkAndMarkPageCompleteIfAllCitationsProcessed(nextCitation.monitoringId)
      return { processed: true, citationUrl: citationUrl, monitoringId: nextCitation.monitoringId }
    }

    console.log(`[WikipediaProcessor] Scoring citation content for "${extractedTitle}"...`)
    const scoringResult = await scoreCitationContent(
      extractedTitle,
      citationUrl,
      meaningfulContent,
      options.patchName
    )
    
    const aiPriorityScore = scoringResult.score
    // Keep threshold at 60 to maintain quality
    const RELEVANCE_THRESHOLD = 60
    const isRelevantFromDeepSeek = scoringResult.isRelevant && aiPriorityScore >= RELEVANCE_THRESHOLD
    
    console.log(`[WikipediaProcessor] DeepSeek content scoring for "${nextCitation.citationTitle}":`, {
      score: aiPriorityScore,
      isRelevant: scoringResult.isRelevant,
      reason: scoringResult.reason,
      finalDecision: isRelevantFromDeepSeek ? 'RELEVANT' : 'NOT RELEVANT'
    })
    
    // Fix 4: Structured log for AI scoring
    console.info(JSON.stringify({
      tag: 'ai_score',
      url: citationUrl,
      score: aiPriorityScore,
      threshold: RELEVANCE_THRESHOLD,
      isRelevant: scoringResult.isRelevant,
      reason: scoringResult.reason,
      title: nextCitation.citationTitle
    }))

    // Final relevance decision: Trust DeepSeek as the primary and only scorer
    // DeepSeek is an AI that understands context, relevance, and nuance
    const finalIsRelevant = isRelevantFromDeepSeek
    
    console.log(`[WikipediaProcessor] Final relevance decision for "${nextCitation.citationTitle}":`, {
      deepSeekScore: aiPriorityScore,
      deepSeekRelevant: isRelevantFromDeepSeek,
      finalDecision: finalIsRelevant ? 'RELEVANT' : 'NOT RELEVANT'
    })
    
    let savedContentId: string | null = null
    let savedMemoryId: string | null = null

    // Save citations to DiscoveredContent
    // Only save if DeepSeek approves (score >= 60 and isRelevant)
    // isUseful flag will determine if it's published to the page
    if (finalIsRelevant && options.saveAsContent) {
      try {
        console.log(`[WikipediaProcessor] Attempting to save citation "${nextCitation.citationTitle}" to DiscoveredContent...`)
        savedContentId = await options.saveAsContent(
          citationUrl, // Use converted URL
          nextCitation.citationTitle || 'Untitled',
          meaningfulContent,
          {
            aiScore: aiPriorityScore,
            isRelevant: true
          }
        ) || null
        
        if (savedContentId) {
          const textBytes = Buffer.byteLength(meaningfulContent, 'utf8')
          
          // Fix 8: Track save metrics
          metrics.reachedSave++
          if (aiPriorityScore >= 60) {
            metrics.savedWithScore60Plus++
          }
          
          // Fix 8: Track isArticle (1000+ chars, 3+ paragraphs)
          const paragraphCount = (meaningfulContent.match(/\n\n/g) || []).length + 1
          if (textBytes >= 1000 && paragraphCount >= 3) {
            metrics.passedIsArticle++
          }
          
          console.log(`[WikipediaProcessor] ✅ Successfully saved citation to DiscoveredContent: ${savedContentId}`)
          
          // Trigger hero image generation in background (non-blocking)
          // Fire and forget - don't await
          // Use direct function call instead of HTTP to avoid URL construction issues
          const contentId = savedContentId // TypeScript: savedContentId is string | null, but we checked it's truthy
          let heroTriggered = false
          import('@/lib/enrichment/worker').then(({ enrichContentId }) => {
            enrichContentId(contentId).then(() => {
              heroTriggered = true
              console.info(JSON.stringify({
                tag: 'content_saved',
                url: citationUrl,
                textBytes,
                score: aiPriorityScore,
                hero: true
              }))
            }).catch(err => {
              console.warn(`[WikipediaProcessor] Failed to trigger hero generation for ${contentId}:`, err)
              // Non-fatal - hero can be generated later
              console.info(JSON.stringify({
                tag: 'content_saved',
                url: citationUrl,
                textBytes,
                score: aiPriorityScore,
                hero: false
              }))
            })
          }).catch(err => {
            console.warn(`[WikipediaProcessor] Failed to import enrichment worker for ${contentId}:`, err)
            // Non-fatal - hero can be generated later
            console.info(JSON.stringify({
              tag: 'content_saved',
              url: citationUrl,
              textBytes,
              score: aiPriorityScore,
              hero: false
            }))
          })
          
          // Log immediately if hero trigger is async
          if (!heroTriggered) {
            console.info(JSON.stringify({
              tag: 'content_saved',
              url: citationUrl,
              textBytes,
              score: aiPriorityScore,
              hero: 'pending'
            }))
          }
        } else {
          console.warn(`[WikipediaProcessor] ⚠️ saveAsContent returned null for citation "${nextCitation.citationTitle}" - citation was not saved`)
        }
      } catch (error) {
        console.error(`[WikipediaProcessor] ❌ Error saving citation "${nextCitation.citationTitle}" to DiscoveredContent:`, error)
        // Don't throw - continue processing other citations
      }
    } else {
      if (!finalIsRelevant) {
        console.log(`[WikipediaProcessor] Citation "${nextCitation.citationTitle}" rejected: ${scoringResult.reason || 'Failed DeepSeek relevance check'} (score: ${aiPriorityScore}, isRelevant: ${scoringResult.isRelevant})`)
      }
      if (!options.saveAsContent) {
        console.warn(`[WikipediaProcessor] ⚠️ saveAsContent function not provided - citation "${nextCitation.citationTitle}" cannot be saved`)
      }
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

    // If this citation is a Wikipedia URL and it's relevant, add it to monitoring
    // This allows us to recursively extract citations from relevant Wikipedia pages
    if (finalIsRelevant) {
      try {
        const urlObj = new URL(citationUrl)
        const hostname = urlObj.hostname.toLowerCase()
        if (hostname.includes('wikipedia.org') && urlObj.pathname.startsWith('/wiki/')) {
          // Extract title from URL
          const title = decodeURIComponent(urlObj.pathname.replace('/wiki/', '').replace(/_/g, ' '))
          
          const { addWikipediaPageToMonitoring } = await import('./wikipediaMonitoring')
          const result = await addWikipediaPageToMonitoring(
            patchId,
            citationUrl,
            title,
            `citation from ${monitoring?.wikipediaTitle || 'unknown page'}`
          )
          
          if (result.added) {
            console.log(`[WikipediaProcessor] ✅ Added relevant Wikipedia page to monitoring: ${title}`)
          }
        }
      } catch (error) {
        // Non-fatal - just log and continue
        console.warn(`[WikipediaProcessor] Failed to check/add Wikipedia page to monitoring:`, error)
      }
    }

    // Check if page can be marked complete after processing this citation
    await checkAndMarkPageCompleteIfAllCitationsProcessed(nextCitation.monitoringId)

    // Cleanup idempotency key
    cleanup()

      return {
        processed: true,
        citationUrl: citationUrl,
        saved: finalIsRelevant,
        monitoringId: nextCitation.monitoringId
      }
  } catch (error) {
    cleanup()
    console.error(`[WikipediaProcessor] Error processing citation:`, error)
    if (nextCitation) {
      await markCitationVerificationFailed(
        nextCitation.id,
        error instanceof Error ? error.message : 'Unknown error'
      )
      // Check if page can be marked complete even on error
      await checkAndMarkPageCompleteIfAllCitationsProcessed(nextCitation.monitoringId)
      return { processed: true, citationUrl: nextCitation.citationUrl, monitoringId: nextCitation.monitoringId }
    }
    return { processed: false }
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

/**
 * Reprocess a single citation by ID
 * Used for manual verification/reprocessing
 * This function directly processes the specified citation instead of getting the next one
 */
export async function reprocessCitation(citationId: string): Promise<{ processed: boolean; citationUrl?: string; monitoringId?: string }> {
  const citation = await prisma.wikipediaCitation.findUnique({
    where: { id: citationId },
    include: {
      monitoring: {
        select: {
          patchId: true,
          wikipediaUrl: true,
          wikipediaTitle: true
        }
      }
    }
  })

  if (!citation) {
    console.error(`[WikipediaProcessor] Citation not found: ${citationId}`)
    return { processed: false }
  }

  const patchId = citation.monitoring.patchId

  // Reset the citation to allow reprocessing
  // Clear previous decisions but keep the citation data
  await prisma.wikipediaCitation.update({
    where: { id: citationId },
    data: {
      scanStatus: 'not_scanned',
      relevanceDecision: null,
      contentText: null,
      savedContentId: null,
      savedMemoryId: null,
      errorMessage: null,
      lastScannedAt: null,
      verificationStatus: 'pending' // Reset verification status
    }
  })

  // Get patch info for saveAsContent and saveAsMemory
  const patch = await prisma.patch.findUnique({
    where: { id: patchId },
    select: { handle: true, title: true }
  })

  if (!patch) {
    console.error(`[WikipediaProcessor] Patch not found: ${patchId}`)
    return { processed: false }
  }

  // Create saveAsContent function
  const saveAsContent = async (
    url: string,
    title: string,
    content: string,
    relevanceData?: { aiScore?: number; relevanceScore?: number; isRelevant?: boolean }
  ): Promise<string | null> => {
    const canonicalUrl = canonicalizeUrlFast(url) || url
    const domain = getDomainFromUrl(canonicalUrl) || 'unknown'

    try {
      const saved = await prisma.discoveredContent.create({
        data: {
          patchId,
          title,
          summary: content.substring(0, 240),
          whyItMatters: '',
          sourceUrl: url,
          canonicalUrl,
          domain,
          category: 'article',
          relevanceScore: relevanceData?.relevanceScore ?? (relevanceData?.aiScore ? relevanceData.aiScore / 100 : 0.5),
          qualityScore: 0,
          facts: [],
          provenance: [url],
          content: content
        }
      })

      // Trigger hero image generation
      try {
        const { enrichContentId } = await import('@/lib/enrichment/worker')
        await enrichContentId(saved.id)
      } catch (enrichError) {
        console.warn(`[WikipediaProcessor] Failed to enrich content ${saved.id}:`, enrichError)
      }

      return saved.id
    } catch (error) {
      console.error(`[WikipediaProcessor] Failed to save content:`, error)
      return null
    }
  }

  // Create saveAsMemory function
  const saveAsMemory = async (
    url: string,
    title: string,
    content: string,
    patchHandle: string,
    wikipediaPageTitle?: string
  ): Promise<string | null> => {
    try {
      // Get agents associated with this patch
      const agents = await prisma.agent.findMany({
        where: {
          associatedPatches: {
            has: patchHandle
          }
        },
        select: { id: true },
        take: 1
      })

      if (agents.length === 0) {
        // No agent associated, skip memory creation
        console.log(`[WikipediaProcessor] No agent found for patch ${patchHandle}, skipping memory creation`)
        return null
      }

      const agentId = agents[0].id
      
      // Limit content length
      const maxContentLength = 5000
      const contentToStore = content.length > maxContentLength
        ? content.substring(0, maxContentLength) + '...'
        : content

      // Create tags
      const tags = [
        patchHandle,
        'wikipedia',
        'citation'
      ]
      if (wikipediaPageTitle) {
        tags.push(`page:${wikipediaPageTitle}`)
      }

      const saved = await prisma.agentMemory.create({
        data: {
          agent: { connect: { id: agentId } },
          sourceTitle: title,
          sourceUrl: url,
          content: contentToStore,
          sourceType: 'wikipedia_citation',
          tags: tags,
          confidence: 1.0,
          fedBy: 'system',
          embedding: []
        }
      })
      return saved.id
    } catch (error) {
      console.error(`[WikipediaProcessor] Failed to save memory:`, error)
      return null
    }
  }

  // Process this specific citation by temporarily making it the "next" one
  // We'll create a modified version that processes the specific citation
  // by directly calling the processing logic with the citation data
  
  // For now, we'll use a workaround: temporarily set a high priority score
  // so it gets picked up by getNextCitationToProcess, then call processCitation
  // But this is not ideal. Let's just process it directly.
  
  // Actually, the simplest approach: call processCitation which will process
  // the next available citation. Since we reset this one, it should be eligible.
  // But to ensure it's processed, we can set a very high priority score temporarily.
  
  await prisma.wikipediaCitation.update({
    where: { id: citationId },
    data: {
      aiPriorityScore: 999 // Very high priority to ensure it's picked up
    }
  })

  // Call processNextCitation - it should pick up our reset citation
  const result = await processNextCitation(patchId, {
    patchName: patch.title,
    patchHandle: patch.handle,
    saveAsContent,
    saveAsMemory
  })

  return result
}

