/**
 * Crawler configuration from environment variables
 * Phase 9: Deployment & Safety
 */

export const crawlerConfig = {
  // LLM Configuration
  llmModel: process.env.LLM_MODEL || 'deepseek',
  llmApiKey: process.env.LLM_API_KEY || '',
  
  // Domain limits
  maxPerDomain: Number(process.env.MAX_PER_DOMAIN) || 3,
  wikiCap: Number(process.env.WIKI_CAP) || 2,
  
  // Article regex (optional override)
  articleRegex: process.env.ARTICLE_REGEX 
    ? new RegExp(process.env.ARTICLE_REGEX)
    : /\d{4}\/\d{2}\/|\/\d{4}\/|\/news\/|\/article\/|\/story\/|\/sports\//,
  
  // Zero results alert
  zeroAlertWindowMin: Number(process.env.ZERO_ALERT_WINDOW_MIN) || 5,
  
  // Fetch configuration
  fetchTimeoutMs: Number(process.env.FETCH_TIMEOUT_MS) || 15_000,
  userAgent: process.env.CRAWLER_USER_AGENT || 'Mozilla/5.0 (compatible; CarrotCrawler/1.0)',
  
  // Retry configuration
  maxRetries: Number(process.env.CRAWLER_MAX_RETRIES) || 3,
  baseBackoffMs: Number(process.env.CRAWLER_BASE_BACKOFF_MS) || 1000,
  
  // Queue configuration
  discoveryConcurrency: Number(process.env.DISCOVERY_CONCURRENCY) || 3,
  extractionConcurrency: Number(process.env.EXTRACTION_CONCURRENCY) || 2,
}

