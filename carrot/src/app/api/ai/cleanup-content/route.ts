import { NextRequest, NextResponse } from 'next/server'
import { chatStream, type ChatMessage } from '@/lib/llm/providers/DeepSeekClient'

/**
 * Clean up and improve grammar/language for content summary and key facts
 * POST /api/ai/cleanup-content
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { summary, keyFacts, title } = body

    if (!summary && (!keyFacts || keyFacts.length === 0)) {
      return NextResponse.json(
        { error: 'Summary or keyFacts required' },
        { status: 400 }
      )
    }

    console.log(`[CleanupContent] Cleaning up content for: ${title?.substring(0, 50) || 'Untitled'}`)

    // Build prompt for cleanup
    const prompt = `You are an expert editor. Clean up and improve the following content:

${summary ? `EXECUTIVE SUMMARY (current):
${summary}

Requirements:
- Fix all grammar, spelling, and punctuation errors
- Ensure proper sentence structure and flow
- Make it clear, concise, and professional
- Remove fragments and incomplete thoughts
- Ensure it's a complete, well-written paragraph (2-4 sentences, 120-240 words)
- Maintain factual accuracy

` : ''}${keyFacts && keyFacts.length > 0 ? `KEY FACTS (current):
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

` : ''}Return ONLY valid JSON in this exact format:
{
  ${summary ? `"summary": "Cleaned and improved executive summary (2-4 sentences, 120-240 words)",
  ` : ''}"keyFacts": ${keyFacts && keyFacts.length > 0 ? `["Fact 1 (complete sentence)", "Fact 2 (complete sentence)", ...]` : '[]'},
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

    // Call DeepSeek API
    let fullResponse = ''
    const stream = chatStream({
      model: 'deepseek-chat',
      messages,
      temperature: 0.3, // Low temperature for consistent, factual output
      max_tokens: 1500
    })

    for await (const chunk of stream) {
      if (chunk.type === 'token' && chunk.token) {
        fullResponse += chunk.token
      } else if (chunk.type === 'error') {
        throw new Error(chunk.error || 'DeepSeek API error')
      }
    }

    console.log(`[CleanupContent] Raw response:`, fullResponse.substring(0, 200))

    // Parse JSON response
    let jsonData: any
    try {
      // Try to extract JSON from response (in case there's extra text)
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonData = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in response')
      }
    } catch (parseError) {
      console.error(`[CleanupContent] JSON parse error:`, parseError)
      console.error(`[CleanupContent] Full response:`, fullResponse)
      
      // Fallback: return original content with minimal cleanup
      return NextResponse.json({
        summary: summary || '',
        keyFacts: keyFacts || [],
        improvements: ['Failed to parse AI response, using original content']
      })
    }

    // Validate response structure
    const cleanedSummary = jsonData.summary || summary || ''
    const cleanedKeyFacts = Array.isArray(jsonData.keyFacts) ? jsonData.keyFacts : (keyFacts || [])
    const improvements = Array.isArray(jsonData.improvements) ? jsonData.improvements : []

    console.log(`[CleanupContent] ✅ Cleanup successful`)
    console.log(`[CleanupContent] Summary length: ${cleanedSummary.length}`)
    console.log(`[CleanupContent] Key facts count: ${cleanedKeyFacts.length}`)
    console.log(`[CleanupContent] Improvements:`, improvements)

    return NextResponse.json({
      summary: cleanedSummary,
      keyFacts: cleanedKeyFacts,
      improvements
    })

  } catch (error: any) {
    console.error('[CleanupContent] Error:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup content', details: error.message },
      { status: 500 }
    )
  }
}

