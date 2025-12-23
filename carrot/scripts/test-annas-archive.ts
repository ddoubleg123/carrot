/**
 * Test Anna's Archive search to see actual HTML structure
 */

import { searchAnnasArchive, getAnnasArchivePreview } from '../src/lib/discovery/annasArchiveSource'

async function testSearch() {
  console.log('=== TESTING ANNA\'S ARCHIVE SEARCH ===\n')
  
  // Test with Israel-related query
  const query = 'Israel history'
  
  console.log(`Searching for: "${query}"\n`)
  
  try {
    const results = await searchAnnasArchive({
      query,
      language: 'en',
      fileType: 'all',
      limit: 5
    })
    
    console.log(`Found ${results.length} results:\n`)
    
    results.forEach((result, idx) => {
      console.log(`${idx + 1}. ${result.title}`)
      console.log(`   Author: ${result.author || 'Unknown'}`)
      console.log(`   Year: ${result.year || 'Unknown'}`)
      console.log(`   File Type: ${result.fileType || 'Unknown'}`)
      console.log(`   URL: ${result.url}`)
      console.log(`   Source: ${result.source || 'Unknown'}`)
      console.log('')
    })
    
    // Test preview extraction for first result
    if (results.length > 0) {
      console.log(`\nTesting preview extraction for: "${results[0].title}"`)
      const preview = await getAnnasArchivePreview(results[0])
      if (preview) {
        console.log(`Preview: ${preview.substring(0, 200)}...`)
      } else {
        console.log('No preview available')
      }
    }
    
  } catch (error: any) {
    console.error('Error:', error.message)
    console.error(error.stack)
  }
}

testSearch().catch(console.error)

