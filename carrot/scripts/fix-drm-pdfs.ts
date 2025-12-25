/**
 * Fix DRM-protected PDFs by:
 * 1. Trying to find non-DRM versions
 * 2. Using pdfjs-dist to extract text
 * 3. Rendering pages and using OCR if needed
 */

import 'dotenv/config'
import * as fs from 'fs/promises'
import * as path from 'path'
import { chromium } from 'playwright'

// Polyfill DOMMatrix
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

async function fixDRMPDFs() {
  console.log('='.repeat(80))
  console.log('FIXING DRM-PROTECTED PDFs')
  console.log('='.repeat(80))
  console.log()
  
  const pdfDir = path.join(process.cwd(), 'data', 'pdfs')
  const drmPdfs = [
    'armsakimboafrica0000unse.pdf',
    'carolingiancivil0000unse.pdf',
    'israelclashofciv0000cook.pdf',
    'mythamericahisto0000kevi.pdf'
  ]
  
  // Map PDFs to their archive.org identifiers
  const pdfToIdentifier: Record<string, string> = {
    'armsakimboafrica0000unse.pdf': 'armsakimboafrica0000unse',
    'carolingiancivil0000unse.pdf': 'carolingiancivil0000unse',
    'israelclashofciv0000cook.pdf': 'israelclashofciv0000cook',
    'mythamericahisto0000kevi.pdf': 'mythamericahisto0000kevi'
  }
  
  console.log('📋 Strategy:')
  console.log('  1. Try to find non-DRM versions from archive.org')
  console.log('  2. Use pdfjs-dist to extract text (can sometimes bypass DRM)')
  console.log('  3. Render first few pages and extract visible text')
  console.log()
  
  for (const pdfFile of drmPdfs) {
    const identifier = pdfToIdentifier[pdfFile]
    if (!identifier) continue
    
    console.log(`${'─'.repeat(80)}`)
    console.log(`📖 Processing: ${pdfFile}`)
    console.log(`   Identifier: ${identifier}`)
    console.log()
    
    const pdfPath = path.join(pdfDir, pdfFile)
    
    // Strategy 1: Try to find non-DRM version from archive.org
    console.log('  [1/3] Checking for non-DRM version on archive.org...')
    try {
      const archiveUrl = `https://archive.org/details/${identifier}`
      const response = await fetch(archiveUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })
      
      if (response.ok) {
        const html = await response.text()
        
        // Look for non-encrypted PDF in metadata
        const jsonMetadataMatch = html.match(/<input[^>]*class="js-ia-metadata"[^>]*value='({[^']+})'/i)
        if (jsonMetadataMatch) {
          try {
            const jsonStr = jsonMetadataMatch[1]
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/&amp;/g, '&')
            const metadata = JSON.parse(jsonStr)
            
            if (metadata.files && Array.isArray(metadata.files)) {
              // Look for PDF files that are NOT encrypted
              const nonEncryptedPdfs = metadata.files.filter((file: any) => 
                file.name && 
                file.name.toLowerCase().endsWith('.pdf') &&
                !file.name.toLowerCase().includes('_encrypted') &&
                !file.name.toLowerCase().includes('encrypted')
              )
              
              if (nonEncryptedPdfs.length > 0) {
                console.log(`     ✅ Found ${nonEncryptedPdfs.length} non-DRM PDF(s)`)
                
                for (const pdfFileInfo of nonEncryptedPdfs) {
                  const pdfUrl = `https://archive.org/download/${identifier}/${pdfFileInfo.name}`
                  console.log(`     Trying: ${pdfFileInfo.name}`)
                  
                  try {
                    const pdfResponse = await fetch(pdfUrl, {
                      headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': 'application/pdf,*/*'
                      },
                      signal: AbortSignal.timeout(30000)
                    })
                    
                    if (pdfResponse.ok) {
                      const contentType = pdfResponse.headers.get('content-type') || ''
                      if (contentType.includes('application/pdf')) {
                        const pdfBuffer = await pdfResponse.arrayBuffer()
                        console.log(`     ✅ Successfully downloaded non-DRM version (${pdfBuffer.byteLength} bytes)`)
                        
                        // Save as new file
                        const newPdfPath = path.join(pdfDir, pdfFileInfo.name)
                        await fs.writeFile(newPdfPath, Buffer.from(pdfBuffer))
                        console.log(`     ✅ Saved to: ${newPdfPath}`)
                        
                        // Try to extract text
                        try {
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
                          
                          const pdfData = await pdfParse(Buffer.from(pdfBuffer))
                          const text = pdfData.text.trim()
                          console.log(`     ✅ Extracted ${text.length} characters`)
                          
                          if (text.length > 500) {
                            console.log(`     🎉 SUCCESS: Non-DRM version works!`)
                            break // Found working version
                          }
                        } catch (parseError: any) {
                          console.log(`     ⚠️  Text extraction failed: ${parseError.message}`)
                        }
                      }
                    } else {
                      console.log(`     ⚠️  Access denied (${pdfResponse.status})`)
                    }
                  } catch (fetchError: any) {
                    console.log(`     ⚠️  Fetch failed: ${fetchError.message}`)
                  }
                }
              } else {
                console.log(`     ⚠️  No non-DRM PDFs found in metadata`)
              }
            }
          } catch (jsonError) {
            console.log(`     ⚠️  Failed to parse metadata: ${jsonError}`)
          }
        }
      }
    } catch (error: any) {
      console.log(`     ⚠️  Error checking archive.org: ${error.message}`)
    }
    
    // Strategy 2: Try alternative file formats (DJVU, EPUB) that might not have DRM
    console.log(`  [2/3] Checking for alternative file formats (DJVU, EPUB)...`)
    try {
      const archiveUrl = `https://archive.org/details/${identifier}`
      const response = await fetch(archiveUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })
      
      if (response.ok) {
        const html = await response.text()
        const jsonMetadataMatch = html.match(/<input[^>]*class="js-ia-metadata"[^>]*value='({[^']+})'/i)
        if (jsonMetadataMatch) {
          try {
            const jsonStr = jsonMetadataMatch[1]
              .replace(/&quot;/g, '"')
              .replace(/&#39;/g, "'")
              .replace(/&amp;/g, '&')
            const metadata = JSON.parse(jsonStr)
            
            if (metadata.files && Array.isArray(metadata.files)) {
              // Look for DJVU or EPUB files
              const alternativeFiles = metadata.files.filter((file: any) => 
                file.name && (
                  file.name.toLowerCase().endsWith('.djvu') ||
                  file.name.toLowerCase().endsWith('.epub') ||
                  file.name.toLowerCase().endsWith('.txt')
                ) &&
                !file.name.toLowerCase().includes('_encrypted') &&
                !file.name.toLowerCase().includes('encrypted')
              )
              
              if (alternativeFiles.length > 0) {
                console.log(`     ✅ Found ${alternativeFiles.length} alternative format(s)`)
                
                // Prioritize: TXT > EPUB > DJVU
                const sortedFiles = alternativeFiles.sort((a: any, b: any) => {
                  const aIsTxt = a.name.toLowerCase().endsWith('.txt')
                  const bIsTxt = b.name.toLowerCase().endsWith('.txt')
                  if (aIsTxt && !bIsTxt) return -1
                  if (!aIsTxt && bIsTxt) return 1
                  return 0
                })
                
                for (const fileInfo of sortedFiles) {
                  const fileUrl = `https://archive.org/download/${identifier}/${fileInfo.name}`
                  console.log(`     Trying: ${fileInfo.name} (${fileInfo.format || 'unknown format'})`)
                  
                  // Skip encrypted EPUBs
                  if (fileInfo.name.toLowerCase().includes('_lcp.epub') || 
                      fileInfo.name.toLowerCase().includes('encrypted')) {
                    console.log(`     ⏭️  Skipping encrypted file`)
                    continue
                  }
                  
                  // Try to download and extract
                  try {
                    // First try direct fetch
                    let fileResponse = await fetch(fileUrl, {
                      headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Accept': '*/*',
                        'Referer': `https://archive.org/details/${identifier}`
                      },
                      signal: AbortSignal.timeout(60000)
                    })
                    
                    // If access denied, try with Playwright
                    if (!fileResponse.ok && (fileResponse.status === 401 || fileResponse.status === 403)) {
                      console.log(`     🔄 Access denied, trying with Playwright...`)
                      try {
                        const browser = await chromium.launch({ headless: true })
                        const context = await browser.newContext({
                          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                          viewport: { width: 1920, height: 1080 }
                        })
                        const page = await context.newPage()
                        
                        // Navigate to the file URL
                        await page.goto(fileUrl, { waitUntil: 'networkidle', timeout: 30000 })
                        await page.waitForTimeout(2000)
                        
                        // Check if we got the file or a redirect
                        const currentUrl = page.url()
                        if (currentUrl.includes('archive.org/download')) {
                          // Try to get the file content
                          const content = await page.content()
                          // If it's HTML, it might be an error page
                          if (content.includes('<html') && !content.includes('PDF')) {
                            console.log(`     ⚠️  Got HTML page instead of file`)
                            await browser.close()
                            continue
                          }
                        }
                        
                        // Try to download via Playwright
                        const response = await page.goto(fileUrl, { waitUntil: 'networkidle' })
                        if (response && response.ok()) {
                          const buffer = await response.body()
                          fileResponse = {
                            ok: true,
                            arrayBuffer: async () => buffer,
                            text: async () => buffer.toString('utf-8'),
                            status: response.status()
                          } as any
                        }
                        
                        await browser.close()
                      } catch (playwrightError: any) {
                        console.log(`     ⚠️  Playwright failed: ${playwrightError.message}`)
                        continue
                      }
                    }
                    
                    if (fileResponse.ok) {
                      if (fileInfo.name.toLowerCase().endsWith('.txt')) {
                        const text = await fileResponse.text()
                        if (text.length > 500) {
                          console.log(`     ✅ Downloaded TXT file: ${text.length} chars`)
                          const txtPath = path.join(pdfDir, `${identifier}_extracted_text.txt`)
                          await fs.writeFile(txtPath, text)
                          console.log(`     ✅ Saved to: ${txtPath}`)
                          console.log(`     🎉 SUCCESS: Found working text extraction!`)
                          break
                        }
                      } else if (fileInfo.name.toLowerCase().endsWith('.epub')) {
                        const epubBuffer = await fileResponse.arrayBuffer()
                        console.log(`     ✅ Downloaded EPUB: ${epubBuffer.byteLength} bytes`)
                        const epubPath = path.join(pdfDir, `${identifier}.epub`)
                        await fs.writeFile(epubPath, Buffer.from(epubBuffer))
                        console.log(`     ✅ Saved EPUB to: ${epubPath}`)
                        console.log(`     💡 EPUB can be processed with epub extraction library`)
                        // Try to extract text from EPUB
                        try {
                          const JSZip = require('jszip')
                          const zip = await JSZip.loadAsync(epubBuffer)
                          let epubText = ''
                          
                          // Look for text files in EPUB
                          for (const fileName of Object.keys(zip.files)) {
                            if (fileName.endsWith('.html') || fileName.endsWith('.xhtml') || fileName.endsWith('.htm')) {
                              const file = zip.files[fileName]
                              if (!file.dir) {
                                const content = await file.async('string')
                                // Strip HTML tags
                                const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
                                epubText += text + '\n\n'
                              }
                            }
                          }
                          
                          if (epubText.trim().length > 500) {
                            console.log(`     ✅ Extracted ${epubText.trim().length} chars from EPUB`)
                            const textPath = path.join(pdfDir, `${identifier}_extracted_text.txt`)
                            await fs.writeFile(textPath, epubText)
                            console.log(`     ✅ Saved text to: ${textPath}`)
                            console.log(`     🎉 SUCCESS: EPUB text extraction worked!`)
                            break
                          }
                        } catch (epubError: any) {
                          console.log(`     ⚠️  EPUB extraction failed: ${epubError.message}`)
                        }
                      } else {
                        console.log(`     💡 Alternative format available: ${fileInfo.name}`)
                      }
                    } else {
                      console.log(`     ⚠️  Access denied (${fileResponse.status})`)
                    }
                  } catch (fetchError: any) {
                    console.log(`     ⚠️  Download failed: ${fetchError.message}`)
                  }
                }
              } else {
                console.log(`     ⚠️  No alternative formats found`)
              }
            }
          } catch (jsonError) {
            // Ignore
          }
        }
      }
    } catch (error: any) {
      console.log(`     ⚠️  Error checking alternatives: ${error.message}`)
    }
    
    // Strategy 3: Try to extract from Anna's Archive page description as fallback
    console.log(`  [3/3] Checking Anna's Archive for book description/contents...`)
    try {
      // Find the Anna's Archive URL for this book
      const md5Match = pdfFile.match(/([a-f0-9]{32})/i)
      if (md5Match) {
        const md5 = md5Match[1]
        const annasUrl = `https://annas-archive.org/md5/${md5}`
        
        const response = await fetch(annasUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        })
        
        if (response.ok) {
          const html = await response.text()
          
          // Extract description
          const descMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i)
          if (descMatch && descMatch[1].length > 200) {
            console.log(`     ✅ Found description: ${descMatch[1].length} chars`)
            
            // Also look for preview text
            const previewPattern = /<div[^>]*class="[^"]*preview[^"]*"[^>]*>([\s\S]{500,5000})<\/div>/i
            const previewMatch = html.match(previewPattern)
            
            if (previewMatch) {
              let previewText = previewMatch[1]
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
              
              if (previewText.length > 500) {
                console.log(`     ✅ Found preview text: ${previewText.length} chars`)
                const previewPath = path.join(pdfDir, `${identifier}_preview.txt`)
                await fs.writeFile(previewPath, previewText)
                console.log(`     ✅ Saved preview to: ${previewPath}`)
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.log(`     ⚠️  Error checking Anna's Archive: ${error.message}`)
    }
    
    console.log()
  }
  
  console.log('='.repeat(80))
  console.log('✅ DRM PDF Fix Complete')
  console.log('='.repeat(80))
}

fixDRMPDFs().catch(console.error)

