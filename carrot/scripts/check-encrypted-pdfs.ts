/**
 * Check which PDFs are encrypted
 */

import 'dotenv/config'
import * as fs from 'fs/promises'
import * as path from 'path'

// Polyfill DOMMatrix for pdf-parse
if (typeof global.DOMMatrix === 'undefined') {
  try {
    const dommatrix = require('dommatrix')
    const DOMMatrixClass = dommatrix.DOMMatrix || dommatrix.default?.DOMMatrix || dommatrix
    global.DOMMatrix = DOMMatrixClass
    globalThis.DOMMatrix = DOMMatrixClass
  } catch (e) {
    global.DOMMatrix = class DOMMatrix {
      constructor(init?: any) {}
      static fromMatrix(other?: any) { return new DOMMatrix() }
    } as any
  }
}

const pdfParseModule = require('pdf-parse')
const PDFParse = pdfParseModule.PDFParse || pdfParseModule

const pdfParse = async (buffer: Buffer): Promise<{ text: string }> => {
  if (typeof pdfParseModule === 'function') {
    return await pdfParseModule(buffer)
  } else if (typeof PDFParse === 'function') {
    const parser = new PDFParse({ data: buffer })
    const textResult = await parser.getText()
    return { text: textResult.text || '' }
  } else {
    throw new Error('pdf-parse: Unable to find PDFParse class or function')
  }
}

async function checkEncryptedPDFs() {
  console.log('='.repeat(80))
  console.log('CHECKING FOR ENCRYPTED PDFs')
  console.log('='.repeat(80))
  console.log()
  
  const pdfDir = path.join(process.cwd(), 'data', 'pdfs')
  const pdfFiles = await fs.readdir(pdfDir)
  
  console.log(`Found ${pdfFiles.length} PDF files\n`)
  
  const results: Array<{
    name: string
    size: number
    encrypted: boolean
    error?: string
    textLength?: number
  }> = []
  
  for (const pdfFile of pdfFiles) {
    const pdfPath = path.join(pdfDir, pdfFile)
    const stats = await fs.stat(pdfPath)
    
    console.log(`Checking: ${pdfFile} (${(stats.size / 1024 / 1024).toFixed(2)} MB)...`)
    
    try {
      const pdfBuffer = await fs.readFile(pdfPath)
      const pdfData = await pdfParse(pdfBuffer)
      const textLength = pdfData.text.trim().length
      
      results.push({
        name: pdfFile,
        size: stats.size,
        encrypted: false,
        textLength
      })
      
      console.log(`  ✅ Not encrypted - ${textLength} chars extracted\n`)
    } catch (error: any) {
      const isEncrypted = error.message?.toLowerCase().includes('encryption') || 
                         error.message?.toLowerCase().includes('encrypted') ||
                         error.message?.toLowerCase().includes('password')
      
      results.push({
        name: pdfFile,
        size: stats.size,
        encrypted: isEncrypted,
        error: error.message
      })
      
      if (isEncrypted) {
        console.log(`  🔒 ENCRYPTED - ${error.message}\n`)
      } else {
        console.log(`  ⚠️  Error (not encryption): ${error.message}\n`)
      }
    }
  }
  
  console.log('='.repeat(80))
  console.log('SUMMARY')
  console.log('='.repeat(80))
  console.log()
  
  const encrypted = results.filter(r => r.encrypted)
  const readable = results.filter(r => !r.encrypted)
  
  console.log(`Total PDFs: ${results.length}`)
  console.log(`✅ Readable: ${readable.length}`)
  console.log(`🔒 Encrypted: ${encrypted.length}`)
  console.log()
  
  if (encrypted.length > 0) {
    console.log('🔒 ENCRYPTED PDFs (for manual review):')
    console.log()
    encrypted.forEach((pdf, idx) => {
      console.log(`${idx + 1}. ${pdf.name}`)
      console.log(`   Size: ${(pdf.size / 1024 / 1024).toFixed(2)} MB`)
      console.log(`   Error: ${pdf.error}`)
      console.log()
    })
  }
  
  if (readable.length > 0) {
    console.log('✅ READABLE PDFs:')
    console.log()
    readable.forEach((pdf, idx) => {
      console.log(`${idx + 1}. ${pdf.name}`)
      console.log(`   Size: ${(pdf.size / 1024 / 1024).toFixed(2)} MB`)
      console.log(`   Text: ${pdf.textLength || 0} chars`)
      console.log()
    })
  }
}

checkEncryptedPDFs().catch(console.error)

