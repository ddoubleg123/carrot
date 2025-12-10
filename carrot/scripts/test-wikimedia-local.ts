/**
 * Test Wikimedia search API locally
 */

async function testWikimediaLocal() {
  const baseUrl = 'http://localhost:3005'
  
  console.log('🧪 Testing Wikimedia Search API locally\n')
  console.log(`Base URL: ${baseUrl}\n`)

  const testQueries = [
    'Israel',
    'Hezbollah',
    'Gaza conflict'
  ]

  for (const query of testQueries) {
    try {
      console.log(`Testing query: "${query}"`)
      
      const response = await fetch(`${baseUrl}/api/media/wikimedia-search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: query,
          limit: 3
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`  ❌ HTTP ${response.status}: ${errorText}`)
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
        console.log(`       URL: ${img.url?.substring(0, 100)}...`)
        
        // Verify URL is a direct image URL
        const isDirectImage = img.url && (
          img.url.includes('upload.wikimedia.org') ||
          img.url.includes('Special:FilePath') ||
          img.url.match(/\.(jpg|jpeg|png|gif|webp)/i)
        )
        
        if (isDirectImage) {
          console.log(`       ✅ Valid direct image URL`)
        } else {
          console.warn(`       ⚠️  Might be a wiki page URL: ${img.url}`)
        }
      })
      
      console.log('')
      
    } catch (error: any) {
      if (error.message?.includes('ECONNREFUSED') || error.message?.includes('fetch failed')) {
        console.error(`  ❌ Cannot connect to ${baseUrl}`)
        console.error(`     Make sure the dev server is running: npm run dev`)
      } else {
        console.error(`  ❌ Error: ${error.message}`)
      }
      console.log('')
    }
  }

  console.log('✅ Test complete')
}

testWikimediaLocal()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error)
    process.exit(1)
  })

