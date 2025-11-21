import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateEnrichment, fillEnrichmentDefaults } from '@/lib/discovery/enrichmentContract'

// Validation schema
const SummarizeContentSchema = z.object({
  text: z.string().min(100),
  title: z.string(),
  url: z.string().url(),
  groupContext: z.string().optional(), // e.g., "Chicago Bulls"
  temperature: z.number().min(0).max(1).default(0.2)
})

/**
 * Summarize content using LLM
 * POST /api/ai/summarize-content
 */
export async function POST(request: NextRequest) {
  try {
    // VALIDATE: Parse and validate request body
    const body = await request.json()
    const validation = SummarizeContentSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: "Invalid request body", 
          details: validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        },
        { status: 400 }
      )
    }
    
    const { text, title, url, groupContext, temperature } = validation.data

    console.log(`[summarize-content] Processing content for: ${title.substring(0, 50)}`)

    // Call DeepSeek API for comprehensive content quality analysis
    const deepSeekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `You are an expert content quality analyst. Your job is to:

1. CLEAN the content: Remove boilerplate, navigation text, ads, cookie banners, "Subscribe..." prompts
2. FIX grammar and spelling errors
3. SCORE content quality (0-100): Reject trash, clickbait, or low-value content
4. VERIFY relevance to the topic: "${groupContext || 'general'}"
5. CREATE professional summary and key facts

Return VALID JSON only:
{
  "qualityScore": 85,
  "relevanceScore": 92,
  "isUseful": true,
  "summary": "120-180 word executive summary with perfect grammar",
  "keyFacts": ["Fact 1 (clean, complete sentence)", "Fact 2 (no truncation)", ...],
  "notableQuotes": ["Actual quote from article - Source, Year"],
  "issues": ["Grammar fixed: ...", "Removed boilerplate: ..."]
}

REJECT if:
- Content is < 100 words after cleaning
- Quality score < 60
- Relevance score < 50 (for ${groupContext || 'general'} content)
- Article is just ads/navigation/clickbait`
          },
          {
            role: 'user',
            content: `Analyze and clean this article about "${groupContext || 'general'}":

Title: ${title}
URL: ${url}

Raw Content:
${text}

Return cleaned, scored, relevant content in JSON format.`
          }
        ],
        temperature,
        max_tokens: 1500
      })
    })

    if (!deepSeekResponse.ok) {
      throw new Error(`DeepSeek API failed: ${deepSeekResponse.status}`)
    }

    const deepSeekResult = await deepSeekResponse.json()
    const content = deepSeekResult.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No content returned from DeepSeek')
    }

    // Parse JSON response
    let result
    try {
      result = JSON.parse(content)
    } catch (parseError) {
      // If JSON parsing fails, try to extract content manually
      result = extractContentFromText(content)
    }

    // Validate and enforce enrichment contract
    const enrichmentValidation = validateEnrichment(result)
    
    if (!enrichmentValidation.valid) {
      console.warn('[summarize-content] Contract validation failed, filling defaults:', enrichmentValidation.errors)
      // Fill safe defaults
      const enriched = fillEnrichmentDefaults(result, title, result.summary || '')
      return NextResponse.json(enriched)
    }

    // Clean and validate content
    const enriched = enrichmentValidation.data!
    enriched.summary = cleanText(enriched.summary)
    enriched.keyFacts = enriched.keyFacts.map(fact => cleanText(fact))
    enriched.notableQuotes = enriched.notableQuotes.map(quote => {
      if (typeof quote === 'string') {
        return { quote: cleanText(quote) }
      }
      return {
        quote: cleanText(quote.quote || ''),
        attribution: quote.attribution ? cleanText(quote.attribution) : undefined,
        sourceUrl: quote.sourceUrl
      }
    })

    // Hard cap quotes at 2
    if (enriched.notableQuotes.length > 2) {
      enriched.notableQuotes = enriched.notableQuotes.slice(0, 2)
    }

    console.log(`[summarize-content] ✅ Successfully processed content for: ${title.substring(0, 50)}`)

    return NextResponse.json(enriched)

  } catch (error: any) {
    console.error('[summarize-content] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to summarize content' },
      { status: 500 }
    )
  }
}

/**
 * Extract content from non-JSON response
 */
function extractContentFromText(text: string): any {
  const summaryMatch = text.match(/Summary[:\s]*([\s\S]+?)(?=Key Facts|$)/i)
  const keyFactsMatch = text.match(/Key Facts[:\s]*([\s\S]+?)(?=Notable Quotes|$)/i)
  const quotesMatch = text.match(/Notable Quotes[:\s]*([\s\S]+?)$/i)

  return {
    summary: summaryMatch?.[1]?.trim() || '',
    keyFacts: keyFactsMatch?.[1]?.split('\n').filter(f => f.trim()).map(f => f.replace(/^[-•]\s*/, '').trim()) || [],
    notableQuotes: quotesMatch?.[1]?.split('\n').filter(q => q.trim()).map(q => q.replace(/^[-•]\s*/, '').trim()) || []
  }
}

/**
 * Clean text content
 */
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^[-•]\s*/, '')
    .trim()
}
