/**
 * LLM extractor service
 * Phase 4: LLM Extractor
 * Extracts structured information from crawled pages using DeepSeek (or equivalent)
 */

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { 
  enqueueExtraction, 
  dequeueExtraction, 
  getExtractionQueueDepth,
  moveToExtractionDLQ,
  requeueExtractionWithBackoff
} from './queues'
import { crawlerConfig } from './config'
import { EXTRACTOR_V2 } from '../discovery/flags'
import { slog } from '../log'
import { z } from 'zod'

// JSON schema for extraction output
const ExtractionSchema = z.object({
  topic: z.string(),
  source_url: z.string(),
  title: z.string(),
  top_10_facts: z.array(z.string()).length(10),
  quoted_passages: z.array(z.object({
    quote: z.string(),
    context_note: z.string(),
  })).max(2),
  paraphrase_summary: z.string(),
  controversial_flags: z.array(z.string()).optional(),
  metadata: z.object({
    domain: z.string(),
    crawl_timestamp: z.string(),
    char_count: z.number(),
  }),
})

type ExtractionResult = z.infer<typeof ExtractionSchema>

// System prompt
const SYSTEM_PROMPT = `You are a precise research summarizer. Use only the provided page text and URL. Do not invent facts. Return valid JSON per the provided schema. Include up to TWO full quoted paragraphs VERBATIM with quotation marks and line breaks preserved. All other sections must be paraphrased. If content is thin or paywalled, return a structured error with "insufficient_content".`

// User prompt template
function createUserPrompt(topic: string, url: string, text: string): string {
  return `Topic: ${topic}

Source URL: ${url}

Page Text:
${text.slice(0, 8000)}${text.length > 8000 ? '\n\n[Content truncated for length]' : ''}

Instructions:
- Give an engaging title.
- List the 10 most interesting facts (mix historical + controversial where applicable).
- Include up to 2 full, verbatim quoted paragraphs from the source (not summary text).
- Provide a concise paraphrase summary (no quotes).
- Return the exact JSON schema:
{
  "topic": "<string>",
  "source_url": "<string>",
  "title": "<string>",
  "top_10_facts": ["...", "..."],
  "quoted_passages": [{"quote": "<<= 2 paragraphs, exact>", "context_note": "<short>"}],
  "paraphrase_summary": "<no quotes>",
  "controversial_flags": ["..."],
  "metadata": {"domain": "", "crawl_timestamp": "", "char_count": 12345}
}`
}

/**
 * Call LLM API (DeepSeek or equivalent)
 */
async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  model: string = crawlerConfig.llmModel
): Promise<string> {
  const apiKey = crawlerConfig.llmApiKey
  if (!apiKey) {
    throw new Error('LLM_API_KEY not configured')
  }
  
  // DeepSeek API endpoint
  const apiUrl = 'https://api.deepseek.com/v1/chat/completions'
  
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  })
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error')
    throw new Error(`LLM API error: ${response.status} ${errorText}`)
  }
  
  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('LLM API returned no content')
  }
  
  return content
}

/**
 * Extract structured information from page text
 */
export async function extractFromPage(
  pageId: string,
  topic: string,
  sourceUrl: string,
  text: string,
  domain: string,
  attemptCount: number = 0
): Promise<ExtractionResult | null> {
  const startTime = Date.now()
  
  try {
    // Truncate text if too long (LLM token limits)
    let processedText = text
    if (text.length > 8000) {
      // Try to truncate at sentence boundary
      const truncated = text.slice(0, 8000)
      const lastPeriod = truncated.lastIndexOf('.')
      if (lastPeriod > 7000) {
        processedText = truncated.slice(0, lastPeriod + 1)
      } else {
        processedText = truncated
      }
    }
    
    const userPrompt = createUserPrompt(topic, sourceUrl, processedText)
    const rawResponse = await callLLM(SYSTEM_PROMPT, userPrompt)
    
    // Parse JSON response
    let jsonResponse: any
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = rawResponse.match(/```json\s*([\s\S]*?)\s*```/) || rawResponse.match(/```\s*([\s\S]*?)\s*```/)
      const jsonText = jsonMatch ? jsonMatch[1] : rawResponse
      jsonResponse = JSON.parse(jsonText)
    } catch (parseError) {
      throw new Error(`Failed to parse LLM JSON response: ${parseError}`)
    }
    
    // Validate against schema
    const validated = ExtractionSchema.parse(jsonResponse)
    
    // Add metadata
    validated.metadata = {
      domain,
      crawl_timestamp: new Date().toISOString(),
      char_count: text.length,
    }
    
    const duration = Date.now() - startTime
    
    // Metrics
    const { inc, histogram } = await import('../metrics')
    inc('extraction_ok', 1, { domain })
    histogram('parse_duration_ms', duration, { domain })
    
    slog('info', {
      service: 'crawler',
      step: 'extract',
      page_id: pageId,
      url: sourceUrl.slice(0, 200),
      domain,
      action: 'extract',
      status: 'ok',
      duration_ms: duration,
    })
    
    return validated
  } catch (error: any) {
    const duration = Date.now() - startTime
    const errorMessage = error.message || String(error)
    
    const { inc } = await import('../metrics')
    inc('extraction_fail', 1, { domain, reason: errorMessage.slice(0, 50) })
    
    slog('error', {
      service: 'crawler',
      step: 'extract',
      page_id: pageId,
      url: sourceUrl.slice(0, 200),
      domain,
      action: 'extract',
      status: 'error',
      duration_ms: duration,
      error: errorMessage.slice(0, 200),
      attempt_count: attemptCount,
    })
    
    // Retry with smaller chunk if payload too large
    if (errorMessage.includes('token') || errorMessage.includes('length') || errorMessage.includes('too large')) {
      if (attemptCount < crawlerConfig.maxRetries && text.length > 4000) {
        // Retry with half the text
        const halfText = text.slice(0, Math.floor(text.length / 2))
        return extractFromPage(pageId, topic, sourceUrl, halfText, domain, attemptCount + 1)
      }
    }
    
    // Retry with backoff for transient errors
    if (attemptCount < crawlerConfig.maxRetries) {
      const retryableErrors = ['timeout', 'network', 'ECONNREFUSED', 'ENOTFOUND']
      if (retryableErrors.some(e => errorMessage.includes(e))) {
        await requeueExtractionWithBackoff(pageId, topic, sourceUrl, attemptCount)
        return null
      }
    }
    
    // Move to DLQ if max retries reached
    if (attemptCount >= crawlerConfig.maxRetries) {
      await moveToExtractionDLQ(pageId, 'max_retries_exceeded', {
        error: errorMessage,
        attemptCount,
      })
    }
    
    throw error
  }
}

