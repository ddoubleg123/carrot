import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema
const SummarizeContentSchema = z.object({
  text: z.string().min(100),
  title: z.string(),
  url: z.string().url(),
  temperature: z.number().min(0).max(1).default(0.2)
})

/**
 * Summarize content using LLM
 * POST /api/ai/summarize-content
 */
export async function POST(request: NextRequest) {
  try {
    // AUTH: Check for internal key
    const internalKey = request.headers.get('x-internal-key')
    if (!internalKey || internalKey !== process.env.INTERNAL_API_KEY) {
      return NextResponse.json(
        { error: 'Forbidden: This endpoint is for internal use only' },
        { status: 403 }
      )
    }
    
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
    
    const { text, title, url, temperature } = validation.data

    console.log(`[summarize-content] Processing content for: ${title.substring(0, 50)}`)

    // Call DeepSeek API for summarization
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
            content: `You are a content summarization expert. Create high-quality summaries and key facts from articles. 
            
            Requirements:
            - Executive Summary: 120-180 words, informative, no filler
            - Key Facts: 5-8 bullets, each ≤120 chars, stand-alone facts
            - Notable Quotes: 0-3 literal quotes with citation (source name and year)
            - No boilerplate, no truncated content, no "..." endings
            - Focus on factual, informative content
            
            Return JSON format:
            {
              "summary": "Executive summary text...",
              "keyFacts": ["Fact 1", "Fact 2", ...],
              "notableQuotes": ["Quote 1 - Source, Year", ...]
            }`
          },
          {
            role: 'user',
            content: `Please summarize this article:

Title: ${title}
URL: ${url}

Content:
${text}

Provide a clean, informative summary with key facts and notable quotes.`
          }
        ],
        temperature,
        max_tokens: 1000
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
      result = this.extractContentFromText(content)
    }

    // Validate result structure
    if (!result.summary || !result.keyFacts || !Array.isArray(result.keyFacts)) {
      throw new Error('Invalid response structure from LLM')
    }

    // Clean and validate content
    result.summary = this.cleanText(result.summary)
    result.keyFacts = result.keyFacts.map((fact: string) => this.cleanText(fact))
    result.notableQuotes = result.notableQuotes?.map((quote: string) => this.cleanText(quote)) || []

    console.log(`[summarize-content] ✅ Successfully processed content for: ${title.substring(0, 50)}`)

    return NextResponse.json(result)

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
  const summaryMatch = text.match(/Summary[:\s]*(.+?)(?=Key Facts|$)/is)
  const keyFactsMatch = text.match(/Key Facts[:\s]*(.+?)(?=Notable Quotes|$)/is)
  const quotesMatch = text.match(/Notable Quotes[:\s]*(.+?)$/is)

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
