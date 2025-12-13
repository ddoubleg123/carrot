import { z } from 'zod'

/**
 * Summarizer contract with strict validation
 */

export const SummaryContractSchema = z.object({
  summary: z.string()
    .min(120, 'Summary must be at least 120 characters')
    .max(240, 'Summary must not exceed 240 characters'),
  keyFacts: z.array(
    z.object({
      text: z.string()
        .min(20, 'Fact must be at least 20 characters')
        .max(200, 'Fact must not exceed 200 characters'),
      date: z.string().optional()
    })
  )
    .min(3, 'At least 3 key facts required')
    .max(8, 'No more than 8 key facts'),
  context: z.string()
    .min(50, 'Context must be at least 50 characters')
    .max(1500, 'Context must not exceed 1500 characters (up to 3 paragraphs for fair use)'),
  entities: z.array(z.string())
    .min(0)
    .max(10, 'No more than 10 entities')
})

export type SummaryContract = z.infer<typeof SummaryContractSchema>

/**
 * Truncate string at word boundary to fit within max length
 * Accounts for ellipsis to ensure final length doesn't exceed maxLength
 */
function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  
  // Reserve 3 chars for ellipsis
  const targetLength = maxLength - 3
  
  // Truncate to targetLength, then find last space before that point
  const truncated = text.substring(0, targetLength)
  const lastSpace = truncated.lastIndexOf(' ')
  
  if (lastSpace > targetLength * 0.8) {
    // If we found a space reasonably close to the end, truncate there
    return truncated.substring(0, lastSpace).trim() + '...'
  }
  
  // Otherwise, just truncate and add ellipsis
  return truncated.trim() + '...'
}

/**
 * Auto-truncate data to fit within limits before validation
 */
function autoTruncate(data: any): any {
  const result = { ...data }
  
  // Truncate summary if needed (max 240)
  if (result.summary && typeof result.summary === 'string' && result.summary.length > 240) {
    result.summary = truncateAtWordBoundary(result.summary, 240)
    console.log(`[AutoTruncate] Summary truncated from ${data.summary.length} to ${result.summary.length} chars`)
  }
  
  // Truncate context if needed (max 1500 for fair use - up to 3 paragraphs)
  if (result.context && typeof result.context === 'string' && result.context.length > 1500) {
    result.context = truncateAtWordBoundary(result.context, 1500)
    console.log(`[AutoTruncate] Context truncated from ${data.context.length} to ${result.context.length} chars`)
  }
  
  // Truncate key facts if needed (max 200 each)
  if (result.keyFacts && Array.isArray(result.keyFacts)) {
    result.keyFacts = result.keyFacts.map((fact: any, index: number) => {
      if (fact.text && typeof fact.text === 'string' && fact.text.length > 200) {
        const originalLength = fact.text.length
        fact = { ...fact, text: truncateAtWordBoundary(fact.text, 200) }
        console.log(`[AutoTruncate] Key fact ${index + 1} truncated from ${originalLength} to ${fact.text.length} chars`)
      }
      return fact
    })
    
    // Limit to max 8 facts
    if (result.keyFacts.length > 8) {
      console.log(`[AutoTruncate] Key facts limited from ${result.keyFacts.length} to 8`)
      result.keyFacts = result.keyFacts.slice(0, 8)
    }
  }
  
  // Limit entities to max 10
  if (result.entities && Array.isArray(result.entities) && result.entities.length > 10) {
    console.log(`[AutoTruncate] Entities limited from ${result.entities.length} to 10`)
    result.entities = result.entities.slice(0, 10)
  }
  
  return result
}

/**
 * Validate summary contract and reject boilerplate language
 * Auto-truncates content that slightly exceeds limits instead of failing
 */
export function validateSummary(data: unknown): { valid: boolean; errors?: string[]; data?: SummaryContract } {
  try {
    // Auto-truncate before validation
    const truncated = autoTruncate(data)
    const parsed = SummaryContractSchema.parse(truncated)
    
    // Additional quality checks
    const errors: string[] = []
    
    // Check for boilerplate adjectives without facts
    const boilerplateWords = ['iconic', 'legendary', 'incredible', 'amazing', 'stunning', 'remarkable']
    const summaryLower = parsed.summary.toLowerCase()
    
    boilerplateWords.forEach(word => {
      if (summaryLower.includes(word)) {
        const hasNumbers = /\d/.test(parsed.summary)
        const hasSpecificFacts = parsed.summary.split(' ').length > 15
        
        if (!hasNumbers && !hasSpecificFacts) {
          errors.push(`Summary contains '${word}' without specific facts`)
        }
      }
    })
    
    // Check key facts for substance
    parsed.keyFacts.forEach((fact, index) => {
      if (fact.text.split(' ').length < 5) {
        errors.push(`Key fact ${index + 1} is too short`)
      }
      
      // Check for filler phrases
      const fillerPhrases = ['it is known', 'it is said', 'many people', 'some say']
      fillerPhrases.forEach(phrase => {
        if (fact.text.toLowerCase().includes(phrase)) {
          errors.push(`Key fact ${index + 1} contains filler phrase: '${phrase}'`)
        }
      })
    })
    
    if (errors.length > 0) {
      return { valid: false, errors }
    }
    
    return { valid: true, data: parsed }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        valid: false, 
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      }
    }
    
    return { valid: false, errors: ['Unknown validation error'] }
  }
}

