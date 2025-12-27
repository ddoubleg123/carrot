/**
 * Extract and save a full book from Anna's Archive
 * This script searches, selects a book, and extracts its content
 */

// Polyfill DOMMatrix for pdf-parse BEFORE importing it
// pdf-parse requires DOMMatrix to be globally available during module load
if (typeof global.DOMMatrix === 'undefined' && typeof globalThis.DOMMatrix === 'undefined') {
  // Minimal polyfill - don't require dommatrix at build time to avoid Next.js build errors
  // The polyfill will be sufficient for pdf-parse
  const DOMMatrixPolyfill = class DOMMatrix {
    constructor(init?: any) {}
    static fromMatrix(other?: any) { return new DOMMatrix() }
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0
    multiply(other?: any) { return new DOMMatrix() }
    translate(x?: number, y?: number) { return new DOMMatrix() }
    scale(x?: number, y?: number) { return new DOMMatrix() }
    rotate(angle?: number) { return new DOMMatrix() }
  } as any
  global.DOMMatrix = DOMMatrixPolyfill
  globalThis.DOMMatrix = DOMMatrixPolyfill
  ;(global as any).DOMMatrix = DOMMatrixPolyfill
  
  // Try to load dommatrix at runtime if available (but don't fail if it's not)
  if (typeof require !== 'undefined') {
    try {
      const dommatrix = require('dommatrix')
      if (dommatrix?.DOMMatrix) {
        const DOMMatrixClass = dommatrix.DOMMatrix || dommatrix.default?.DOMMatrix
        if (DOMMatrixClass) {
          global.DOMMatrix = DOMMatrixClass
          globalThis.DOMMatrix = DOMMatrixClass
          ;(global as any).DOMMatrix = DOMMatrixClass
        }
      }
    } catch (e) {
      // dommatrix not available, use polyfill above
    }
  }
}

import { searchAnnasArchive, getAnnasArchivePreview } from '../src/lib/discovery/annasArchiveSource'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs/promises'
import * as path from 'path'
// Use playwright-extra (stealth plugin removed due to compatibility issues)
// We'll rely on improved fingerprinting instead
const playwright = require('playwright-extra')
const { chromium } = playwright

// Import pdf-parse (CommonJS module) - must be after DOMMatrix polyfill
// pdf-parse v2.4.5 exports a PDFParse class, create a wrapper function for compatibility
const pdfParseModule = require('pdf-parse')
const PDFParse = pdfParseModule.PDFParse || pdfParseModule

// Create a function wrapper that uses the PDFParse class API
// This maintains compatibility with code expecting pdfParse(buffer) -> { text: string }
const pdfParse = async (buffer: Buffer): Promise<{ text: string }> => {
  if (typeof pdfParseModule === 'function') {
    // Older version: direct function call
    return await pdfParseModule(buffer)
  } else if (typeof PDFParse === 'function') {
    // Newer version: use PDFParse class
    const parser = new PDFParse({ data: buffer })
    const textResult = await parser.getText()
    return { text: textResult.text || '' }
  } else {
    throw new Error('pdf-parse: Unable to find PDFParse class or function')
  }
}

const prisma = new PrismaClient()

interface BookContent {
  title: string
  author?: string
  year?: number
  url: string
  preview?: string
  metadata: {
    isbn?: string
    fileType?: string
    source?: string
  }
  fullContent?: string
}