/**
 * Process extraction queue worker
 */
export async function processExtractionQueue(): Promise<void> {
  if (!EXTRACTOR_V2) {
    return // Feature flag disabled
  }
  
  const queued = await dequeueExtraction()
  if (!queued) {
    return // Queue empty
  }
  
  const { pageId, topic, sourceUrl, attemptCount = 0 } = queued
  
  try {
    // Load page from database
    const page = await prisma.crawlerPage.findUnique({
      where: { id: pageId },
      select: {
        id: true,
        url: true,
        domain: true,
        extractedText: true,
        status: true,
      },
    })
    
    if (!page) {
      slog('warn', {
        service: 'crawler',
        step: 'extract',
        page_id: pageId,
        action: 'skip',
        status: 'page_not_found',
      })
      return
    }
    
    if (!page.extractedText || page.extractedText.length < 500) {
      slog('warn', {
        service: 'crawler',
        step: 'extract',
        page_id: pageId,
        url: page.url.slice(0, 200),
        action: 'skip',
        status: 'insufficient_content',
      })
      return
    }
    
    // Extract using LLM
    const extraction = await extractFromPage(
      pageId,
      topic,
      sourceUrl || page.url,
      page.extractedText,
      page.domain,
      attemptCount
    )
    
    if (!extraction) {
      return // Will be retried or moved to DLQ
    }
    
    // Persist to database
    await prisma.crawlerExtraction.create({
      data: {
        pageId: page.id,
        topic: extraction.topic,
        sourceUrl: extraction.source_url,
        title: extraction.title,
        top10Facts: extraction.top_10_facts as Prisma.JsonArray,
        quotedPassages: extraction.quoted_passages as Prisma.JsonArray,
        paraphraseSummary: extraction.paraphrase_summary,
        controversialFlags: extraction.controversial_flags 
          ? (extraction.controversial_flags as Prisma.JsonArray)
          : Prisma.JsonNull,
        metadata: extraction.metadata as Prisma.JsonObject,
      },
    })
    
    // Update page status
    await prisma.crawlerPage.update({
      where: { id: page.id },
      data: { status: 'extracted' },
    })
    
    slog('info', {
      service: 'crawler',
      step: 'extract',
      page_id: pageId,
      url: page.url.slice(0, 200),
      action: 'persist',
      status: 'ok',
    })
    
    // Emit NDJSON line for downstream use (optional)
    const ndjson = JSON.stringify({
      page_id: pageId,
      topic: extraction.topic,
      source_url: extraction.source_url,
      title: extraction.title,
      extracted_at: new Date().toISOString(),
    })
    // Could write to file or emit to stream
    // process.stdout.write(ndjson + '\n')
    
  } catch (error: any) {
    slog('error', {
      service: 'crawler',
      step: 'extract',
      page_id: pageId,
      action: 'process',
      status: 'error',
      error: error.message?.slice(0, 200),
    })
    
    // Move to DLQ if not already retrying
    if (attemptCount >= crawlerConfig.maxRetries) {
      await moveToExtractionDLQ(pageId, 'processing_error', {
        error: error.message,
      })
    }
  }
}

