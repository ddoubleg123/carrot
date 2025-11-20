/**
 * Consistent error taxonomy for crawler failures
 */

export type FailReason =
  | 'robots_disallowed'
  | 'http_4xx'
  | 'http_5xx'
  | 'content_type_unsupported'
  | 'timeout'
  | 'parse_failure'
  | 'summarizer_contract_violation'
  | 'db_write_error'
  | 'hero_image_validation_error'
  | 'image_not_found'
  | 'unknown_error'

/**
 * Classify error into failReason taxonomy
 */
export function classifyFailReason(error: Error | string, httpStatus?: number): FailReason {
  const errorStr = typeof error === 'string' ? error : error.message || 'unknown_error'
  const lower = errorStr.toLowerCase()

  // HTTP status codes
  if (httpStatus) {
    if (httpStatus >= 400 && httpStatus < 500) {
      return 'http_4xx'
    }
    if (httpStatus >= 500) {
      return 'http_5xx'
    }
  }

  // Specific error patterns
  if (lower.includes('robots') || lower.includes('disallowed')) {
    return 'robots_disallowed'
  }
  if (lower.includes('timeout') || lower.includes('abort')) {
    return 'timeout'
  }
  if (lower.includes('content_type') || lower.includes('unsupported')) {
    return 'content_type_unsupported'
  }
  if (lower.includes('parse') || lower.includes('extract')) {
    return 'parse_failure'
  }
  if (lower.includes('summarizer') || lower.includes('contract') || lower.includes('validation')) {
    return 'summarizer_contract_violation'
  }
  if (lower.includes('database') || lower.includes('prisma') || lower.includes('db_write')) {
    return 'db_write_error'
  }
  if (lower.includes('hero') || lower.includes('image') || lower.includes('400')) {
    if (lower.includes('validation')) {
      return 'hero_image_validation_error'
    }
    if (lower.includes('not found') || lower.includes('empty')) {
      return 'image_not_found'
    }
  }

  return 'unknown_error'
}

/**
 * Get human-readable error message
 */
export function getFailReasonMessage(reason: FailReason): string {
  const messages: Record<FailReason, string> = {
    robots_disallowed: 'Blocked by robots.txt',
    http_4xx: 'Client error (4xx)',
    http_5xx: 'Server error (5xx)',
    content_type_unsupported: 'Unsupported content type',
    timeout: 'Request timeout',
    parse_failure: 'Failed to parse content',
    summarizer_contract_violation: 'Summarizer contract violation',
    db_write_error: 'Database write error',
    hero_image_validation_error: 'Hero image validation error',
    image_not_found: 'Image not found',
    unknown_error: 'Unknown error'
  }
  return messages[reason] || 'Unknown error'
}