export async function extractBookContent(bookUrl: string): Promise<string | null> {
  console.log(`\n[Extract] Fetching book page: ${bookUrl}`)
  
  try {
    // First, check if we already have this book in the database
    // Wrap in try/catch to handle database connection errors gracefully
    let existingContent = null
    try {
      existingContent = await prisma.discoveredContent.findFirst({
        where: {
          OR: [
            { sourceUrl: bookUrl },
            { 
              metadata: {
                path: ['annasArchiveUrl'],
                equals: bookUrl
              }
            }
          ]
        },
        select: {
          id: true,
          title: true,
          textContent: true,
          content: true,
          sourceUrl: true
        }
      })
    } catch (dbError: any) {
      // Database connection error - log but continue with extraction
      if (dbError.message?.includes('connection') || dbError.message?.includes('Can\'t reach database')) {
        console.log(`[Extract] ⚠️  Database connection unavailable - continuing without deduplication check`)
      } else {
        console.log(`[Extract] ⚠️  Database query error: ${dbError.message} - continuing anyway`)
      }
      // Continue with extraction even if database check fails
    }
    
    if (existingContent) {
      console.log(`[Extract] ✅ Book already exists in database: "${existingContent.title}" (ID: ${existingContent.id})`)
      
      // If we have text content, return it
      if (existingContent.textContent && existingContent.textContent.length > 500) {
        console.log(`[Extract] Returning existing text content (${existingContent.textContent.length} chars)`)
        return existingContent.textContent.substring(0, 20000)
      } else if (existingContent.content && existingContent.content.length > 500) {
        console.log(`[Extract] Returning existing content (${existingContent.content.length} chars)`)
        return existingContent.content.substring(0, 20000)
      } else {
        console.log(`[Extract] Book exists but has no extractable text content, skipping...`)
        return null
      }
    }
    
    // Check if we have a PDF file for this book (by extracting identifier from URL)
    const md5Match = bookUrl.match(/\/md5\/([a-f0-9]{32})/i)
    if (md5Match) {
      const md5 = md5Match[1]
      // We'll check for PDFs when we get the archive.org identifier
    }
    
    // Add delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    const response = await fetch(bookUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://annas-archive.org/'
      },
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      console.error(`[Extract] HTTP ${response.status}: ${response.statusText}`)
      return null
    }

    const html = await response.text()
    console.log(`[Extract] Fetched ${html.length} characters`)
    
    // Step 1: Look for download links - "slow downloads" and partner servers
    console.log(`[Extract] Looking for download links...`)
    
    // Find "slow downloads" section
    const slowDownloadsMatch = html.match(/slow downloads[\s\S]{0,5000}/i)
    if (slowDownloadsMatch) {
      console.log(`[Extract] Found "slow downloads" section`)
      
      // Look for partner server links (#1, #2, #3, etc.)
      const partnerServerPattern = /(?:slow partner server|partner server)\s*#?(\d+)[\s\S]{0,500}href="([^"]+)"/gi
      const downloadLinks: Array<{ server: string; url: string }> = []
      
      let match
      while ((match = partnerServerPattern.exec(slowDownloadsMatch[0])) !== null) {
        const serverNum = match[1]
        let url = match[2]
        
        // Make URL absolute if relative
        if (url.startsWith('/')) {
          url = `https://annas-archive.org${url}`
        } else if (!url.startsWith('http')) {
          url = `https://annas-archive.org/${url}`
        }
        
        downloadLinks.push({
          server: `Server #${serverNum}`,
          url: url
        })
        console.log(`[Extract] Found ${serverNum}: ${url}`)
      }
      
      // Look for "view" links or browser-based viewing options
      const viewPattern = /href="([^"]*\/view[^"]*)"[^>]*>/gi
      while ((match = viewPattern.exec(html)) !== null) {
        let url = match[1]
        if (url.startsWith('/')) {
          url = `https://annas-archive.org${url}`
        }
        
        if (!downloadLinks.some(link => link.url === url)) {
          downloadLinks.push({
            server: 'View',
            url: url
          })
          console.log(`[Extract] Found view link: ${url}`)
        }
      }
      
      // Look for archive.org links (these are often more accessible)
      const archiveOrgPattern = /href="(https?:\/\/archive\.org\/[^"]+)"/gi
      while ((match = archiveOrgPattern.exec(html)) !== null) {
        const url = match[1]
        if (!downloadLinks.some(link => link.url === url)) {
          downloadLinks.push({
            server: 'Archive.org',
            url: url
          })
          console.log(`[Extract] Found archive.org link: ${url}`)
        }
      }
      
      // Look for external download links (might be in JavaScript or data attributes)
      const externalPattern = /(?:external|direct|mirror)[\s\S]{0,500}href="([^"]+)"/gi
      while ((match = externalPattern.exec(slowDownloadsMatch[0])) !== null) {
        let url = match[1]
        if (url.startsWith('/')) {
          url = `https://annas-archive.org${url}`
        } else if (!url.startsWith('http')) {
          continue // Skip relative URLs that aren't absolute
        }
        
        if (!downloadLinks.some(link => link.url === url)) {
          downloadLinks.push({
            server: 'External',
            url: url
          })
          console.log(`[Extract] Found external link: ${url}`)
        }
      }
      
      // Prioritize archive.org links as they're more accessible
      downloadLinks.sort((a, b) => {
        if (a.server === 'Archive.org') return -1
        if (b.server === 'Archive.org') return 1
        return 0
      })
      
      // Try to access download links to get book content
      // Try multiple links in case some are blocked
      for (let i = 0; i < Math.min(downloadLinks.length, 5); i++) {
        const downloadLink = downloadLinks[i]
        console.log(`[Extract] Attempting download link ${i + 1}/${Math.min(downloadLinks.length, 5)}: ${downloadLink.server} - ${downloadLink.url}`)
        
        try {
          // Add delay before accessing download link
          await new Promise(resolve => setTimeout(resolve, 2000))
          
          // For archive.org links, try to get the PDF directly
          if (downloadLink.url.includes('archive.org/details/')) {
            // Extract identifier from URL: https://archive.org/details/{identifier}
            const identifierMatch = downloadLink.url.match(/\/details\/([^\/]+)/)
            if (identifierMatch) {
              const identifier = identifierMatch[1]
              console.log(`[Extract] Archive.org identifier: ${identifier}`)
              
              // FALLBACK STRATEGY 1: Try multiple archive.org PDF URL patterns
              const pdfUrlPatterns = [
                // Pattern 1: Standard download URL
                `https://archive.org/download/${identifier}/${identifier}.pdf`,
                // Pattern 2: With underscores
                `https://archive.org/download/${identifier}/${identifier.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`,
                // Pattern 3: Try with different extensions
                `https://archive.org/download/${identifier}/${identifier}.djvu`,
                // Pattern 4: Try accessing the details page to scrape actual file links
                downloadLink.url // We'll scrape this page
              ]
              
              let pdfFound = false
              let pdfBuffer: ArrayBuffer | null = null
              let finalPdfUrl: string | null = null
              
              // Try each pattern
              for (let patternIdx = 0; patternIdx < pdfUrlPatterns.length && !pdfFound; patternIdx++) {
                const testUrl = pdfUrlPatterns[patternIdx]
                console.log(`[Extract] Trying archive.org pattern ${patternIdx + 1}/${pdfUrlPatterns.length}: ${testUrl}`)
                
                try {
                  await new Promise(resolve => setTimeout(resolve, 2000))
                  
                  // If it's the details page, scrape it for file links
                  if (testUrl === downloadLink.url) {
                    console.log(`[Extract] Scraping archive.org page for file links...`)
                    const archivePageResponse = await fetch(testUrl, {
                      headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Referer': 'https://annas-archive.org/'
                      },
                      redirect: 'follow',
                      signal: AbortSignal.timeout(30000)
                    })
                    
                    if (archivePageResponse.ok) {
                      const archiveHtml = await archivePageResponse.text()
                      console.log(`[Extract] Fetched archive.org page: ${archiveHtml.length} chars`)
                      
                      // Strategy 1: Parse JSON metadata from hidden input field
                      // Archive.org embeds file metadata in a hidden input with class "js-ia-metadata"
                      const jsonMetadataMatch = archiveHtml.match(/<input[^>]*class="js-ia-metadata"[^>]*value='({[^']+})'/i)
                      if (jsonMetadataMatch) {
                        try {
                          // Unescape HTML entities in the JSON
                          const jsonStr = jsonMetadataMatch[1]
                            .replace(/&quot;/g, '"')
                            .replace(/&#39;/g, "'")
                            .replace(/&amp;/g, '&')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                          const metadata = JSON.parse(jsonStr)
                          
                          if (metadata.files && Array.isArray(metadata.files)) {
                            console.log(`[Extract] Found ${metadata.files.length} files in metadata`)
                            
                            // Look for PDF files
                            const pdfFiles = metadata.files.filter((file: any) => 
                              file.name && file.name.toLowerCase().endsWith('.pdf') &&
                              (file.format === 'Text PDF' || file.format === 'PDF' || file.name.includes('.pdf'))
                            )
                            
                            if (pdfFiles.length > 0) {
                              console.log(`[Extract] Found ${pdfFiles.length} PDF file(s) in metadata`)
                              
                              // Try each PDF file
                              for (const pdfFile of pdfFiles) {
                                const pdfFileName = pdfFile.name
                                const pdfUrl = `https://archive.org/download/${identifier}/${pdfFileName}`
                                console.log(`[Extract] Trying PDF from metadata: ${pdfUrl}`)
                                
                                try {
                                  await new Promise(resolve => setTimeout(resolve, 2000))
                                  const pdfResponse = await fetch(pdfUrl, {
                                    headers: {
                                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                      'Accept': 'application/pdf,*/*',
                                      'Referer': downloadLink.url
                                    },
                                    redirect: 'follow',
                                    signal: AbortSignal.timeout(60000)
                                  })
                                  
                                  if (pdfResponse.ok) {
                                    const contentType = pdfResponse.headers.get('content-type') || ''
                                    if (contentType.includes('application/pdf')) {
                                      pdfBuffer = await pdfResponse.arrayBuffer()
                                      finalPdfUrl = pdfUrl
                                      pdfFound = true
                                      console.log(`[Extract] ✅ Successfully accessed PDF from metadata (${pdfBuffer.byteLength} bytes)`)
                                      break
                                    }
                                  } else {
                                    console.log(`[Extract] PDF access returned ${pdfResponse.status}`)
                                  }
                                } catch (fetchError: any) {
                                  console.log(`[Extract] Failed to fetch PDF from metadata: ${fetchError.message}`)
                                  continue
                                }
                              }
                            }
                          }
                        } catch (jsonError: any) {
                          console.log(`[Extract] Failed to parse JSON metadata: ${jsonError.message}`)
                        }
                      }
                      
                      // Strategy 2: Look for PDF download links in the HTML (fallback)
                      if (!pdfFound) {
                        const pdfLinkPatterns = [
                          /href="([^"]*\/download\/[^"]*\.pdf[^"]*)"/gi,
                          /href="([^"]*\/[^"]*\.pdf[^"]*)"/gi,
                          /data-file="([^"]*\.pdf[^"]*)"/gi,
                          /downloadUrl['"]?\s*[:=]\s*['"]([^'"]*\.pdf[^'"]*)['"]/gi
                        ]
                        
                        const foundPdfUrls: string[] = []
                        for (const pattern of pdfLinkPatterns) {
                          const matches = [...archiveHtml.matchAll(pattern)]
                          for (const match of matches) {
                            let url = match[1]
                            if (url && !url.startsWith('http')) {
                              if (url.startsWith('/')) {
                                url = `https://archive.org${url}`
                              } else {
                                url = `https://archive.org/download/${identifier}/${url}`
                              }
                            }
                            if (url && url.includes('.pdf') && !foundPdfUrls.includes(url)) {
                              foundPdfUrls.push(url)
                              console.log(`[Extract] Found PDF link on page: ${url}`)
                            }
                          }
                        }
                        
                        // Try the found PDF URLs
                        for (const pdfUrl of foundPdfUrls) {
                          try {
                            await new Promise(resolve => setTimeout(resolve, 2000))
                            const pdfResponse = await fetch(pdfUrl, {
                              headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                'Accept': 'application/pdf,*/*',
                                'Referer': downloadLink.url
                              },
                              redirect: 'follow',
                              signal: AbortSignal.timeout(60000)
                            })
                            
                            if (pdfResponse.ok) {
                              const contentType = pdfResponse.headers.get('content-type') || ''
                              if (contentType.includes('application/pdf')) {
                                pdfBuffer = await pdfResponse.arrayBuffer()
                                finalPdfUrl = pdfUrl
                                pdfFound = true
                                console.log(`[Extract] ✅ Successfully accessed PDF from scraped link (${pdfBuffer.byteLength} bytes)`)
                                break
                              }
                            }
                          } catch (fetchError: any) {
                            console.log(`[Extract] Failed to fetch scraped PDF link: ${fetchError.message}`)
                            continue
                          }
                        }
                      }
                    }
                  } else {
                    // Check if PDF already exists BEFORE fetching (if we have identifier)
                    const dataDir = path.join(process.cwd(), 'data', 'pdfs')
                    await fs.mkdir(dataDir, { recursive: true })
                    const pdfPath = path.join(dataDir, `${identifier}.pdf`)
                    
                    let shouldDownload = true
                    try {
                      const existingStats = await fs.stat(pdfPath)
                      if (existingStats.size > 0) {
                        // File exists - check if we can get size from HEAD request first
                        try {
                          const headResponse = await fetch(testUrl, {
                            method: 'HEAD',
                            headers: {
                              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                              'Accept': 'application/pdf,*/*',
                              'Referer': downloadLink.url
                            },
                            redirect: 'follow',
                            signal: AbortSignal.timeout(10000)
                          })
                          
                          const contentLength = headResponse.headers.get('content-length')
                          if (contentLength && parseInt(contentLength) === existingStats.size) {
                            console.log(`[Extract] ✅ PDF already exists with same size (${existingStats.size} bytes), extracting text from existing file...`)
                            shouldDownload = false
                            
                            // Extract text from existing PDF
                            try {
                              const existingPdfBuffer = await fs.readFile(pdfPath)
                              const pdfData = await pdfParse(existingPdfBuffer)
                              const extractedText = pdfData.text.trim()
                              console.log(`[Extract] ✅ Extracted ${extractedText.length} characters from existing PDF`)
                              if (extractedText.length > 500) {
                                return extractedText.substring(0, 20000)
                              }
                              return extractedText || `[PDF file already exists - ${existingStats.size} bytes. Text extraction yielded ${extractedText.length} characters. URL: ${testUrl}]`
                            } catch (pdfError: any) {
                              console.error(`[Extract] Error extracting text from existing PDF: ${pdfError.message}`)
                              return `[PDF file already exists - ${existingStats.size} bytes. Path: ${pdfPath}. URL: ${testUrl}. Text extraction failed: ${pdfError.message}]`
                            }
                          }
                        } catch (headError) {
                          // HEAD request failed, proceed with GET
                        }
                      }
                    } catch (error) {
                      // File doesn't exist, proceed with download
                    }
                    
                    if (shouldDownload) {
                      // Try direct fetch
                      const pdfResponse = await fetch(testUrl, {
                        headers: {
                          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                          'Accept': 'application/pdf,*/*',
                          'Referer': downloadLink.url
                        },
                        redirect: 'follow',
                        signal: AbortSignal.timeout(60000)
                      })
                      
                      if (pdfResponse.ok) {
                        const contentType = pdfResponse.headers.get('content-type') || ''
                        if (contentType.includes('application/pdf') || testUrl.endsWith('.pdf')) {
                          pdfBuffer = await pdfResponse.arrayBuffer()
                          finalPdfUrl = testUrl
                          pdfFound = true
                          console.log(`[Extract] ✅ Successfully accessed PDF (${pdfBuffer.byteLength} bytes)`)
                          break
                        }
                      } else if (pdfResponse.status === 403 || pdfResponse.status === 401) {
                        console.log(`[Extract] Access denied (${pdfResponse.status}), trying next pattern...`)
                      }
                    }
                  }
                } catch (patternError: any) {
                  console.log(`[Extract] Pattern ${patternIdx + 1} failed: ${patternError.message}`)
                  continue
                }
              }
              
              if (pdfFound && pdfBuffer && finalPdfUrl) {
                // Check if PDF already exists BEFORE downloading
                const dataDir = path.join(process.cwd(), 'data', 'pdfs')
                await fs.mkdir(dataDir, { recursive: true })
                const pdfPath = path.join(dataDir, `${identifier}.pdf`)
                
                // Check if file already exists and has the same size
                let pdfExists = false
                try {
                  const existingStats = await fs.stat(pdfPath)
                  const expectedSize = pdfBuffer.byteLength
                  
                  if (existingStats.size === expectedSize) {
                    console.log(`[Extract] ✅ PDF already exists with same size (${existingStats.size} bytes), extracting text from existing file...`)
                    pdfExists = true
                    // Extract text from existing PDF
                    try {
                      const existingPdfBuffer = await fs.readFile(pdfPath)
                      const pdfData = await pdfParse(existingPdfBuffer)
                      const extractedText = pdfData.text.trim()
                      console.log(`[Extract] ✅ Extracted ${extractedText.length} characters from existing PDF`)
                      if (extractedText.length > 500) {
                        return extractedText.substring(0, 20000)
                      }
                      return extractedText || `[PDF file already exists - ${existingStats.size} bytes. Text extraction yielded ${extractedText.length} characters. URL: ${finalPdfUrl}]`
                    } catch (pdfError: any) {
                      const isDRM = pdfError.message?.toLowerCase().includes('encryption') || 
                                   pdfError.message?.toLowerCase().includes('drm') ||
                                   pdfError.message?.toLowerCase().includes('digital rights')
                      
                      if (isDRM) {
                        console.error(`[Extract] ⚠️  PDF is DRM-protected (requires Adobe Digital Editions): ${pdfError.message}`)
                        console.log(`[Extract] 🔄 DRM detected from existing file - continuing to try other download sources...`)
                        // Set flag to continue to next download link instead of returning
                        pdfExists = false // Reset flag so we try other sources
                        break // Break out of this archive.org attempt, continue to next download link
                      } else {
                        console.error(`[Extract] Error extracting text from existing PDF: ${pdfError.message}`)
                        return `[PDF file already exists - ${existingStats.size} bytes. Path: ${pdfPath}. URL: ${finalPdfUrl}. Text extraction failed: ${pdfError.message}]`
                      }
                    }
                  } else if (existingStats.size > 0) {
                    console.log(`[Extract] PDF exists but size differs (existing: ${existingStats.size}, expected: ${pdfBuffer.byteLength}), re-downloading...`)
                  }
                } catch (error) {
                  // File doesn't exist, proceed with download
                  console.log(`[Extract] PDF doesn't exist yet, downloading...`)
                }
                
                if (!pdfExists) {
                  // Save PDF to file and extract text
                  await fs.writeFile(pdfPath, Buffer.from(pdfBuffer))
                  console.log(`[Extract] Saved PDF to: ${pdfPath}`)
                  
                  // Extract text from PDF
                  try {
                    console.log(`[Extract] Extracting text from PDF...`)
                    const pdfData = await pdfParse(Buffer.from(pdfBuffer))
                    const extractedText = pdfData.text.trim()
                    console.log(`[Extract] ✅ Extracted ${extractedText.length} characters from PDF`)
                    
                    if (extractedText.length > 500) {
                      return extractedText.substring(0, 20000)
                    }
                    return extractedText || `[PDF file downloaded - ${pdfBuffer.byteLength} bytes. Text extraction yielded ${extractedText.length} characters. URL: ${finalPdfUrl}]`
                  } catch (pdfError: any) {
                    const isDRM = pdfError.message?.toLowerCase().includes('encryption') || 
                                 pdfError.message?.toLowerCase().includes('drm') ||
                                 pdfError.message?.toLowerCase().includes('digital rights')
                    
                    if (isDRM) {
                      console.error(`[Extract] ⚠️  PDF is DRM-protected (requires Adobe Digital Editions): ${pdfError.message}`)
                      console.log(`[Extract] 🔄 DRM detected - continuing to try other download sources...`)
                      // Continue to next download link instead of returning
                      // This allows slow downloads to be tried, which may have non-DRM versions
                      continue
                    } else {
                      console.error(`[Extract] Error extracting text from PDF: ${pdfError.message}`)
                      return `[PDF file successfully downloaded from archive.org - ${pdfBuffer.byteLength} bytes. Saved to: ${pdfPath}. URL: ${finalPdfUrl}. Text extraction failed: ${pdfError.message}]`
                    }
                  }
                }
              } else {
                console.log(`[Extract] All archive.org patterns failed, trying page scrape as fallback...`)
              
                // Fallback: Fetch the page and look for download links
                const archivePageResponse = await fetch(downloadLink.url, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5'
                  },
                  redirect: 'follow',
                  signal: AbortSignal.timeout(30000)
                })
                
                if (archivePageResponse.ok) {
                  const archiveHtml = await archivePageResponse.text()
                  console.log(`[Extract] Fetched archive.org page: ${archiveHtml.length} chars`)
                  
                  // Strategy 1: Parse JSON metadata from hidden input field
                  const jsonMetadataMatch = archiveHtml.match(/<input[^>]*class="js-ia-metadata"[^>]*value='({[^']+})'/i)
                  if (jsonMetadataMatch) {
                    try {
                      const jsonStr = jsonMetadataMatch[1]
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'")
                        .replace(/&amp;/g, '&')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                      const metadata = JSON.parse(jsonStr)
                      
                      if (metadata.files && Array.isArray(metadata.files)) {
                        console.log(`[Extract] Found ${metadata.files.length} files in metadata`)
                        
                        // Look for PDF files - prioritize non-encrypted ones
                        const allPdfFiles = metadata.files.filter((file: any) => 
                          file.name && file.name.toLowerCase().endsWith('.pdf') &&
                          (file.format === 'Text PDF' || file.format === 'PDF' || file.name.includes('.pdf'))
                        )
                        
                        // Sort: non-encrypted PDFs first, then encrypted ones
                        const pdfFiles = allPdfFiles.sort((a: any, b: any) => {
                          const aEncrypted = a.name.toLowerCase().includes('_encrypted') || a.name.toLowerCase().includes('encrypted')
                          const bEncrypted = b.name.toLowerCase().includes('_encrypted') || b.name.toLowerCase().includes('encrypted')
                          if (aEncrypted && !bEncrypted) return 1  // Encrypted goes last
                          if (!aEncrypted && bEncrypted) return -1  // Non-encrypted goes first
                          return 0
                        })
                        
                        if (pdfFiles.length > 0) {
                          const nonEncrypted = pdfFiles.filter((f: any) => 
                            !f.name.toLowerCase().includes('_encrypted') && !f.name.toLowerCase().includes('encrypted')
                          )
                          console.log(`[Extract] Found ${pdfFiles.length} PDF file(s) in metadata (${nonEncrypted.length} non-encrypted, ${pdfFiles.length - nonEncrypted.length} encrypted)`)
                          
                          // Try each PDF file (non-encrypted first)
                          for (const pdfFile of pdfFiles) {
                            const pdfFileName = pdfFile.name
                            const pdfUrl = `https://archive.org/download/${identifier}/${pdfFileName}`
                            console.log(`[Extract] Trying PDF from metadata: ${pdfUrl}`)
                            
                            try {
                              await new Promise(resolve => setTimeout(resolve, 2000))
                              const pdfResponse = await fetch(pdfUrl, {
                                headers: {
                                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                                  'Accept': 'application/pdf,*/*',
                                  'Referer': downloadLink.url
                                },
                                redirect: 'follow',
                                signal: AbortSignal.timeout(60000)
                              })
                              
                              if (pdfResponse.ok) {
                                const contentType = pdfResponse.headers.get('content-type') || ''
                                if (contentType.includes('application/pdf')) {
                                  const contentLength = pdfResponse.headers.get('content-length') || 'unknown'
                                  console.log(`[Extract] ✅ Successfully accessed PDF from metadata (${contentLength} bytes)`)
                                  
                                  // Check if PDF already exists
                                  const dataDir = path.join(process.cwd(), 'data', 'pdfs')
                                  await fs.mkdir(dataDir, { recursive: true })
                                  const pdfPath = path.join(dataDir, `${identifier}.pdf`)
                                  
                                  // Check if file already exists and has the same size
                                  let pdfExists = false
                                  try {
                                    const existingStats = await fs.stat(pdfPath)
                                    const expectedSize = contentLength !== 'unknown' ? parseInt(contentLength) : null
                                    
                                    if (expectedSize && existingStats.size === expectedSize) {
                                      console.log(`[Extract] PDF already exists with same size (${existingStats.size} bytes), skipping download`)
                                      pdfExists = true
                                      // Extract text from existing PDF
                                      try {
                                        const existingPdfBuffer = await fs.readFile(pdfPath)
                                        const pdfData = await pdfParse(existingPdfBuffer)
                                        const extractedText = pdfData.text.trim()
                                        console.log(`[Extract] ✅ Extracted ${extractedText.length} characters from existing PDF`)
                                        if (extractedText.length > 500) {
                                          return extractedText.substring(0, 20000)
                                        }
                                        return extractedText || `[PDF file already exists - ${existingStats.size} bytes. Text extraction yielded ${extractedText.length} characters. URL: ${pdfUrl}]`
                                      } catch (pdfError: any) {
                                        const isDRM = pdfError.message?.toLowerCase().includes('encryption') || 
                                                     pdfError.message?.toLowerCase().includes('drm') ||
                                                     pdfError.message?.toLowerCase().includes('digital rights')
                                        
                                        if (isDRM) {
                                          console.error(`[Extract] ⚠️  PDF is DRM-protected (requires Adobe Digital Editions): ${pdfError.message}`)
                                          return `[PDF file already exists but DRM-protected - ${existingStats.size} bytes. Path: ${pdfPath}. URL: ${pdfUrl}. This PDF requires Adobe Digital Editions to read (DRM protection).]`
                                        } else {
                                          console.error(`[Extract] Error extracting text from existing PDF: ${pdfError.message}`)
                                          return `[PDF file already exists - ${existingStats.size} bytes. Path: ${pdfPath}. URL: ${pdfUrl}. Text extraction failed: ${pdfError.message}]`
                                        }
                                      }
                                    } else if (existingStats.size > 0) {
                                      console.log(`[Extract] PDF exists but size differs (existing: ${existingStats.size}, expected: ${contentLength}), re-downloading...`)
                                    }
                                  } catch (error) {
                                    // File doesn't exist, proceed with download
                                    console.log(`[Extract] PDF doesn't exist yet, downloading...`)
                                  }
                                  
                                  // Extract text from PDF (either from existing file or newly downloaded)
                                  let pdfDataBuffer: Buffer
                                  if (!pdfExists) {
                                    // Save PDF to file and extract text
                                    const pdfBuffer = await pdfResponse.arrayBuffer()
                                    pdfDataBuffer = Buffer.from(pdfBuffer)
                                    await fs.writeFile(pdfPath, pdfDataBuffer)
                                    console.log(`[Extract] Saved PDF to: ${pdfPath}`)
                                  } else {
                                    // Read existing PDF file
                                    pdfDataBuffer = await fs.readFile(pdfPath)
                                  }
                                  
                                  // Extract text from PDF
                                  try {
                                    console.log(`[Extract] Extracting text from PDF...`)
                                    const pdfData = await pdfParse(pdfDataBuffer)
                                    const extractedText = pdfData.text.trim()
                                    console.log(`[Extract] ✅ Extracted ${extractedText.length} characters from PDF`)
                                    
                                    if (extractedText.length > 500) {
                                      return extractedText.substring(0, 20000)
                                    }
                                    return extractedText || `[PDF file downloaded - ${contentLength} bytes. Text extraction yielded ${extractedText.length} characters. URL: ${pdfUrl}]`
                                  } catch (pdfError: any) {
                                    const isDRM = pdfError.message?.toLowerCase().includes('encryption') || 
                                                 pdfError.message?.toLowerCase().includes('drm') ||
                                                 pdfError.message?.toLowerCase().includes('digital rights')
                                    
                                    if (isDRM) {
                                      console.error(`[Extract] ⚠️  PDF is DRM-protected (requires Adobe Digital Editions): ${pdfError.message}`)
                                      return `[PDF file downloaded but DRM-protected - ${contentLength} bytes. Saved to: ${pdfPath}. URL: ${pdfUrl}. This PDF requires Adobe Digital Editions to read (DRM protection, not standard encryption).]`
                                    } else {
                                      console.error(`[Extract] Error extracting text from PDF: ${pdfError.message}`)
                                      return `[PDF file successfully downloaded from archive.org - ${contentLength} bytes. Saved to: ${pdfPath}. URL: ${pdfUrl}. Text extraction failed: ${pdfError.message}]`
                                    }
                                  }
                                }
                              } else {
                                console.log(`[Extract] PDF access returned ${pdfResponse.status}`)
                              }
                            } catch (fetchError: any) {
                              console.log(`[Extract] Failed to fetch PDF from metadata: ${fetchError.message}`)
                              continue
                            }
                          }
                        }
                      }
                    } catch (jsonError: any) {
                      console.log(`[Extract] Failed to parse JSON metadata: ${jsonError.message}`)
                    }
                  }
                  
                  // Strategy 2: Look for PDF download links in the HTML (fallback)
                  const pdfPatterns = [
                    new RegExp(`href="(/download/${identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[^"]*\\.pdf)"`, 'gi'),
                    /href="([^"]*\/download\/[^"]*\.pdf)"/gi,
                    /data-url="([^"]*\.pdf)"/gi,
                    /href="([^"]*\.pdf)"/gi
                  ]
                  
                  const foundPdfUrls: string[] = []
                  
                  for (const pattern of pdfPatterns) {
                    const matches = [...archiveHtml.matchAll(pattern)]
                    for (const match of matches) {
                      let pdfUrl = match[1]
                      if (pdfUrl.startsWith('/')) {
                        pdfUrl = `https://archive.org${pdfUrl}`
                      } else if (!pdfUrl.startsWith('http')) {
                        continue
                      }
                      
                      // Skip social media links and other non-PDF links
                      if (pdfUrl.includes('twitter.com') || pdfUrl.includes('facebook.com') || 
                          pdfUrl.includes('reddit.com') || pdfUrl.includes('pinterest.com') ||
                          pdfUrl.includes('tumblr.com') || !pdfUrl.endsWith('.pdf')) {
                        continue
                      }
                      
                      // Avoid duplicates
                      if (!foundPdfUrls.includes(pdfUrl)) {
                        foundPdfUrls.push(pdfUrl)
                        console.log(`[Extract] Found PDF link on archive.org page: ${pdfUrl}`)
                      }
                    }
                  }
                
                // Try each PDF URL found
                for (const pdfUrl of foundPdfUrls) {
                  try {
                    console.log(`[Extract] Attempting to fetch PDF: ${pdfUrl}`)
                    await new Promise(resolve => setTimeout(resolve, 2000))
                    
                    const foundPdfResponse = await fetch(pdfUrl, {
                      headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/pdf,*/*',
                        'Referer': downloadLink.url
                      },
                      redirect: 'follow',
                      signal: AbortSignal.timeout(60000)
                    })
                    
                    if (foundPdfResponse.ok) {
                      const contentType = foundPdfResponse.headers.get('content-type') || ''
                      if (contentType.includes('application/pdf')) {
                        const contentLength = foundPdfResponse.headers.get('content-length') || 'unknown'
                        console.log(`[Extract] ✅ Successfully accessed PDF from archive.org (${contentLength} bytes)`)
                        
                        // Check if PDF already exists
                        const dataDir = path.join(process.cwd(), 'data', 'pdfs')
                        await fs.mkdir(dataDir, { recursive: true })
                        const pdfPath = path.join(dataDir, `${identifier}.pdf`)
                        
                        // Check if file already exists and has the same size
                        let pdfExists = false
                        try {
                          const existingStats = await fs.stat(pdfPath)
                          const expectedSize = contentLength !== 'unknown' ? parseInt(contentLength) : null
                          
                          if (expectedSize && existingStats.size === expectedSize) {
                            console.log(`[Extract] PDF already exists with same size (${existingStats.size} bytes), skipping download`)
                            pdfExists = true
                            // Extract text from existing PDF
                            try {
                              const existingPdfBuffer = await fs.readFile(pdfPath)
                              const pdfData = await pdfParse(existingPdfBuffer)
                              const extractedText = pdfData.text.trim()
                              console.log(`[Extract] ✅ Extracted ${extractedText.length} characters from existing PDF`)
                              if (extractedText.length > 500) {
                                return extractedText.substring(0, 20000)
                              }
                              return extractedText || `[PDF file already exists - ${existingStats.size} bytes. Text extraction yielded ${extractedText.length} characters. URL: ${pdfUrl}]`
                            } catch (pdfError: any) {
                              console.error(`[Extract] Error extracting text from existing PDF: ${pdfError.message}`)
                              return `[PDF file already exists - ${existingStats.size} bytes. Path: ${pdfPath}. URL: ${pdfUrl}. Text extraction failed: ${pdfError.message}]`
                            }
                          } else if (existingStats.size > 0) {
                            console.log(`[Extract] PDF exists but size differs (existing: ${existingStats.size}, expected: ${contentLength}), re-downloading...`)
                          }
                        } catch (error) {
                          // File doesn't exist, proceed with download
                          console.log(`[Extract] PDF doesn't exist yet, downloading...`)
                        }
                        
                        // Extract text from PDF (either from existing file or newly downloaded)
                        let pdfDataBuffer: Buffer
                        if (!pdfExists) {
                          // Save PDF to file and extract text
                          const pdfBuffer = await foundPdfResponse.arrayBuffer()
                          pdfDataBuffer = Buffer.from(pdfBuffer)
                          await fs.writeFile(pdfPath, pdfDataBuffer)
                          console.log(`[Extract] Saved PDF to: ${pdfPath}`)
                        } else {
                          // Read existing PDF file
                          pdfDataBuffer = await fs.readFile(pdfPath)
                        }
                        
                        // Extract text from PDF
                        try {
                          console.log(`[Extract] Extracting text from PDF...`)
                          const pdfData = await pdfParse(pdfDataBuffer)
                          const extractedText = pdfData.text.trim()
                          console.log(`[Extract] ✅ Extracted ${extractedText.length} characters from PDF`)
                          
                          if (extractedText.length > 500) {
                            return extractedText.substring(0, 20000)
                          }
                          return extractedText || `[PDF file downloaded - ${contentLength} bytes. Text extraction yielded ${extractedText.length} characters. URL: ${pdfUrl}]`
                        } catch (pdfError: any) {
                          console.error(`[Extract] Error extracting text from PDF: ${pdfError.message}`)
                          return `[PDF file successfully downloaded from archive.org - ${contentLength} bytes. Saved to: ${pdfPath}. URL: ${pdfUrl}. Text extraction failed: ${pdfError.message}]`
                        }
                      }
                    } else {
                      console.log(`[Extract] PDF fetch returned ${foundPdfResponse.status}`)
                    }
                  } catch (pdfError: any) {
                    console.log(`[Extract] Error fetching PDF: ${pdfError.message}`)
                    continue // Try next PDF URL
                  }
                }
                
                // If no PDF found, try to find other file formats or extract description
                if (foundPdfUrls.length === 0) {
                  console.log(`[Extract] No PDF links found, looking for other formats...`)
                  
                  // Look for other file formats
                  const otherFormats = /href="([^"]*\/download\/[^"]*\.(epub|djvu|txt|zip))"/gi
                  const otherMatches = [...archiveHtml.matchAll(otherFormats)]
                  if (otherMatches.length > 0) {
                    console.log(`[Extract] Found ${otherMatches.length} other file format(s)`)
                  }
                }
                
                // Extract description from archive.org page
                const descPattern = /<meta[^>]*name="description"[^>]*content="([^"]+)"/i
                const descMatch = archiveHtml.match(descPattern)
                if (descMatch && descMatch[1].length > 100) {
                  console.log(`[Extract] Found description on archive.org: ${descMatch[1].length} chars`)
                  return descMatch[1]
                }
              }
              }
            }
            
            continue // Move to next link
          }
          
          // For slow download links, use Playwright to handle DDoS-GUARD and wait page
          if (downloadLink.url.includes('slow_download')) {
            console.log(`[Extract] Using Playwright for slow download link (handles DDoS-GUARD and wait page)...`)
            
            try {
              // Launch browser with better fingerprinting to avoid detection
              const browser = await chromium.launch({ 
                headless: true,
                args: [
                  '--disable-blink-features=AutomationControlled',
                  '--disable-dev-shm-usage',
                  '--no-sandbox',
                  '--disable-setuid-sandbox',
                  '--disable-web-security',
                  '--disable-features=IsolateOrigins,site-per-process'
                ]
              })
              
              // Create context with realistic browser fingerprint
              const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                viewport: { width: 1920, height: 1080 },
                locale: 'en-US',
                timezoneId: 'America/New_York',
                permissions: [],
                extraHTTPHeaders: {
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                  'Accept-Language': 'en-US,en;q=0.9',
                  'Accept-Encoding': 'gzip, deflate, br',
                  'Connection': 'keep-alive',
                  'Upgrade-Insecure-Requests': '1',
                  'Sec-Fetch-Dest': 'document',
                  'Sec-Fetch-Mode': 'navigate',
                  'Sec-Fetch-Site': 'none',
                  'Sec-Fetch-User': '?1',
                  'Cache-Control': 'max-age=0'
                }
              })
              
              // Remove webdriver property to avoid detection
              const page = await context.newPage()
              await page.addInitScript(() => {
                // Remove webdriver flag
                Object.defineProperty(navigator, 'webdriver', {
                  get: () => false
                })
                
                // Override plugins
                Object.defineProperty(navigator, 'plugins', {
                  get: () => [1, 2, 3, 4, 5]
                })
                
                // Override languages
                Object.defineProperty(navigator, 'languages', {
                  get: () => ['en-US', 'en']
                })
                
                // Override permissions
                const originalQuery = window.navigator.permissions.query
                window.navigator.permissions.query = (parameters: any) => (
                  parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission } as PermissionStatus) :
                    originalQuery(parameters)
                )
              })
              
              // Set reasonable timeouts
              page.setDefaultTimeout(90000)
              page.setDefaultNavigationTimeout(90000)
              
              // Navigate to the slow download page
              console.log(`[Extract] Navigating to slow download page...`)
              await page.goto(downloadLink.url, { 
                waitUntil: 'networkidle', // Wait for network to be idle
                timeout: 60000 
              })
              
              // Wait for page to initialize
              await page.waitForTimeout(3000)
              
              // Check for CAPTCHA iframe
              const captchaIframe = await page.$('iframe[src*="ddos-guard"], iframe[src*="captcha"], iframe[src*="challenge"]')
              if (captchaIframe) {
                console.log(`[Extract] ⚠️  CAPTCHA iframe detected - waiting for manual solve or auto-solve...`)
                // Wait longer for CAPTCHA to potentially auto-solve
                await page.waitForTimeout(15000)
              }
              
              // Check if we're on a wait page
              const pageContent = await page.content()
              const hasWaitText = pageContent.includes('wait') || 
                                 pageContent.includes('5 seconds') || 
                                 pageContent.includes('Please wait') ||
                                 pageContent.includes('waiting') ||
                                 pageContent.includes('DDoS-GUARD') ||
                                 pageContent.includes('ddos-guard')
              
              if (hasWaitText) {
                console.log(`[Extract] Wait page detected - waiting for JavaScript to execute...`)
                // Wait longer for the page to fully load and JavaScript to execute
                await page.waitForTimeout(10000) // Increased wait time
                
                // Wait for network to be idle (all resources loaded)
                try {
                  await page.waitForLoadState('networkidle', { timeout: 20000 })
                  console.log(`[Extract] Page reached networkidle state`)
                } catch (e) {
                  console.log(`[Extract] Networkidle timeout, continuing...`)
                }
                
                // Try waiting for any link to appear (might be created dynamically)
                try {
                  await page.waitForSelector('a[href*="download"], a[href*="file"], button, a[href*="get"], a[href*="continue"]', { timeout: 15000 })
                  console.log(`[Extract] Link/button appeared after wait`)
                } catch (e) {
                  console.log(`[Extract] No link appeared yet, waiting more...`)
                  // Wait a bit more and check again
                  await page.waitForTimeout(5000)
                }
              }
              
              // Look for the download link with multiple strategies
              console.log(`[Extract] Searching for download link...`)
              
              // Refresh page content after wait
              const currentUrl = page.url()
              if (currentUrl !== downloadLink.url) {
                console.log(`[Extract] Page redirected to: ${currentUrl}`)
                // Check if we're already on a download page
                if ((currentUrl.includes('.pdf') || (currentUrl.includes('download') && !currentUrl.includes('slow_download')))) {
                  console.log(`[Extract] ✅ Already on download page via redirect`)
                  // Try to download directly
                  const downloadPromise = page.waitForEvent('download', { timeout: 30000 }).catch(() => null)
                  await page.waitForTimeout(2000)
                  const download = await downloadPromise
                  if (download) {
                    const downloadPath = await download.path()
                    const fileBuffer = await fs.readFile(downloadPath)
                    const fileName = download.suggestedFilename() || 'download.pdf'
                    
                    // Check if it's a PDF and extract text
                    if (fileName.endsWith('.pdf') || (fileBuffer[0] === 0x25 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x44 && fileBuffer[3] === 0x46)) {
                      try {
                        const pdfData = await pdfParse(fileBuffer)
                        const extractedText = pdfData.text.trim()
                        console.log(`[Extract] ✅ Extracted ${extractedText.length} characters from PDF`)
                        
                        // Save PDF
                        const dataDir = path.join(process.cwd(), 'data', 'pdfs')
                        await fs.mkdir(dataDir, { recursive: true })
                        const pdfPath = path.join(dataDir, fileName)
                        await fs.writeFile(pdfPath, fileBuffer)
                        console.log(`[Extract] Saved PDF to: ${pdfPath}`)
                        await fs.unlink(downloadPath).catch(() => {})
                        
                        if (extractedText.length > 500) {
                          await browser.close()
                          return extractedText.substring(0, 20000)
                        }
                        await browser.close()
                        return extractedText
                      } catch (pdfError: any) {
                        console.error(`[Extract] Error extracting PDF text: ${pdfError.message}`)
                        // Save PDF anyway
                        const dataDir = path.join(process.cwd(), 'data', 'pdfs')
                        await fs.mkdir(dataDir, { recursive: true })
                        const pdfPath = path.join(dataDir, fileName)
                        await fs.writeFile(pdfPath, fileBuffer)
                        await fs.unlink(downloadPath).catch(() => {})
                        await browser.close()
                        return `[PDF downloaded - ${fileBuffer.length} bytes. Saved to: ${pdfPath}. Text extraction failed: ${pdfError.message}]`
                      }
                    } else {
                      // Not a PDF
                      const textContent = fileBuffer.toString('utf-8')
                      await fs.unlink(downloadPath).catch(() => {})
                      await browser.close()
                      if (textContent.length > 500) {
                        return textContent.substring(0, 20000)
                      }
                      return textContent
                    }
                  }
                }
              }
              
              const downloadNowLink = await page.evaluate(() => {
                // Strategy 1: Look for links with "download now" text (most common)
                const links = Array.from(document.querySelectorAll('a'))
                for (const link of links) {
                  const text = link.textContent?.toLowerCase().trim() || ''
                  const href = link.getAttribute('href') || ''
                  
                  // Check for "download now" or similar text
                  // Exclude navigation links like "downloaded files", "account", etc.
                  const isNavLink = href.includes('/account/') || 
                                   href.includes('/user/') || 
                                   href.includes('/login') ||
                                   href.includes('/register') ||
                                   text.includes('downloaded files') ||
                                   text.includes('my account') ||
                                   text.includes('login') ||
                                   text.includes('register')
                  
                  if ((text.includes('download now') || 
                       (text.includes('download') && !isNavLink) || 
                       text.includes('get file') ||
                       (text.includes('continue') && href.includes('download')) ||
                       (text.includes('proceed') && href.includes('download')) ||
                       text.includes('get download')) && 
                      href && 
                      !href.includes('slow_download') &&
                      !href.includes('/account/') &&
                      !href.includes('/user/') &&
                      !href.startsWith('#') &&
                      !href.startsWith('javascript:') &&
                      !isNavLink) {
                    return { type: 'link', href, text: text.substring(0, 50), element: 'a' }
                  }
                }
                
                // Strategy 2: Look for buttons with download text
                const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'))
                for (const button of buttons) {
                  const text = (button.textContent || button.getAttribute('value') || '').toLowerCase().trim()
                  const onclick = button.getAttribute('onclick') || ''
                  const formAction = (button as HTMLFormElement).form?.action || ''
                  
                  if (text.includes('download') || onclick.includes('download') || formAction.includes('download')) {
                    // Try to extract URL from onclick
                    const urlMatch = onclick.match(/['"](https?:\/\/[^'"]+)['"]/) || onclick.match(/['"]([^'"]+)['"]/)
                    if (urlMatch) {
                      return { type: 'button', href: urlMatch[1], text: text.substring(0, 50), element: 'button' }
                    }
                    // Check form action
                    if (formAction && !formAction.includes('slow_download')) {
                      return { type: 'form', href: formAction, text: text.substring(0, 50), element: 'form' }
                    }
                  }
                }
                
                // Strategy 3: Look for any link that might be a download (not slow_download)
                // Prioritize links that look like actual file downloads
                for (const link of links) {
                  const href = link.getAttribute('href') || ''
                  const text = (link.textContent || '').toLowerCase()
                  
                  // Skip navigation links
                  if (href.includes('/account/') || href.includes('/user/') || href.includes('/login')) {
                    continue
                  }
                  
                  // Look for direct download links (PDFs, files, or download endpoints)
                  if (href && 
                      !href.includes('slow_download') &&
                      !href.startsWith('#') &&
                      !href.startsWith('javascript:') &&
                      (href.endsWith('.pdf') ||
                       href.includes('/download/') ||
                       href.includes('/file/') ||
                       (href.includes('download') && !text.includes('downloaded files')) ||
                       (href.includes('file') && !text.includes('account')))) {
                    return { type: 'fallback', href, text: link.textContent?.substring(0, 50) || '' }
                  }
                }
                
                // Strategy 4: Check if there's a redirect happening via JavaScript
                // Look for window.location or meta refresh
                const scripts = Array.from(document.querySelectorAll('script'))
                for (const script of scripts) {
                  const scriptText = script.textContent || ''
                  if (scriptText.includes('window.location') || scriptText.includes('location.href')) {
                    const urlMatch = scriptText.match(/['"](https?:\/\/[^'"]+)['"]/)
                    if (urlMatch && !urlMatch[1].includes('slow_download')) {
                      return { type: 'javascript', href: urlMatch[1], text: 'JavaScript redirect' }
                    }
                  }
                }
                
                // Strategy 5: Check meta refresh
                const metaRefresh = document.querySelector('meta[http-equiv="refresh"]')
                if (metaRefresh) {
                  const content = metaRefresh.getAttribute('content') || ''
                  const urlMatch = content.match(/url=([^;]+)/i)
                  if (urlMatch && !urlMatch[1].includes('slow_download')) {
                    return { type: 'meta', href: urlMatch[1].trim(), text: 'Meta refresh' }
                  }
                }
                
                return null
              })
              
              if (downloadNowLink) {
                let finalDownloadUrl = downloadNowLink.href
                if (finalDownloadUrl.startsWith('/')) {
                  finalDownloadUrl = `https://annas-archive.org${finalDownloadUrl}`
                } else if (!finalDownloadUrl.startsWith('http')) {
                  finalDownloadUrl = `https://annas-archive.org/${finalDownloadUrl}`
                }
                
                console.log(`[Extract] Found download link via Playwright (${downloadNowLink.type}): ${finalDownloadUrl}`)
                console.log(`[Extract] Link text: "${downloadNowLink.text}"`)
                
                // Set up download listener BEFORE navigating
                const downloadPromise = page.waitForEvent('download', { timeout: 45000 }).catch(() => null)
                
                // Handle different link types
                if (downloadNowLink.type === 'link') {
                  try {
                    // Wait for the link to be visible and clickable
                    await page.waitForSelector(`a[href="${downloadNowLink.href}"]`, { timeout: 5000 })
                    await page.click(`a[href="${downloadNowLink.href}"]`, { timeout: 5000 })
                    console.log(`[Extract] Clicked download link`)
                  } catch (clickError: any) {
                    console.log(`[Extract] Click failed (${clickError.message}), trying direct navigation...`)
                    await page.goto(finalDownloadUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
                  }
                } else if (downloadNowLink.type === 'javascript' || downloadNowLink.type === 'meta') {
                  // For JavaScript redirects or meta refresh, just navigate directly
                  console.log(`[Extract] Following ${downloadNowLink.type} redirect...`)
                  await page.goto(finalDownloadUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
                } else {
                  // For buttons or fallback, navigate directly
                  await page.goto(finalDownloadUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
                }
                
                // Wait for download with timeout
                const download = await downloadPromise
                
                if (download) {
                  const downloadPath = await download.path()
                  console.log(`[Extract] ✅ Downloaded file to: ${downloadPath}`)
                  
                  // Read the downloaded file
                  const fileBuffer = await fs.readFile(downloadPath)
                  const fileName = download.suggestedFilename() || 'download.pdf'
                  
                  // Check if it's a PDF
                  if (fileName.endsWith('.pdf') || fileBuffer[0] === 0x25 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x44 && fileBuffer[3] === 0x46) {
                    // It's a PDF - check for deduplication BEFORE saving
                    const dataDir = path.join(process.cwd(), 'data', 'pdfs')
                    await fs.mkdir(dataDir, { recursive: true })
                    
                    // Try to use identifier if available, otherwise use filename
                    let pdfPath: string
                    let pdfExists = false
                    
                    // Check if we have an identifier from archive.org URL
                    const identifierMatch = downloadLink.url.match(/\/details\/([^\/]+)/)
                    if (identifierMatch) {
                      const identifier = identifierMatch[1]
                      pdfPath = path.join(dataDir, `${identifier}.pdf`)
                      
                      // Check if PDF already exists with same size
                      try {
                        const existingStats = await fs.stat(pdfPath)
                        if (existingStats.size === fileBuffer.length) {
                          console.log(`[Extract] ✅ PDF already exists with same size (${existingStats.size} bytes), extracting text from existing file...`)
                          pdfExists = true
                          // Clean up temp file
                          await fs.unlink(downloadPath).catch(() => {})
                          
                          // Extract text from existing PDF
                          try {
                            const existingPdfBuffer = await fs.readFile(pdfPath)
                            const pdfData = await pdfParse(existingPdfBuffer)
                            const extractedText = pdfData.text.trim()
                            console.log(`[Extract] ✅ Extracted ${extractedText.length} characters from existing PDF`)
                            if (extractedText.length > 500) {
                              return extractedText.substring(0, 20000)
                            }
                            return extractedText || `[PDF file already exists - ${existingStats.size} bytes. Text extraction yielded ${extractedText.length} characters]`
                          } catch (pdfError: any) {
                            console.error(`[Extract] Error extracting text from existing PDF: ${pdfError.message}`)
                            return `[PDF file already exists - ${existingStats.size} bytes. Path: ${pdfPath}. Text extraction failed: ${pdfError.message}]`
                          }
                        } else if (existingStats.size > 0) {
                          console.log(`[Extract] PDF exists but size differs (existing: ${existingStats.size}, downloaded: ${fileBuffer.length}), replacing...`)
                        }
                      } catch (error) {
                        // File doesn't exist, proceed with save
                        console.log(`[Extract] PDF doesn't exist yet, saving...`)
                      }
                    } else {
                      // No identifier, use filename
                      pdfPath = path.join(dataDir, fileName)
                      
                      // Check if file with same name and size exists
                      try {
                        const existingStats = await fs.stat(pdfPath)
                        if (existingStats.size === fileBuffer.length) {
                          console.log(`[Extract] ✅ PDF already exists with same size (${existingStats.size} bytes), extracting text from existing file...`)
                          pdfExists = true
                          // Clean up temp file
                          await fs.unlink(downloadPath).catch(() => {})
                          
                          // Extract text from existing PDF
                          try {
                            const existingPdfBuffer = await fs.readFile(pdfPath)
                            const pdfData = await pdfParse(existingPdfBuffer)
                            const extractedText = pdfData.text.trim()
                            console.log(`[Extract] ✅ Extracted ${extractedText.length} characters from existing PDF`)
                            if (extractedText.length > 500) {
                              return extractedText.substring(0, 20000)
                            }
                            return extractedText || `[PDF file already exists - ${existingStats.size} bytes. Text extraction yielded ${extractedText.length} characters]`
                          } catch (pdfError: any) {
                            console.error(`[Extract] Error extracting text from existing PDF: ${pdfError.message}`)
                            return `[PDF file already exists - ${existingStats.size} bytes. Path: ${pdfPath}. Text extraction failed: ${pdfError.message}]`
                          }
                        }
                      } catch (error) {
                        // File doesn't exist, proceed with save
                      }
                    }
                    
                    if (!pdfExists) {
                      // Save PDF to data/pdfs directory
                      await fs.writeFile(pdfPath, fileBuffer)
                      console.log(`[Extract] Saved PDF to: ${pdfPath}`)
                      
                      // Clean up temp file
                      await fs.unlink(downloadPath).catch(() => {})
                      
                      // Extract text from PDF
                      try {
                        const pdfData = await pdfParse(fileBuffer)
                        const extractedText = pdfData.text.trim()
                        console.log(`[Extract] ✅ Extracted ${extractedText.length} characters from PDF`)
                        
                        if (extractedText.length > 500) {
                          return extractedText.substring(0, 20000) // Limit to 20k chars
                        }
                        return extractedText
                      } catch (pdfError: any) {
                        console.error(`[Extract] Error extracting PDF text: ${pdfError.message}`)
                        return `[PDF downloaded - ${fileBuffer.length} bytes. Saved to: ${pdfPath}. Text extraction failed: ${pdfError.message}]`
                      }
                    }
                  } else {
                    // Not a PDF - try to read as text
                    const textContent = fileBuffer.toString('utf-8')
                    if (textContent.length > 500) {
                      return textContent.substring(0, 20000)
                    }
                    return textContent
                  }
                } else {
                  console.log(`[Extract] Download event not triggered, trying direct fetch...`)
                  // Fall back to direct fetch
                  try {
                    const directResponse = await fetch(finalDownloadUrl, {
                      headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                      },
                      signal: AbortSignal.timeout(30000)
                    })
                    
                    if (directResponse.ok) {
                      const contentType = directResponse.headers.get('content-type') || ''
                      if (contentType.includes('application/pdf')) {
                        const pdfBuffer = await directResponse.arrayBuffer()
                        const pdfData = await pdfParse(Buffer.from(pdfBuffer))
                        return pdfData.text.trim().substring(0, 20000)
                      }
                    }
                  } catch (fetchError: any) {
                    console.log(`[Extract] Direct fetch also failed: ${fetchError.message}`)
                  }
                }
              } else {
                console.log(`[Extract] ❌ Could not find download link on page`)
                
                // Check if we're blocked by CAPTCHA
                const hasCaptcha = await page.evaluate(() => {
                  return !!(
                    document.querySelector('iframe[src*="ddos-guard"]') ||
                    document.querySelector('iframe[src*="captcha"]') ||
                    document.querySelector('iframe[src*="challenge"]') ||
                    document.body.textContent?.includes('I\'m not a robot') ||
                    document.body.textContent?.includes('Verify you are human')
                  )
                })
                
                if (hasCaptcha) {
                  console.log(`[Extract] ⚠️  CAPTCHA detected - waiting additional time for potential auto-solve...`)
                  await page.waitForTimeout(20000) // Wait 20 more seconds
                  
                  // Check again after waiting
                  const retryLink = await page.evaluate(() => {
                    const links = Array.from(document.querySelectorAll('a'))
                    for (const link of links) {
                      const text = link.textContent?.toLowerCase() || ''
                      const href = link.getAttribute('href') || ''
                      if ((text.includes('download') || text.includes('continue') || text.includes('proceed')) &&
                          href && !href.includes('slow_download') && !href.startsWith('#')) {
                        return { type: 'link', href, text: text.substring(0, 50) }
                      }
                    }
                    return null
                  })
                  
                  if (retryLink) {
                    console.log(`[Extract] ✅ Found link after CAPTCHA wait: ${retryLink.href}`)
                    // Process the retry link (similar to downloadNowLink handling above)
                    // ... (will handle this in the next section)
                  } else {
                    console.log(`[Extract] CAPTCHA still present - manual intervention may be required`)
                  }
                } else {
                  console.log(`[Extract] DDoS-GUARD may be blocking or page structure changed`)
                }
                
                // Save page HTML for debugging (only in development)
                if (process.env.NODE_ENV === 'development') {
                  try {
                    const debugHtml = await page.content()
                    const debugPath = path.join(process.cwd(), 'data', 'debug-ddos-page.html')
                    await fs.mkdir(path.dirname(debugPath), { recursive: true })
                    await fs.writeFile(debugPath, debugHtml)
                    console.log(`[Extract] Saved debug HTML to: ${debugPath}`)
                  } catch (e) {
                    // Ignore debug save errors
                  }
                }
              }
              
              await browser.close()
            } catch (playwrightError: any) {
              console.error(`[Extract] Playwright error: ${playwrightError.message}`)
              if (playwrightError.message.includes('timeout') || playwrightError.message.includes('Navigation')) {
                console.log(`[Extract] Timeout - DDoS-GUARD may be blocking or page is slow`)
              } else {
                console.log(`[Extract] Error accessing page - DDoS-GUARD protection may be blocking`)
              }
              // Continue to next link (prefer archive.org links which don't have DDoS-GUARD)
            }
            
            // Skip slow download links if they fail - prefer archive.org links
            continue // Move to next link
          }
          
          // For other download links, try direct fetch
          try {
            const downloadResponse = await fetch(downloadLink.url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8,application/pdf,application/epub+zip',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': bookUrl,
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
              },
              redirect: 'follow',
              signal: AbortSignal.timeout(30000)
            })
            
            console.log(`[Extract] Response status: ${downloadResponse.status}`)
            
            if (downloadResponse.ok) {
              const contentType = downloadResponse.headers.get('content-type') || ''
              console.log(`[Extract] Content-Type: ${contentType}`)
            
              if (contentType.includes('text/html')) {
                // It's an HTML page - likely the "wait 5 seconds" page
                const downloadHtml = await downloadResponse.text()
                console.log(`[Extract] Fetched HTML page: ${downloadHtml.length} chars`)
                
                // Check if this is the "wait 5 seconds" page
                if (downloadHtml.includes('wait') || downloadHtml.includes('5 seconds') || downloadHtml.includes('Please wait') || downloadHtml.includes('waiting')) {
                console.log(`[Extract] Found wait page - waiting 6 seconds then looking for "download now" link...`)
                
                // Wait 6 seconds to simulate the wait
                await new Promise(resolve => setTimeout(resolve, 6000))
                
                // Re-fetch the page after waiting - the "download now" link should appear
                console.log(`[Extract] Re-fetching page after wait...`)
                await new Promise(resolve => setTimeout(resolve, 1000))
                
                const retryResponse = await fetch(downloadLink.url, {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Referer': bookUrl,
                    'Cookie': response.headers.get('set-cookie') || '' // Preserve cookies
                  },
                  redirect: 'follow',
                  signal: AbortSignal.timeout(30000)
                })
                
                if (retryResponse.ok) {
                  const retryHtml = await retryResponse.text()
                  console.log(`[Extract] Re-fetched page: ${retryHtml.length} chars`)
                  
                  // Look for the "download now" link
                  const downloadNowPatterns = [
                    /href="([^"]*download[^"]*)"[^>]*>[\s\S]{0,200}(?:download now|Download Now|download|Download)/gi,
                    /<a[^>]*download[^>]*href="([^"]+)"/gi,
                    /(?:download now|Download Now)[\s\S]{0,200}href="([^"]+)"/gi,
                    /href="([^"]+)"[^>]*>[\s\S]{0,200}(?:download now|Download Now)/gi
                  ]
                  
                  let downloadNowUrl: string | null = null
                  
                  for (const pattern of downloadNowPatterns) {
                    const matches = [...retryHtml.matchAll(pattern)]
                    for (const match of matches) {
                      let url = match[1]
                      if (url && !url.startsWith('javascript:') && !url.startsWith('#') && !url.includes('annas-archive.org/slow_download')) {
                        if (url.startsWith('/')) {
                          url = `https://annas-archive.org${url}`
                        } else if (!url.startsWith('http')) {
                          continue
                        }
                        downloadNowUrl = url
                        console.log(`[Extract] Found "download now" link: ${url}`)
                        break
                      }
                    }
                    if (downloadNowUrl) break
                  }
                  
                  // Also check JavaScript for the download URL
                  if (!downloadNowUrl) {
                    const jsPatterns = [
                      /window\.location\s*=\s*['"]([^'"]+)['"]/gi,
                      /location\.href\s*=\s*['"]([^'"]+)['"]/gi,
                      /downloadUrl\s*[:=]\s*['"]([^'"]+)['"]/gi,
                      /url\s*[:=]\s*['"]([^'"]*download[^'"]*)['"]/gi
                    ]
                    
                    for (const pattern of jsPatterns) {
                      const matches = [...retryHtml.matchAll(pattern)]
                      for (const match of matches) {
                        let url = match[1]
                        if (url && !url.startsWith('javascript:') && !url.startsWith('#')) {
                          if (url.startsWith('/')) {
                            url = `https://annas-archive.org${url}`
                          } else if (!url.startsWith('http')) {
                            continue
                          }
                          downloadNowUrl = url
                          console.log(`[Extract] Found download URL in JavaScript: ${url}`)
                          break
                        }
                      }
                      if (downloadNowUrl) break
                    }
                  }
                  
                  // If we found the download now URL, fetch it
                  if (downloadNowUrl) {
                    console.log(`[Extract] Fetching actual download: ${downloadNowUrl}`)
                    
                    await new Promise(resolve => setTimeout(resolve, 2000))
                    
                    const actualDownloadResponse = await fetch(downloadNowUrl, {
                      headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'application/pdf,application/epub+zip,application/octet-stream,*/*',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Referer': downloadLink.url
                      },
                      redirect: 'follow',
                      signal: AbortSignal.timeout(60000)
                    })
                    
                    if (actualDownloadResponse.ok) {
                      const actualContentType = actualDownloadResponse.headers.get('content-type') || ''
                      console.log(`[Extract] Actual download Content-Type: ${actualContentType}`)
                      
                      if (actualContentType.includes('application/pdf')) {
                        console.log(`[Extract] PDF file received (${actualDownloadResponse.headers.get('content-length') || 'unknown'} bytes)`)
                        // For PDFs, we'd need a PDF parser library like pdf-parse
                        // For now, return a note that we got the PDF
                        return `[PDF file successfully downloaded - ${actualDownloadResponse.headers.get('content-length') || 'unknown'} bytes. Text extraction requires PDF parser library like pdf-parse]`
                      } else if (actualContentType.includes('text/')) {
                        const textContent = await actualDownloadResponse.text()
                        console.log(`[Extract] Fetched text content: ${textContent.length} chars`)
                        if (textContent.length > 500) {
                          return textContent.substring(0, 20000) // Limit to 20k chars
                        }
                      } else {
                        // Try to read as text anyway
                        const content = await actualDownloadResponse.text()
                        if (content.length > 500 && !content.includes('<html')) {
                          return content.substring(0, 20000)
                        }
                      }
                    } else {
                      console.log(`[Extract] Actual download returned ${actualDownloadResponse.status}`)
                    }
                  } else {
                    console.log(`[Extract] Could not find "download now" link after wait`)
                  }
                }
                } else {
                  // Not a wait page - try to extract content directly
                  // Look for direct file download links
                  const directFilePattern = /href="([^"]*\.(pdf|epub|djvu|txt|zip))"/gi
                  const directFileMatches = [...downloadHtml.matchAll(directFilePattern)]
                  
                  if (directFileMatches.length > 0) {
                    console.log(`[Extract] Found ${directFileMatches.length} direct file link(s)`)
                    for (const fileMatch of directFileMatches) {
                      console.log(`[Extract] File link: ${fileMatch[1]}`)
                    }
                  }
                }
              } else if (contentType.includes('application/pdf')) {
                console.log(`[Extract] PDF file detected - would need PDF parser to extract text`)
                // For PDFs, we'd need a PDF parser library
              } else if (contentType.includes('text/plain') || contentType.includes('text/')) {
                const textContent = await downloadResponse.text()
                console.log(`[Extract] Fetched text content: ${textContent.length} chars`)
                if (textContent.length > 500) {
                  return textContent.substring(0, 10000) // Limit to 10k chars
                }
              } else {
                console.log(`[Extract] Unhandled content type: ${contentType}`)
              }
            } else if (downloadResponse.status === 403) {
              console.log(`[Extract] 403 Forbidden - likely DDoS-GUARD protection`)
              console.log(`[Extract] Skipping slow download link (requires manual CAPTCHA)`)
              // DDoS-GUARD requires manual "I'm not a robot" check - skip this approach
              // Continue to next link (prefer archive.org links)
            } else if (downloadResponse.status === 429) {
              console.log(`[Extract] 429 Too Many Requests - rate limited`)
              // Wait longer and continue
              await new Promise(resolve => setTimeout(resolve, 5000))
            } else {
              console.log(`[Extract] Download link returned ${downloadResponse.status}`)
            }
          } catch (downloadError: any) {
            console.log(`[Extract] Error accessing download link: ${downloadError.message}`)
            // Continue to next link
          }
        } catch (outerError: any) {
          console.log(`[Extract] Error processing download link: ${outerError.message}`)
          // Continue to next link
        }
      }
      
      console.log(`[Extract] Tried ${Math.min(downloadLinks.length, 5)} download links, none provided accessible content`)
    } else {
      console.log(`[Extract] No "slow downloads" section found`)
    }
    
    // Skip patterns for UI/navigation text
    const skipPatterns = [
      /You have.*left today/i,
      /Thanks for being a member/i,
      /Donate/i,
      /Search/i,
      /Account/i,
      /Log in/i,
      /Register/i,
      /Home/i,
      /Recent downloads/i,
      /New blog post/i,
      /Update your bookmarks/i,
      /Visualizing All ISBNs/i,
      /Saving human knowledge/i,
      /Learn more/i,
      /Anna's Archive am/i,
      /The largest truly open library/i,
      /Our code and data are/i,
      /Recent downloads/i,
      /Anna's Software/i,
      /Security DMCA/i,
      /Alternatives/i,
      /Improve metadata/i,
      /Volunteering/i,
      /Translate/i,
      /Development/i,
      /Contact email/i,
      /Anna's Blog/i,
      /Reddit/i,
      /Matrix/i,
      /Help out/i,
      /Community Projects/i,
      /Open data/i,
      /Datasets/i,
      /Torrents/i,
      /LLM data/i,
      /Stay in touch/i,
      /Explore Activity/i,
      /Codes Explorer/i,
      /ISBN Visualization/i,
      /Public profile/i,
      /Downloaded files/i,
      /My donations/i,
      /Referrals/i,
      /✅ Metadata from linked record/i,
      /Save description/i,
      /🔍 by/i,
      /📗 Book/i,
      /🚀/i,
      /English \[en\]/i,
      /PDF/i,
      /MB/i,
      /📄/i,
      /🎄/i,
      /❄️/i,
      /❌/i,
      /📈/i,
      /⭐️/i,
      /🧬/i,
      /🌐/i,
      /📚/i
    ]
    
    // Look for the full description text - it's usually a longer paragraph
    // Pattern: Look for "A unique visual story" or similar opening phrases followed by substantial text
    const fullDescriptionPatterns = [
      /(A unique visual story[\s\S]{100,1500})/i,
      /(Thousands of years ago[\s\S]{100,1500})/i,
      /(Here, rarely seen[\s\S]{100,1500})/i,
      /(This[\s\S]{0,50}book[\s\S]{100,1500})/i
    ]
    
    for (const pattern of fullDescriptionPatterns) {
      const match = html.match(pattern)
      if (match) {
        let text = match[1]
          .replace(/&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        
        // Extract up to a reasonable length (stop at common endings or HTML tags)
        text = text.split(/<\/[^>]+>|\.\s+(?:Here|Finally|In conclusion|This book)/i)[0]
        
        if (text.length > 200 && !skipPatterns.some(p => p.test(text))) {
          console.log(`[Extract] Found full description: ${text.length} chars`)
          return text.substring(0, 2000) // Limit to 2000 chars
        }
      }
    }
    
    // Fallback: Try meta tags (usually shorter)
    const metaDescriptionMatch = html.match(/<meta[^>]*name="description"[^>]*content="([^"]+)"/i) ||
                                  html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i)
    
    if (metaDescriptionMatch) {
      let text = metaDescriptionMatch[1]
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .trim()
      
      if (text.length > 100 && !skipPatterns.some(p => p.test(text))) {
        console.log(`[Extract] Found description in meta tag: ${text.length} chars`)
        return text
      }
    }
    
    // Look for book description in data-content attributes
    const dataContentPattern = /data-content="([^"]{100,3000})"/gi
    const descriptions: string[] = []
    
    let descMatch
    while ((descMatch = dataContentPattern.exec(html)) !== null) {
      const match = descMatch
      let text = match[1]
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&apos;/g, "'")
        .trim()
      
      // Skip if it's UI text
      if (skipPatterns.some(pattern => pattern.test(text))) {
        continue
      }
      
      // Skip if too short or looks like metadata
      if (text.length < 100) {
        continue
      }
      
      // Skip if it's just a title (no description)
      if (text.length < 200 && !text.includes('.') && !text.includes(',')) {
        continue
      }
      
      // This looks like actual book description
      descriptions.push(text)
    }
    
    // Also look for description in specific HTML elements
    const descriptionSelectors = [
      /<div[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]{200,3000})<\/div>/i,
      /<p[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]{200,3000})<\/p>/i,
      /<div[^>]*id="[^"]*description[^"]*"[^>]*>([\s\S]{200,3000})<\/div>/i
    ]
    
    for (const pattern of descriptionSelectors) {
      const match = html.match(pattern)
      if (match) {
        let text = match[1]
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        
        if (text.length > 200 && !skipPatterns.some(p => p.test(text))) {
          descriptions.push(text)
        }
      }
    }
    
    // Filter and deduplicate descriptions
    const uniqueDescriptions = Array.from(new Set(descriptions))
      .filter(desc => {
        // Must be substantial content
        if (desc.length < 200) return false
        
        // Must not be mostly UI text
        const uiWordCount = skipPatterns.filter(p => p.test(desc)).length
        if (uiWordCount > 2) return false
        
        // Must contain actual sentences
        const sentenceCount = (desc.match(/[.!?]\s+/g) || []).length
        if (sentenceCount < 2) return false
        
        return true
      })
    
    if (uniqueDescriptions.length > 0) {
      // Return the longest, most complete description
      const bestDescription = uniqueDescriptions.sort((a, b) => b.length - a.length)[0]
      console.log(`[Extract] Found description: ${bestDescription.length} chars`)
      return bestDescription
    }
    
    console.log(`[Extract] No suitable description found`)
    return null
  } catch (error: any) {
    console.error(`[Extract] Error:`, error.message)
    return null
  }
}

