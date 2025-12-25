/**
 * Simplified test script for archive.org PDF extraction
 * Bypasses the broken sections and tests archive.org extraction directly
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

import * as fs from 'fs/promises'
import * as path from 'path'
const pdfParse = require('pdf-parse')

async function extractArchiveOrgPDF(archiveUrl: string): Promise<{ text: string; fileName: string; charCount: number } | null> {
  console.log(`\n[Test] Extracting PDF from: ${archiveUrl}`)
  
  // Extract identifier from URL: https://archive.org/details/{identifier}
  const identifierMatch = archiveUrl.match(/\/details\/([^\/]+)/)
  if (!identifierMatch) {
    console.error(`[Test] Could not extract identifier from URL`)
    return null
  }
  
  const identifier = identifierMatch[1]
  console.log(`[Test] Archive.org identifier: ${identifier}`)
  
  // Try multiple archive.org PDF URL patterns
  const pdfUrlPatterns = [
    `https://archive.org/download/${identifier}/${identifier}.pdf`,
    `https://archive.org/download/${identifier}/${identifier.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
  ]
  
  for (const pdfUrl of pdfUrlPatterns) {
    try {
      console.log(`[Test] Trying: ${pdfUrl}`)
      const response = await fetch(pdfUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/pdf,*/*'
        },
        signal: AbortSignal.timeout(60000)
      })
      
      if (response.ok) {
        const contentType = response.headers.get('content-type') || ''
        if (contentType.includes('application/pdf')) {
          console.log(`[Test] ✅ Successfully accessed PDF`)
          
          const pdfBuffer = await response.arrayBuffer()
          const dataDir = path.join(process.cwd(), 'data', 'pdfs')
          await fs.mkdir(dataDir, { recursive: true })
          const pdfPath = path.join(dataDir, `${identifier}.pdf`)
          await fs.writeFile(pdfPath, Buffer.from(pdfBuffer))
          console.log(`[Test] Saved PDF to: ${pdfPath}`)
          
          // Extract text
          const pdfData = await pdfParse(Buffer.from(pdfBuffer))
          const extractedText = pdfData.text.trim()
          const charCount = extractedText.length
          
          console.log(`[Test] ✅ Extracted ${charCount.toLocaleString()} characters`)
          
          return {
            text: extractedText.substring(0, 20000), // Limit to 20k
            fileName: `${identifier}.pdf`,
            charCount
          }
        }
      } else {
        console.log(`[Test] Response status: ${response.status}`)
      }
    } catch (error: any) {
      console.log(`[Test] Error: ${error.message}`)
      continue
    }
  }
  
  return null
}

async function test2PDFs() {
  console.log(`\n${'='.repeat(80)}`)
  console.log(`TESTING ARCHIVE.ORG PDF EXTRACTION (SIMPLIFIED)`)
  console.log(`${'='.repeat(80)}\n`)
  
  // Test with 2 archive.org URLs from Anna's Archive
  const testUrls = [
    {
      title: "Israel Rising: The Land of Israel Reawakens",
      url: "https://archive.org/details/israelrisingland0000doug"
    },
    {
      title: "Israel and the Clash of Civilizations",
      url: "https://archive.org/details/israelandclashof0000unse"
    }
  ]
  
  const results: Array<{
    title: string
    success: boolean
    charCount: number
    fileName?: string
    error?: string
  }> = []
  
  for (let i = 0; i < testUrls.length; i++) {
    const book = testUrls[i]
    console.log(`\n${'='.repeat(80)}`)
    console.log(`BOOK ${i + 1}/2: ${book.title}`)
    console.log(`${'='.repeat(80)}`)
    
    try {
      const result = await extractArchiveOrgPDF(book.url)
      
      if (result) {
        results.push({
          title: book.title,
          success: true,
          charCount: result.charCount,
          fileName: result.fileName
        })
        console.log(`\n✅ SUCCESS: Extracted ${result.charCount.toLocaleString()} characters`)
      } else {
        results.push({
          title: book.title,
          success: false,
          charCount: 0,
          error: 'Could not extract PDF'
        })
        console.log(`\n❌ FAILED: Could not extract PDF`)
      }
    } catch (error: any) {
      console.error(`\n❌ ERROR: ${error.message}`)
      results.push({
        title: book.title,
        success: false,
        charCount: 0,
        error: error.message
      })
    }
    
    if (i < testUrls.length - 1) {
      console.log(`\n⏳ Waiting 3 seconds before next extraction...`)
      await new Promise(resolve => setTimeout(resolve, 3000))
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
    console.log(`   Characters extracted: ${result.charCount.toLocaleString()}`)
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
    console.log()
  })
  
  if (successful.length === 2) {
    console.log(`\n✅ SUCCESS: Extracted text from 2 PDFs!`)
    console.log(`\nSummary:`)
    console.log(`  PDF 1: "${results[0].title}"`)
    console.log(`    - Characters: ${results[0].charCount.toLocaleString()}`)
    console.log(`    - File: ${results[0].fileName || 'N/A'}`)
    console.log(`\n  PDF 2: "${results[1].title}"`)
    console.log(`    - Characters: ${results[1].charCount.toLocaleString()}`)
    console.log(`    - File: ${results[1].fileName || 'N/A'}`)
  } else {
    console.log(`\n⚠️  Only extracted ${successful.length}/2 PDFs`)
  }
}

test2PDFs().catch(console.error)

