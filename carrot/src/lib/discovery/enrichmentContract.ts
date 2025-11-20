import { z } from 'zod'

/**
 * Enrichment contract - expected shape from summarizer
 */
export const EnrichmentSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(80),
  keyFacts: z.array(z.string()).min(3).max(8),
  notableQuotes: z.array(z.object({
    quote: z.string(),
    attribution: z.string().optional(),
    sourceUrl: z.string().url().optional()
  })),
  isUseful: z.boolean()
})

export type Enrichment = z.infer<typeof EnrichmentSchema>

/**
 * Validate enrichment response and fill defaults if needed
 */
export function validateEnrichment(data: unknown): {
  valid: boolean
  data?: Enrichment
  errors?: string[]
} {
  try {
    const parsed = EnrichmentSchema.parse(data)
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
 * Fill safe defaults for missing fields
 */
export function fillEnrichmentDefaults(partial: Partial<Enrichment>, title: string, summary: string): Enrichment {
  return {
    title: partial.title || title,
    summary: partial.summary || summary || 'No summary available.',
    keyFacts: partial.keyFacts && Array.isArray(partial.keyFacts) && partial.keyFacts.length >= 3
      ? partial.keyFacts.slice(0, 8)
      : ['Content extracted successfully.', 'Details available in source.', 'Further information in original article.'],
    notableQuotes: partial.notableQuotes && Array.isArray(partial.notableQuotes)
      ? partial.notableQuotes.slice(0, 2) // Hard cap at 2 quotes
      : [],
    isUseful: partial.isUseful ?? true
  }
}

