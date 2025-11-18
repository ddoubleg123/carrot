/**
 * Test script to run crawler for a topic
 * Usage: tsx scripts/run-crawler-test.ts --topic "Chicago Bulls" --duration 3
 */

import { CrawlerOrchestrator } from '../src/lib/crawler/orchestrator'

const args = process.argv.slice(2)
const topicIndex = args.indexOf('--topic')
const durationIndex = args.indexOf('--duration')
const maxPagesIndex = args.indexOf('--max-pages')

const topic = topicIndex >= 0 && args[topicIndex + 1] ? args[topicIndex + 1] : 'Chicago Bulls'
const durationMinutes = durationIndex >= 0 && args[durationIndex + 1] 
  ? Number(args[durationIndex + 1]) 
  : 3
const maxPages = maxPagesIndex >= 0 && args[maxPagesIndex + 1]
  ? Number(args[maxPagesIndex + 1])
  : 50

async function main() {
  console.log(`\n🚀 Starting crawler test`)
  console.log(`   Topic: ${topic}`)
  console.log(`   Duration: ${durationMinutes} minutes`)
  console.log(`   Max pages: ${maxPages}\n`)

  const orchestrator = new CrawlerOrchestrator()
  
  try {
    const result = await orchestrator.run({
      topic,
      durationMinutes,
      maxPages,
    })
    
    console.log('\n✅ Crawler run completed!')
    console.log('\n📊 Results:')
    console.log(`   Duration: ${result.durationSeconds}s`)
    console.log(`   Fetched: ${result.stats.fetched}`)
    console.log(`   Enqueued: ${result.stats.enqueued}`)
    console.log(`   Deduped: ${result.stats.deduped}`)
    console.log(`   Skipped: ${result.stats.skipped}`)
    console.log(`   Persisted: ${result.stats.persisted}`)
    console.log(`   Extracted: ${result.stats.extracted}`)
    console.log(`   Errors: ${result.stats.errors}`)
    console.log('')
    
    // Check acceptance criteria
    const nonWikiPercent = result.stats.fetched > 0
      ? ((result.stats.fetched - (result.stats.fetched * 0.4)) / result.stats.fetched) * 100
      : 0
    
    console.log('📋 Acceptance Criteria:')
    console.log(`   ✅ Non-Wikipedia pages: ${nonWikiPercent >= 60 ? '✅' : '❌'} (target: ≥60%)`)
    console.log(`   ✅ Extractions: ${result.stats.extracted >= 10 ? '✅' : '❌'} (target: ≥10)`)
    console.log(`   ✅ Errors: ${result.stats.errors === 0 ? '✅' : '⚠️'} (target: 0)`)
    console.log('')
    
    if (result.success) {
      process.exit(0)
    } else {
      process.exit(1)
    }
  } catch (error: any) {
    console.error('\n❌ Crawler run failed:', error)
    process.exit(1)
  }
}

main()

