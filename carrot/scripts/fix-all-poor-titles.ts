/**
 * Fix all poor titles in DiscoveredContent
 * 
 * Uses multiple strategies:
 * 1. Hero table titles
 * 2. WikipediaCitation titles
 * 3. URL extraction
 * 4. Content extraction from rawHtml
 */

import { prisma } from '@/lib/prisma'

const POOR_TITLE_PATTERNS = [
  /^10\.\d{4,}\//, // DOI pattern
  /^untitled$/i,
  /^book part$/i,
  /^article$/i,
  /^page$/i,
  /^document$/i,
  /^content$/i,
  /^untitled content$/i,
  /^https?:\/\//, // URLs as titles
  /^[a-z0-9]{8,}$/i, // Random alphanumeric strings
  /^(EuroLeague|Netherlands|basketball|Catalonia|WorldCat)$/i, // Generic terms
]

function isPoorTitle(title: string): boolean {
  if (!title || title.trim().length < 3) return true
  return POOR_TITLE_PATTERNS.some(pattern => pattern.test(title.trim()))
}

async function extractTitleFromHtml(html: string): Promise<string | null> {
  try {
    // Try to extract title from HTML
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    if (titleMatch) {
      let title = titleMatch[1].trim()
      // Clean up title - remove site name suffixes
      title = title.split(/\s*[|\-–—]\s*/)[0].trim()
      if (title.length >= 5 && title.length < 200 && !isPoorTitle(title)) {
        return title
      }
    }
    
    // Try h1
    const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    if (h1Match) {
      const title = h1Match[1].trim()
      if (title.length >= 5 && title.length < 200 && !isPoorTitle(title)) {
        return title
      }
    }
  } catch (e) {
    // HTML parsing failed
  }
  return null
}

async function fixAllPoorTitles() {
  console.log('🔧 Fixing all poor titles...\n')

  // Get all items with poor titles
  const allItems = await prisma.discoveredContent.findMany({
    select: {
      id: true,
      title: true,
      sourceUrl: true,
      canonicalUrl: true,
      rawHtml: true,
      heroRecord: {
        select: { title: true }
      },
      wikipediaCitations: {
        take: 1,
        select: { citationTitle: true }
      }
    }
  })

  console.log(`Found ${allItems.length} total items\n`)

  let fixed = 0
  let skipped = 0

  for (const item of allItems) {
    if (!isPoorTitle(item.title)) {
      skipped++
      continue
    }

    let newTitle: string | null = null

    // Strategy 1: Use Hero table title
    if (item.heroRecord?.title && !isPoorTitle(item.heroRecord.title)) {
      newTitle = item.heroRecord.title
      console.log(`✅ Using Hero title: "${item.title}" -> "${newTitle}"`)
    }
    // Strategy 2: Use WikipediaCitation title
    else if (item.wikipediaCitations.length > 0) {
      const citationTitle = item.wikipediaCitations[0].citationTitle
      if (citationTitle && !isPoorTitle(citationTitle)) {
        newTitle = citationTitle
        console.log(`✅ Using Citation title: "${item.title}" -> "${newTitle}"`)
      }
    }
    // Strategy 3: Extract from URL
    else if (item.sourceUrl || item.canonicalUrl) {
      try {
        const url = new URL(item.canonicalUrl || item.sourceUrl!)
        const pathParts = url.pathname.split('/').filter(p => p && p.length > 2)
        if (pathParts.length > 0) {
          const lastPart = pathParts[pathParts.length - 1]
          const decoded = decodeURIComponent(lastPart.replace(/[-_]/g, ' '))
          if (decoded.length >= 5 && decoded.length < 200 && !isPoorTitle(decoded)) {
            newTitle = decoded
            console.log(`✅ Extracted from URL: "${item.title}" -> "${newTitle}"`)
          }
        }
      } catch (e) {
        // URL parsing failed
      }
    }
    // Strategy 4: Extract from HTML
    if (!newTitle && item.rawHtml) {
      try {
        const html = Buffer.from(item.rawHtml).toString('utf-8')
        const extracted = await extractTitleFromHtml(html)
        if (extracted) {
          newTitle = extracted
          console.log(`✅ Extracted from HTML: "${item.title}" -> "${newTitle}"`)
        }
      } catch (e) {
        // HTML extraction failed
      }
    }

    // Update if we found a better title
    if (newTitle && newTitle !== item.title) {
      await prisma.discoveredContent.update({
        where: { id: item.id },
        data: { title: newTitle }
      })
      fixed++
    } else {
      console.log(`⚠️  Could not fix: "${item.title}"`)
    }
  }

  console.log('\n📊 Summary:')
  console.log(`  Fixed: ${fixed}`)
  console.log(`  Skipped (already good): ${skipped}`)
  console.log(`  Total: ${allItems.length}`)
  console.log('\n✅ Title fix complete!')
}

if (require.main === module) {
  fixAllPoorTitles()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Script failed:', error)
      process.exit(1)
    })
}

export { fixAllPoorTitles }

