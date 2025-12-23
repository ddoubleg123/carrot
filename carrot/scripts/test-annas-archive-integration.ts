/**
 * Test full Anna's Archive integration with MultiSourceOrchestrator
 */

import { MultiSourceOrchestrator } from '../src/lib/discovery/multiSourceOrchestrator'

async function testIntegration() {
  console.log('=== TESTING ANNA\'S ARCHIVE INTEGRATION ===\n')
  
  const orchestrator = new MultiSourceOrchestrator()
  
  // Test with Israel patch
  const result = await orchestrator.discover(
    'Israel',
    'Historical and political content about Israel',
    ['history', 'politics', 'middle-east']
  )
  
  console.log('\n=== DISCOVERY RESULTS ===\n')
  console.log(`Total sources: ${result.sources.length}`)
  console.log(`\nStats:`)
  console.log(`  Wikipedia pages: ${result.stats.wikipediaPages}`)
  console.log(`  Wikipedia citations: ${result.stats.wikipediaCitations}`)
  console.log(`  News articles: ${result.stats.newsArticles}`)
  console.log(`  Anna's Archive books: ${result.stats.annasArchiveBooks}`)
  console.log(`  Duplicates removed: ${result.stats.duplicatesRemoved}`)
  
  // Show Anna's Archive results
  const annasArchiveResults = result.sources.filter(s => s.source === "Anna's Archive")
  if (annasArchiveResults.length > 0) {
    console.log(`\n=== ANNA'S ARCHIVE RESULTS (${annasArchiveResults.length}) ===\n`)
    annasArchiveResults.slice(0, 5).forEach((result, idx) => {
      console.log(`${idx + 1}. ${result.title}`)
      console.log(`   Author: ${result.metadata.author || 'Unknown'}`)
      console.log(`   Year: ${result.metadata.year || 'Unknown'}`)
      console.log(`   URL: ${result.url}`)
      console.log(`   Relevance: ${result.relevanceScore}`)
      console.log('')
    })
  } else {
    console.log('\n⚠️  No Anna\'s Archive results found')
    console.log('   Check if "AnnasArchive" or "Books" is in primarySources')
    console.log(`   Strategy primarySources: ${result.strategy.primarySources.join(', ')}`)
  }
}

testIntegration().catch(console.error)

