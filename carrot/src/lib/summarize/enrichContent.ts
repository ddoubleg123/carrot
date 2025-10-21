import { chatStream, type ChatMessage } from '@/lib/llm/providers/DeepSeekClient'
import { SummaryContract, validateSummary, generateSummaryPrompt } from './contract'

/**
 * Enrich content using DeepSeek to generate high-quality summaries
 */
export async function enrichContentWithDeepSeek(
  articleText: string,
  title: string,
  url: string,
  groupTags: string[] = []
): Promise<{ success: boolean; data?: SummaryContract; errors?: string[] }> {
  const maxRetries = 1
  let attempt = 0

  while (attempt <= maxRetries) {
    try {
      console.log(`[EnrichContent] Attempt ${attempt + 1} for ${url}`)
      
      const prompt = generateSummaryPrompt(articleText, title, url, groupTags)
      
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: 'You are a research assistant that creates concise, factual content summaries. Always return valid JSON only, no other text.'
        },
        {
          role: 'user',
          content: prompt
        }
      ]

      // Collect the streaming response
      let fullResponse = ''
      const stream = chatStream({
        model: 'deepseek-chat',
        messages,
        temperature: 0.2, // Low temperature for factual output
        max_tokens: 2048
      })

      for await (const chunk of stream) {
        if (chunk.type === 'token' && chunk.token) {
          fullResponse += chunk.token
        } else if (chunk.type === 'error') {
          throw new Error(chunk.error || 'DeepSeek API error')
        }
      }

      console.log(`[EnrichContent] Raw response:`, fullResponse.substring(0, 200))

      // Parse JSON response
      let jsonData: unknown
      try {
        // Try to extract JSON from response (in case there's extra text)
        const jsonMatch = fullResponse.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          jsonData = JSON.parse(jsonMatch[0])
        } else {
          jsonData = JSON.parse(fullResponse)
        }
      } catch (parseError) {
        console.error('[EnrichContent] JSON parse error:', parseError)
        console.error('[EnrichContent] Response was:', fullResponse)
        
        if (attempt === maxRetries) {
          return { success: false, errors: ['Failed to parse AI response as JSON'] }
        }
        
        attempt++
        continue
      }

      // Validate the response
      const validation = validateSummary(jsonData)
      
      if (validation.valid && validation.data) {
        console.log(`[EnrichContent] ✅ Successfully enriched content`)
        return { success: true, data: validation.data }
      }

      console.log(`[EnrichContent] ⚠️ Validation failed:`, validation.errors)
      
      if (attempt === maxRetries) {
        return { success: false, errors: validation.errors }
      }

      // Retry with stricter prompt
      attempt++
      
    } catch (error: any) {
      console.error(`[EnrichContent] Error on attempt ${attempt + 1}:`, error)
      
      if (attempt === maxRetries) {
        return { success: false, errors: [error.message || 'Unknown error'] }
      }
      
      attempt++
    }
  }

  return { success: false, errors: ['Max retries exceeded'] }
}

/**
 * Fallback enrichment using simple extraction (no AI)
 */
export function enrichContentFallback(
  articleText: string,
  title: string
): SummaryContract {
  // Simple extraction for when AI fails
  const sentences = articleText
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 30)
  
  // Summary: first 2 sentences
  const summary = sentences.slice(0, 2).join('. ').substring(0, 240)
  
  // Key facts: extract sentences with numbers or specific indicators
  const keyFacts = sentences
    .filter(s => /\d/.test(s) || /said|announced|reported|confirmed/i.test(s))
    .slice(0, 7)
    .map(text => ({ text: text.substring(0, 200) }))
  
  // Ensure minimum 3 facts
  while (keyFacts.length < 3 && keyFacts.length < sentences.length) {
    keyFacts.push({ text: sentences[keyFacts.length].substring(0, 200) })
  }
  
  return {
    summary: summary.length >= 120 ? summary : (summary + ' ' + sentences[2] || '').substring(0, 240),
    keyFacts: keyFacts.slice(0, 7),
    context: `This content relates to ${title}.`,
    entities: []
  }
}
