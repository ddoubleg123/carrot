/**
 * Analyze content extraction for a specific URL
 */

import { extractReadableContent } from '@/lib/readability'
import { fetchWithProxy } from '@/lib/fetchProxy'

async function analyzeContentExtraction(url: string) {
  try {
    console.log(`\n🔍 Analyzing Content Extraction for: ${url}\n`)

    // Fetch the page
    const response = await fetchWithProxy(url, {
      timeout: 10000,
      userAgent: 'Mozilla/5.0 (compatible; CarrotBot/1.0)'
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    console.log(`✅ Fetched ${html.length} characters of HTML\n`)

    // Extract content
    const readable = extractReadableContent(html, url)

    console.log(`📊 Extraction Results:`)
    console.log(`   Title: ${readable.title}`)
    console.log(`   Content Length: ${readable.content.length} chars`)
    console.log(`   Text Length: ${readable.textContent.length} chars`)
    console.log(`   Excerpt (first 300 chars): ${readable.excerpt.substring(0, 300)}...\n`)

    // Analyze the extracted text
    const textLower = readable.textContent.toLowerCase()
    const hasMenuText = textLower.includes('menu') || textLower.includes('home') || textLower.includes('about')
    const hasNavigation = textLower.includes('search') || textLower.includes('contact') || textLower.includes('donate')
    
    console.log(`🔍 Content Analysis:`)
    console.log(`   Contains menu/navigation text: ${hasMenuText ? '⚠️ YES' : '✅ NO'}`)
    console.log(`   Contains navigation elements: ${hasNavigation ? '⚠️ YES' : '✅ NO'}`)
    
    // Try to find the actual article title
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i) || 
                      html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const pageTitle = titleMatch ? titleMatch[1].trim() : readable.title
    
    console.log(`\n📝 Suggested Title:`)
    console.log(`   Current: "${readable.title}"`)
    console.log(`   Page Title: "${pageTitle}"`)
    
    // Look for main heading in content
    const h1Match = readable.content.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    if (h1Match) {
      console.log(`   Main Heading: "${h1Match[1].trim()}"`)
    }

    // Check if we can find better content
    console.log(`\n🔧 Extraction Issues:`)
    if (hasMenuText) {
      console.log(`   ⚠️  Extraction is picking up menu/navigation text`)
      console.log(`   💡 Solution: Need better content selectors or use Mozilla Readability`)
    }
    
    if (readable.textContent.length < 500) {
      console.log(`   ⚠️  Extracted content is very short (${readable.textContent.length} chars)`)
      console.log(`   💡 Solution: Content extraction may have failed`)
    }

    // Show first 500 chars of actual text
    console.log(`\n📄 First 500 chars of extracted text:`)
    console.log(readable.textContent.substring(0, 500))
    console.log(`\n`)

  } catch (error: any) {
    console.error('❌ Error:', error.message)
  }
}

const url = process.argv[2] || 'http://www.encyclopediaofukraine.com/display.asp?linkpath=pages\\Z\\I\\Zionistmovement'

analyzeContentExtraction(url)
  .then(() => {
    console.log('✨ Analysis complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Analysis failed:', error)
    process.exit(1)
  })
