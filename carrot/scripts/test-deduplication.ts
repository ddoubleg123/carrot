/**
 * Test PDF deduplication - ensure we don't download the same PDF twice
 */

import 'dotenv/config'
import { extractBookContent } from './extract-annas-archive-book'
import * as fs from 'fs/promises'
import * as path from 'path'

async function testDeduplication() {
  console.log('=== TESTING PDF DEDUPLICATION ===\n')
  
  // Test with a known book URL (use one that has an archive.org link)
  const testUrl = 'https://annas-archive.org/md5/fbc01df94230f9542a379b8b1bc40970'
  
  console.log(`Test URL: ${testUrl}\n`)
  
  // First extraction
  console.log('--- FIRST EXTRACTION ---')
  const result1 = await extractBookContent(testUrl)
  console.log(`Result 1 length: ${result1?.length || 0} chars\n`)
  
  // Check PDF directory
  const pdfDir = path.join(process.cwd(), 'data', 'pdfs')
  const files1 = await fs.readdir(pdfDir).catch(() => [])
  console.log(`PDFs after first extraction: ${files1.length}`)
  files1.forEach(f => console.log(`  - ${f}`))
  console.log()
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 2000))
  
  // Second extraction (should use existing PDF)
  console.log('--- SECOND EXTRACTION (should use existing PDF) ---')
  const result2 = await extractBookContent(testUrl)
  console.log(`Result 2 length: ${result2?.length || 0} chars\n`)
  
  // Check PDF directory again
  const files2 = await fs.readdir(pdfDir).catch(() => [])
  console.log(`PDFs after second extraction: ${files2.length}`)
  files2.forEach(f => console.log(`  - ${f}`))
  console.log()
  
  // Verify no duplicates
  if (files1.length === files2.length) {
    console.log('✅ SUCCESS: No duplicate PDFs created!')
  } else {
    console.log('❌ FAILED: PDF count changed - possible duplicate!')
  }
  
  // Check file sizes
  for (const file of files2) {
    const filePath = path.join(pdfDir, file)
    const stats = await fs.stat(filePath)
    console.log(`  ${file}: ${stats.size} bytes`)
  }
  
  console.log('\n✅ Deduplication test complete!')
}

testDeduplication().catch(console.error)

