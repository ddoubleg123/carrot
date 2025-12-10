/**
 * Test script to verify Wikimedia fallback is working
 * Tests the Wikimedia search API endpoint
 */

async function testWikimediaSearch() {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const testQueries = [
    'Israel',
    'Hezbollah',
    'Gaza',
    'Palestinian',
    'Jerusalem'
  ]

  console.log('🧪 Testing Wikimedia Commons Search API\n')
  console.log(`Base URL: ${baseUrl}\n`)

  for (const query of testQueries) {
    try {
      console.log(`Testing query: "${query}"`)
      
      const response = await fetch(`${baseUrl}/api/media/wikimedia-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-key': process.env.INTERNAL_API_KEY || ''
        },
        body: JSON.stringify({
          query: query,
          limit: 3
        })
      })

      if (!response.ok) {
        console.error(`  ❌ HTTP ${response.status}: ${response.statusText}`)
        const errorText = await response.text()
        console.error(`  Error: ${errorText}`)
        continue
      }

      const data = await response.json()
      
      if (data.error) {
        console.error(`  ❌ API Error: ${data.error}`)
        continue
      }

      if (!data.images || data.images.length === 0) {
        console.log(`  ⚠️  No images found`)
        continue
      }

      console.log(`  ✅ Found ${data.images.length} image(s)`)
      
      data.images.forEach((img: any, index: number) => {
        console.log(`    ${index + 1}. ${img.title}`)
        console.log(`       URL: ${img.url?.substring(0, 80)}...`)
        if (img.thumbnail && img.thumbnail !== img.url) {
          console.log(`       Thumbnail: ${img.thumbnail.substring(0, 80)}...`)
        }
      })
      
      // Verify the URL is a valid image URL (not a wiki page URL)
      const firstImage = data.images[0]
      if (firstImage.url) {
        const isImageUrl = firstImage.url.match(/\.(jpg|jpeg|png|gif|webp)/i) || 
                          firstImage.url.includes('upload.wikimedia.org') ||
                          firstImage.url.includes('Special:FilePath')
        if (isImageUrl) {
          console.log(`  ✅ Image URL is valid (direct image URL)`)
        } else {
          console.warn(`  ⚠️  Image URL might be a wiki page URL: ${firstImage.url}`)
        }
      }
      
      console.log('')
      
    } catch (error: any) {
      console.error(`  ❌ Error testing "${query}":`, error.message)
      console.log('')
    }
  }

  console.log('✅ Wikimedia search test complete')
}

// Run the test
testWikimediaSearch()
  .then(() => {
    console.log('\n✨ All tests completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error)
    process.exit(1)
  })