async function saveBookToFile(book: BookContent, outputDir: string = './carrot/data/extracted-books') {
  try {
    // Create output directory if it doesn't exist
    await fs.mkdir(outputDir, { recursive: true })
    
    // Create a safe filename from the title
    const safeTitle = book.title
      .replace(/[^a-z0-9]/gi, '_')
      .substring(0, 100)
      .toLowerCase()
    
    const filename = `${safeTitle}_${Date.now()}.json`
    const filepath = path.join(outputDir, filename)
    
    const bookData = {
      extractedAt: new Date().toISOString(),
      source: 'annas-archive',
      ...book
    }
    
    await fs.writeFile(filepath, JSON.stringify(bookData, null, 2), 'utf-8')
    console.log(`\n[Save] Saved book to: ${filepath}`)
    
    return filepath
  } catch (error: any) {
    console.error(`[Save] Error saving book:`, error.message)
    return null
  }
}

async function saveBookToDatabase(book: BookContent, patchHandle: string = 'israel') {
  try {
    // Find or create the patch
    const patch = await prisma.patch.findUnique({
      where: { handle: patchHandle }
    })
    
    if (!patch) {
      console.error(`[DB] Patch "${patchHandle}" not found`)
      return null
    }
    
    // Check if this book already exists
    const existing = await prisma.discoveredContent.findFirst({
      where: {
        patchId: patch.id,
        canonicalUrl: book.url,
        OR: [
          { title: book.title },
          { sourceUrl: book.url }
        ]
      }
    })
    
    if (existing) {
      console.log(`[DB] Book already exists: ${book.title}`)
      return existing
    }
    
    // Clean up author field (remove "by " prefix if present)
    let cleanAuthor = book.author
    if (cleanAuthor && cleanAuthor.toLowerCase().startsWith('by ')) {
      cleanAuthor = cleanAuthor.substring(3).trim()
    }
    
    // Get the best content (prefer fullContent, fallback to preview, then title)
    const bestContent = book.fullContent || book.preview || book.title
    const summary = bestContent.length > 500 ? bestContent.substring(0, 500) : bestContent
    
    // Ensure we have at least the title as content (required field)
    const content = bestContent || book.title
    
    // Create discovered content entry
    const discoveredContent = await prisma.discoveredContent.create({
      data: {
        patchId: patch.id,
        title: book.title,
        sourceUrl: book.url,
        canonicalUrl: book.url,
        summary: summary,
        textContent: content,
        content: content, // Required field
        category: 'book',
        metadata: {
          author: cleanAuthor,
          year: book.year,
          isbn: book.metadata.isbn,
          fileType: book.metadata.fileType,
          source: book.metadata.source || 'annas-archive',
          extractedAt: new Date().toISOString()
        }
      }
    })
    
    console.log(`[DB] Saved book to database: ${discoveredContent.id}`)
    return discoveredContent
  } catch (error: any) {
    console.error(`[DB] Error saving to database:`, error.message)
    return null
  }
}

