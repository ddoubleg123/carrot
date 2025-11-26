/**
 * Environment variable validation at boot
 * Hard-fails if any required env vars are missing or malformed
 */

import { z } from 'zod'

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().min(1, 'DATABASE_URL is required'),
  
  // Redis
  REDIS_URL: z.string().url().min(1, 'REDIS_URL is required'),
  
  // Rate limiting / RPS caps
  RATE_LIMIT_PER_HOUR: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  MAX_ITEMS_PER_BATCH: z.string().optional().transform(val => val ? parseInt(val, 10) : undefined),
  
  // Playwright flags
  ENABLE_PLAYWRIGHT: z.string().optional().transform(val => val === 'true'),
  PLAYWRIGHT_HEADLESS: z.string().optional().transform(val => val !== 'false'), // Default true
  
  // NextAuth
  NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET is required'),
  NEXTAUTH_URL: z.string().url().optional(),
  
  // Optional but validated if present
  INTERNAL_ENRICH_TOKEN: z.string().optional(),
  DEEPSEEK_API_KEY: z.string().optional(),
})

export type ValidatedEnv = z.infer<typeof envSchema>

let validatedEnv: ValidatedEnv | null = null

/**
 * Validate environment variables at boot
 * Throws if validation fails
 */
export function validateEnv(): ValidatedEnv {
  if (validatedEnv) {
    return validatedEnv
  }

  try {
    validatedEnv = envSchema.parse(process.env)
    console.log('[Env] ✅ Environment validation passed')
    return validatedEnv
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missing = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n')
      console.error('[Env] ❌ Environment validation failed:\n', missing)
      throw new Error(`Environment validation failed:\n${missing}`)
    }
    throw error
  }
}

/**
 * Get validated env (must call validateEnv() first)
 */
export function getEnv(): ValidatedEnv {
  if (!validatedEnv) {
    throw new Error('validateEnv() must be called before getEnv()')
  }
  return validatedEnv
}

