#!/usr/bin/env tsx
/**
 * Run crawler once with specified inputs
 * 
 * Usage:
 *   tsx scripts/run-crawler-once.ts --runId dev-check --keywords "Chicago Bulls" --notes "features; statistics; season outlook"
 * 
 * Environment overrides:
 *   CRAWLER_MAX_ATTEMPTS_TOTAL=20
 *   CRAWLER_MAX_ATTEMPTS_PER_STEP=5
 *   CRAWLER_CONCURRENCY=3
 */

import { DeepLinkCrawler } from '../src/lib/discovery/deepLinkCrawler'

// Parse CLI args
const args = process.argv.slice(2)
const options: {
  runId: string | null
  keywords: string[] | null
  notes: string | null
} = {
  runId: null,
  keywords: null,
  notes: null
}

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--runId' && args[i + 1]) {
    options.runId = args[i + 1]
    i++
  } else if (args[i] === '--keywords' && args[i + 1]) {
    options.keywords = args[i + 1].split(',').map(k => k.trim())
    i++
  } else if (args[i] === '--notes' && args[i + 1]) {
    options.notes = args[i + 1]
    i++
  }
}

if (!options.runId) {
  console.error('Error: --runId is required')
  process.exit(1)
}

if (!options.keywords && !options.notes) {
  console.error('Error: --keywords or --notes is required')
  process.exit(1)
}

// Run crawler
async function main() {
  const crawler = new DeepLinkCrawler(options.runId)
  
  const meta = {
    keywords: options.keywords,
    notes: options.notes
  }

  console.log(`[Crawler] Starting run: ${options.runId}`)
  console.log(`[Crawler] Input:`, JSON.stringify(meta, null, 2))
  console.log(`[Crawler] Config:`, {
    MAX_ATTEMPTS_TOTAL: process.env.CRAWLER_MAX_ATTEMPTS_TOTAL || 40,
    MAX_ATTEMPTS_PER_STEP: process.env.CRAWLER_MAX_ATTEMPTS_PER_STEP || 10,
    CONCURRENCY: process.env.CRAWLER_CONCURRENCY || 4,
    FETCH_TIMEOUT_MS: process.env.CRAWLER_FETCH_TIMEOUT_MS || 15000
  })

  const summary = await crawler.run(meta)

  console.log('\n[Crawler] Run complete!')
  console.log(JSON.stringify(summary, null, 2))

  // Check acceptance criteria
  const checks = {
    noInfiniteReseed: (summary.meta.attempts.byStep.reseed || 0) <= 1,
    hasQueryExpand: (summary.meta.attempts.byStep.query_expand || 0) > 0,
    hasItemsOrError: summary.meta.itemsSaved > 0 || (summary.error && summary.error.code === 'ERR_NO_QUERY_INPUT'),
    hasErrorCodes: !summary.error || (summary.error.code && summary.error.msg)
  }

  console.log('\n[Crawler] Acceptance checks:')
  console.log(JSON.stringify(checks, null, 2))

  if (Object.values(checks).every(v => v === true)) {
    console.log('\n✅ All acceptance criteria met!')
    process.exit(0)
  } else {
    console.log('\n❌ Some acceptance criteria failed')
    process.exit(1)
  }
}

main().catch(error => {
  console.error('[Crawler] Fatal error:', error)
  process.exit(1)
})