/**
 * Generate summary prompt for LLM
 */
export function generateSummaryPrompt(
  articleText: string,
  title: string,
  url: string,
  groupTags: string[]
): string {
  const trimmedText = articleText.substring(0, 6000) // ~1500 words
  
  return `You are a research assistant that creates concise, factual summaries for a content curation platform.

**Article Title:** ${title}
**Source:** ${url}
**Group Context:** ${groupTags.join(', ')}

**Article Content:**
${trimmedText}

**Your Task:**
Generate a JSON summary following these STRICT rules:

1. **Executive Summary** (120-240 chars):
   - 2-3 sentences maximum
   - Focus on CONCRETE FACTS (dates, numbers, names, actions)
   - NO adjectives like "iconic", "legendary", "remarkable" unless backed by specific data
   - NO filler phrases like "is known for", "many people", "it is said"

2. **Key Facts** (5-8 items):
   - Each fact must be SPECIFIC and ACTIONABLE
   - Include dates when relevant (format: "Month Day, Year")
   - Each fact 20-200 characters
   - NO generic statements
   - NO marketing language

3. **Context** (50-1500 chars, 2-3 paragraphs):
   - Explain why this matters to the group (${groupTags.join(', ')})
   - Connect to group interests with specific details
   - **CRITICAL**: When directly quoting source material, ALWAYS use quotation marks: "quoted text" - Source attribution
   - If you are paraphrasing or summarizing, do NOT use quotes
   - If you are using exact words from the source, you MUST use quotes
   - Continue until the explanation is complete (up to 3 paragraphs for fair use)
   - Do NOT truncate mid-sentence - ensure complete thoughts and full paragraphs
   - Each paragraph should be 3-5 sentences and complete a thought

4. **Entities** (3-10):
   - Extract people, teams, organizations, places mentioned
   - Deduplicate
   - Most relevant only

**Output Format:**
{
  "summary": "string",
  "keyFacts": [
    { "text": "string", "date": "optional string" }
  ],
  "context": "string",
  "entities": ["string"]
}

**Example of GOOD output:**
{
  "summary": "Michael Jordan scored 63 points against the Boston Celtics in the 1986 NBA Playoffs, setting a playoff record that stood for over 20 years. Larry Bird called him 'God disguised as Michael Jordan' after the game.",
  "keyFacts": [
    { "text": "Scored 63 points in Game 2 of the 1986 Eastern Conference First Round", "date": "April 20, 1986" },
    { "text": "Previous playoff scoring record was 61 points by Elgin Baylor in 1962", "date": "April 14, 1962" },
    { "text": "Bulls lost the game 135-131 in double overtime despite Jordan's performance" },
    { "text": "Jordan averaged 43.7 points per game in the series" },
    { "text": "Larry Bird scored 36 points, Kevin McHale added 27 points for Boston" }
  ],
  "context": "This performance established Jordan as an elite playoff performer early in his career. As Larry Bird noted after the game, \"God disguised as Michael Jordan\" - highlighting the extraordinary nature of the performance. This set the standard for individual dominance in postseason basketball that defined the Bulls' dynasty era.",
  "entities": ["Michael Jordan", "Larry Bird", "Boston Celtics", "Chicago Bulls", "Kevin McHale", "Elgin Baylor"]
}

**Example of BAD output (DO NOT DO THIS):**
{
  "summary": "Michael Jordan had an iconic and legendary performance that is still remembered today as one of the greatest moments in basketball history.",
  "keyFacts": [
    { "text": "Had an amazing game" },
    { "text": "Is known for his incredible skills" }
  ]
}

Return ONLY the JSON object, no other text.`
}

/**
 * Retry policy for underfilled summaries
 */
export async function summarizeWithRetry(
  articleText: string,
  title: string,
  url: string,
  groupTags: string[],
  llmCall: (prompt: string) => Promise<unknown>,
  maxRetries: number = 1
): Promise<{ success: boolean; data?: SummaryContract; errors?: string[] }> {
  let attempt = 0
  
  while (attempt <= maxRetries) {
    try {
      const prompt = generateSummaryPrompt(articleText, title, url, groupTags)
      const response = await llmCall(prompt)
      
      const validation = validateSummary(response)
      
      if (validation.valid && validation.data) {
        return { success: true, data: validation.data }
      }
      
      if (attempt === maxRetries) {
        return { success: false, errors: validation.errors }
      }
      
      // Retry with stricter prompt
      console.log(`Attempt ${attempt + 1} failed, retrying with stricter prompt...`)
      attempt++
    } catch (error) {
      if (attempt === maxRetries) {
        return { success: false, errors: [(error as Error).message] }
      }
      attempt++
    }
  }
  
  return { success: false, errors: ['Max retries exceeded'] }
}
