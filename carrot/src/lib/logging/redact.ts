/**
 * PII/log redaction
 * Redacts Authorization, cookies, and token/key query params at logger transport layer
 */

const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-api-key', 'x-auth-token']
const SENSITIVE_QUERY_PARAMS = ['token', 'key', 'api_key', 'apikey', 'secret', 'password', 'auth']

/**
 * Redact sensitive data from an object recursively
 */
export function redactSensitiveData(obj: any, depth = 0): any {
  if (depth > 10) return '[MAX_DEPTH]' // Prevent infinite recursion
  
  if (obj === null || obj === undefined) return obj
  if (typeof obj !== 'object') return obj
  
  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item, depth + 1))
  }
  
  const redacted: any = {}
  
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase()
    
    // Redact sensitive headers
    if (SENSITIVE_HEADERS.some(h => lowerKey.includes(h))) {
      redacted[key] = '[REDACTED]'
      continue
    }
    
    // Redact sensitive query params
    if (SENSITIVE_QUERY_PARAMS.some(p => lowerKey.includes(p))) {
      redacted[key] = '[REDACTED]'
      continue
    }
    
    // Recursively redact nested objects
    if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value, depth + 1)
    } else {
      redacted[key] = value
    }
  }
  
  return redacted
}

/**
 * Redact sensitive data from URL query string
 */
export function redactQueryParams(url: string): string {
  try {
    const urlObj = new URL(url)
    const params = urlObj.searchParams
    
    for (const key of params.keys()) {
      const lowerKey = key.toLowerCase()
      if (SENSITIVE_QUERY_PARAMS.some(p => lowerKey.includes(p))) {
        params.set(key, '[REDACTED]')
      }
    }
    
    return urlObj.toString()
  } catch {
    // Invalid URL, return as-is
    return url
  }
}

/**
 * Redact sensitive data from request headers
 */
export function redactHeaders(headers: Headers | Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {}
  
  const headerObj = headers instanceof Headers
    ? Object.fromEntries(headers.entries())
    : headers
  
  for (const [key, value] of Object.entries(headerObj)) {
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_HEADERS.some(h => lowerKey.includes(h))) {
      result[key] = '[REDACTED]'
    } else {
      result[key] = value
    }
  }
  
  return result
}

/**
 * Sanitize log entry before output
 */
export function sanitizeLogEntry(entry: any): any {
  if (typeof entry !== 'object' || entry === null) return entry
  
  const sanitized = { ...entry }
  
  // Redact URL query params
  if (sanitized.url && typeof sanitized.url === 'string') {
    sanitized.url = redactQueryParams(sanitized.url)
  }
  
  // Redact headers
  if (sanitized.headers) {
    sanitized.headers = redactHeaders(sanitized.headers)
  }
  
  // Recursively redact all sensitive data
  return redactSensitiveData(sanitized)
}