async function main() {
  console.log('=== EXTRACTING BOOK FROM ANNA\'S ARCHIVE ===\n')
  console.log('Searching for: "Israel"\n')
  
  try {
    // Step 1: Search for Israel books
    const results = await searchAnnasArchive({
      query: 'Israel',
      language: 'en',
      fileType: 'all',
      limit: 10
    })
    
    if (results.length === 0) {
      console.error('No results found')
      return
    }
    
    console.log(`Found ${results.length} results\n`)
    
    // Step 2: Select the first book with good metadata
    const selectedBook = results[0]
    console.log('Selected book:')
    console.log(`  Title: ${selectedBook.title}`)
    console.log(`  Author: ${selectedBook.author || 'Unknown'}`)
    console.log(`  Year: ${selectedBook.year || 'Unknown'}`)
    console.log(`  URL: ${selectedBook.url}`)
    console.log(`  Source: ${selectedBook.source || 'Unknown'}`)
    
    // Step 3: Get preview
    console.log('\n[Preview] Fetching preview...')
    const preview = await getAnnasArchivePreview(selectedBook)
    if (preview) {
      console.log(`[Preview] Got preview (${preview.length} chars):`)
      console.log(preview.substring(0, 300) + '...')
    }
    
    // Step 4: Extract full content
    console.log('\n[Content] Extracting full content...')
    const fullContent = await extractBookContent(selectedBook.url)
    
    // Step 5: Prepare book object
    const book: BookContent = {
      title: selectedBook.title,
      author: selectedBook.author,
      year: selectedBook.year,
      url: selectedBook.url,
      preview: preview || undefined,
      fullContent: fullContent || undefined,
      metadata: {
        isbn: selectedBook.isbn,
        fileType: selectedBook.fileType,
        source: selectedBook.source
      }
    }
    
    console.log(`\n[Book] Extracted:`)
    console.log(`  Title: ${book.title}`)
    console.log(`  Preview: ${book.preview ? `${book.preview.length} chars` : 'None'}`)
    console.log(`  Full Content: ${book.fullContent ? `${book.fullContent.length} chars` : 'None'}`)
    
    // Step 6: Save to file
    const filepath = await saveBookToFile(book)
    
    // Step 7: Save to database
    console.log('\n[DB] Saving to database...')
    const dbRecord = await saveBookToDatabase(book, 'israel')
    
    console.log('\n✅ Extraction complete!')
    console.log(`\nSummary:`)
    console.log(`  - Title: ${book.title}`)
    console.log(`  - Author: ${book.author || 'Unknown'}`)
    console.log(`  - Content length: ${(book.fullContent || book.preview || '').length} chars`)
    console.log(`  - Saved to file: ${filepath || 'Failed'}`)
    console.log(`  - Saved to DB: ${dbRecord ? `ID ${dbRecord.id}` : 'Failed'}`)
    
  } catch (error: any) {
    console.error('Error:', error.message)
    console.error(error.stack)
  } finally {
    try {
      await prisma.$disconnect()
    } catch (disconnectError: any) {
      // Ignore disconnect errors (e.g., if connection was never established)
      console.log(`[DB] Note: Database disconnect completed with warning: ${disconnectError.message}`)
    }
  }
}

main().catch(console.error)

