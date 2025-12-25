/**
 * Test extracting 2 PDFs from Anna's Archive
 * This will test the full flow and report results
 */

// Polyfill DOMMatrix for pdf-parse BEFORE importing it
if (typeof global.DOMMatrix === 'undefined') {
  try {
    const dommatrix = require('dommatrix')
    global.DOMMatrix = dommatrix.DOMMatrix || dommatrix
  } catch (e) {
    global.DOMMatrix = class DOMMatrix {
      constructor(init?: any) {}
      static fromMatrix(other?: any) { return new DOMMatrix() }
    } as any
  }
}

import { extractBookContent } from './extract-annas-archive-book'
import * as fs from 'fs/promises'
import * as path from 'path'

async function testExtract2PDFs() {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`TESTING ANNA'S ARCHIVE PDF EXTRACTION`)
  console.log(`${'='.repeat(80)}\n`)
  
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
  
  const results: Array<{
    title: string
    url: string
    success: boolean
    textLength: number
    fileName?: string
    error?: string
  }> = []
  
  for (let i = 0; i < testBooks.length; i++) {
    const book = testBooks[i]
    console.log(`\n${'='.repeat(80)}`)
    console.log(`BOOK ${i + 1}/2: ${book.title}`)
    console.log(`${'='.repeat(80)}`)
    console.log(`URL: ${book.url}\n`)
    
    try {
      const extractedContent = await extractBookContent(book.url)
      
      if (extractedContent) {
        // Check if it's actual extracted text or a status message
        const isActualText = extractedContent.length > 1000 && 
                            !extractedContent.includes('PDF file') && 
                            !extractedContent.includes('Saved to:') &&
                            !extractedContent.startsWith('[')
        
        let textLength: number
        let fileName: string | undefined
        let success = false
        
        if (isActualText) {
          // It's actual extracted text
          textLength = extractedContent.length
          success = true
          console.log(`\n✅ SUCCESS: Extracted ${textLength.toLocaleString()} characters of text`)
          
          // Save to file
          const outputDir = path.join(process.cwd(), 'data', 'extracted-text')
          await fs.mkdir(outputDir, { recursive: true })
          const safeTitle = book.title.replace(/[^a-z0-9]/gi, '_').substring(0, 100)
          const textPath = path.join(outputDir, `${safeTitle}_${Date.now()}.txt`)
          await fs.writeFile(textPath, extractedContent, 'utf-8')
          fileName = path.basename(textPath)
          console.log(`✅ Saved text to: ${textPath}`)
        } else {
          // It's a status message - try to extract info
          console.log(`\n📄 Status: ${extractedContent.substring(0, 300)}...`)
          
          // Try to extract character count from message
          const charMatch = extractedContent.match(/(\d+(?:,\d+)*)\s*characters/)
          textLength = charMatch ? parseInt(charMatch[1].replace(/,/g, '')) : extractedContent.length
          
          // Check if PDF was downloaded
          if (extractedContent.includes('PDF') || extractedContent.includes('downloaded') || extractedContent.includes('Saved to:')) {
            success = true
            console.log(`\n✅ PDF downloaded successfully`)
            
            // Try to extract file path
            const pathMatch = extractedContent.match(/(?:Saved to:|Path:)\s*([^\n]+)/)
            if (pathMatch) {
              fileName = pathMatch[1].split(/[/\\]/).pop() || undefined
            }
          }
        }
        
        results.push({
          title: book.title,
          url: book.url,
          success,
          textLength,
          fileName
        })
      } else {
        console.log(`\n❌ No content extracted`)
        results.push({
          title: book.title,
          url: book.url,
          success: false,
          textLength: 0
        })
      }
    } catch (error: any) {
      console.error(`\n❌ Error extracting book: ${error.message}`)
      console.error(error.stack)
      results.push({
        title: book.title,
        url: book.url,
        success: false,
        textLength: 0,
        error: error.message
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
  console.log(`Successfully extracted text from ${successful.length}/2 PDFs:\n`)
  
  results.forEach((result, idx) => {
    console.log(`PDF ${idx + 1}: ${result.success ? '✅' : '❌'} ${result.title}`)
    if (result.fileName) {
      console.log(`   File: ${result.fileName}`)
    }
    console.log(`   Characters extracted: ${result.textLength.toLocaleString()}`)
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
    console.log(`   URL: ${result.url}\n`)
  })
  
  if (successful.length === 2) {
    console.log(`\n✅ SUCCESS: Extracted text from 2 PDFs as requested!`)
    console.log(`\nSummary:`)
    console.log(`  PDF 1: "${results[0].title}"`)
    console.log(`    - Characters: ${results[0].textLength.toLocaleString()}`)
    console.log(`    - File: ${results[0].fileName || 'N/A'}`)
    console.log(`\n  PDF 2: "${results[1].title}"`)
    console.log(`    - Characters: ${results[1].textLength.toLocaleString()}`)
    console.log(`    - File: ${results[1].fileName || 'N/A'}`)
  } else {
    console.log(`\n⚠️  Only extracted ${successful.length}/2 PDFs`)
    if (successful.length > 0) {
      console.log(`\nPartial Summary:`)
      results.forEach((r, i) => {
        if (r.success) {
          console.log(`  PDF ${i + 1}: "${r.title}" - ${r.textLength.toLocaleString()} characters`)
        }
      })
    }
  }
}

testExtract2PDFs().catch(console.error)

