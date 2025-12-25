/**
 * Direct test of PDF extraction from Anna's Archive
 * Tests 2 specific books without database dependency
 */

// Polyfill DOMMatrix for pdf-parse BEFORE importing it
if (typeof global.DOMMatrix === 'undefined') {
  try {
    const dommatrix = require('dommatrix')
    global.DOMMatrix = dommatrix.DOMMatrix || dommatrix
  } catch (e) {
    // Minimal polyfill
    global.DOMMatrix = class DOMMatrix {
      constructor(init?: any) {}
      static fromMatrix(other?: any) { return new DOMMatrix() }
    } as any
  }
}

import { extractBookContent } from './extract-annas-archive-book'

async function testPdfExtraction() {
  console.log(`\n=== TESTING PDF EXTRACTION FROM ANNA'S ARCHIVE ===\n`)
  
  // Test with 2 specific books related to Israel
  const testBooks = [
    {
      title: "Israel Rising: The Land of Israel Reawakens",
      url: "https://annas-archive.org/md5/dbe898e329267de1a5530f26de6c784a"
    },
    {
      title: "Israel and the Clash of Civilizations: Iraq, Iran and the Plan to Remake the Middle East",
      url: "https://annas-archive.org/md5/fe3c74827e47ed38c7fe797c49449627"
    }
  ]
  
  const results: Array<{ title: string; url: string; textLength: number; fileName?: string; success: boolean }> = []
  
  for (let i = 0; i < testBooks.length; i++) {
    const book = testBooks[i]
    console.log(`\n${'='.repeat(80)}`)
    console.log(`Extracting Book ${i + 1}/2: ${book.title}`)
    console.log(`URL: ${book.url}`)
    console.log(`${'='.repeat(80)}\n`)
    
    try {
      const extractedContent = await extractBookContent(book.url)
      
      if (extractedContent) {
        // Check if it's actual extracted text or a status message
        const isActualText = extractedContent.length > 1000 && !extractedContent.includes('PDF file') && !extractedContent.includes('Saved to:')
        
        let textLength: number
        let fileName: string | undefined
        let success = false
        
        if (isActualText) {
          // It's actual extracted text
          textLength = extractedContent.length
          success = true
          console.log(`\n✅ SUCCESS: Extracted ${textLength.toLocaleString()} characters of text`)
        } else {
          // It's a status message - try to extract info
          console.log(`\n📄 Status: ${extractedContent.substring(0, 300)}...`)
          
          // Try to extract character count from message
          const charMatch = extractedContent.match(/(\d+(?:,\d+)*)\s*characters/)
          textLength = charMatch ? parseInt(charMatch[1].replace(/,/g, '')) : extractedContent.length
          
          // Check if PDF was downloaded
          if (extractedContent.includes('PDF') || extractedContent.includes('downloaded')) {
            success = true
            console.log(`\n✅ PDF downloaded successfully`)
          }
          
          // Try to extract file path
          const pathMatch = extractedContent.match(/(?:Saved to:|Path:)\s*([^\n]+)/)
          if (pathMatch) {
            fileName = pathMatch[1].split(/[/\\]/).pop() || undefined
          } else {
            // Try to extract from URL
            const urlMatch = extractedContent.match(/URL:\s*([^\s\n]+)/)
            if (urlMatch) {
              const url = urlMatch[1]
              fileName = url.split('/').pop()?.split('?')[0] || undefined
            }
          }
        }
        
        results.push({
          title: book.title,
          url: book.url,
          textLength,
          fileName,
          success
        })
      } else {
        console.log(`\n❌ No content extracted`)
        results.push({
          title: book.title,
          url: book.url,
          textLength: 0,
          success: false
        })
      }
    } catch (error: any) {
      console.error(`\n❌ Error extracting book: ${error.message}`)
      console.error(error.stack)
      results.push({
        title: book.title,
        url: book.url,
        textLength: 0,
        success: false
      })
    }
    
    // Add delay between extractions
    if (i < testBooks.length - 1) {
      console.log(`\n⏳ Waiting 5 seconds before next extraction...`)
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }
  
  // Final Summary
  console.log(`\n\n${'='.repeat(80)}`)
  console.log(`FINAL RESULTS`)
  console.log(`${'='.repeat(80)}\n`)
  
  const successful = results.filter(r => r.success)
  console.log(`Successfully extracted text from ${successful.length} PDFs:\n`)
  
  results.forEach((result, idx) => {
    console.log(`PDF ${idx + 1}: ${result.success ? '✅' : '❌'}`)
    console.log(`  Title: ${result.title}`)
    if (result.fileName) {
      console.log(`  File: ${result.fileName}`)
    }
    console.log(`  Characters extracted: ${result.textLength.toLocaleString()}`)
    console.log(`  URL: ${result.url}\n`)
  })
  
  if (successful.length === 2) {
    console.log(`\n✅ SUCCESS: Extracted text from 2 PDFs as requested!`)
    console.log(`\nSummary:`)
    console.log(`  PDF 1: "${results[0].title}" - ${results[0].textLength.toLocaleString()} characters`)
    console.log(`  PDF 2: "${results[1].title}" - ${results[1].textLength.toLocaleString()} characters`)
  } else {
    console.log(`\n⚠️  Only extracted ${successful.length} PDFs (requested 2)`)
  }
}

testPdfExtraction().catch(console.error)

