/**
 * Fix poor titles and retry ERROR heroes with Wikimedia search
 * This addresses the issues found in the audit
 */

import { PrismaClient } from '@prisma/client'
import { generateSVGPlaceholder } from '@/lib/media/fallbackImages'

const prisma = new PrismaClient()

async function fixTitlesAndRetryHeroes(patchHandle: string) {
  console.log(`=== Fixing Titles and Retrying Wikimedia Heroes for ${patchHandle} ===\n`)
  
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle },
    select: { id: true }
  })
  
  if (!patch) {
    console.error(`Patch "${patchHandle}" not found`)
    process.exit(1)
  }
  
  // Get all items with poor titles or ERROR heroes
  const items = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id
    },
    include: {
      heroRecord: true
    },
    take: 100 // Process in batches
  })
  
  console.log(`Found ${items.length} items to process\n`)
  
  let titleFixed = 0
  let heroRetried = 0
  let heroCreated = 0
  
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://carrot-app.onrender.com'
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    console.log(`\n[${i + 1}/${items.length}] Processing: ${item.id}`)
    console.log(`   Title: "${item.title}"`)
    
    // 1. Fix poor titles
    const poorTitlePatterns = [
      /^[a-z0-9.-]+\.(org|com|edu|gov|net)\s*-\s*/i,
      /^doi\.org/i,
      /^[0-9.]+(\/[0-9a-z]+)+$/i,
      /^(book part|untitled)$/i,
      /^cambridge\.org/i,
      /^\d+\s+\d+\s+[A-Z]/i,
      /^[0-9]+\s+[0-9]+\s+/i,
      /^[0-9]+\s+[A-Z]/i,
      /^[A-Z]{1,2}$/i,
      /^--\s+/i,
      /^It was just that/i,
      /^Book contents/i,
      /^Frontmatter/i,
      /^JavaScript is disabled/i,
      /^Advanced embedding/i
    ]
    
    const isPoorTitle = poorTitlePatterns.some(pattern => pattern.test(item.title))
    const summary = item.summary || item.whyItMatters || ''
    
    if (isPoorTitle && summary && summary.length > 20) {
      // Extract meaningful sentence from summary
      const skipPrefixes = [
        'book contents', 'frontmatter', 'introduction', 'chapter', 'page',
        'javascript is disabled', 'sign in', 'check out', 'advanced embedding',
        'summary', 'abstract', 'table of contents'
      ]
      
      const sentences = summary.split(/[.!?]+/).map((s: string) => s.trim()).filter((s: string) => {
        const sLower = s.toLowerCase()
        return s.length > 10 && !skipPrefixes.some(prefix => sLower.startsWith(prefix))
      })
      
      let improvedTitle = item.title
      for (const sentence of sentences) {
        if (sentence.length > 15 && sentence.length < 100) {
          const meaningfulWords = sentence.split(' ').filter((w: string) => 
            w.length > 2 && 
            !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'a', 'an'].includes(w.toLowerCase())
          )
          if (meaningfulWords.length >= 4) {
            improvedTitle = sentence.charAt(0).toUpperCase() + sentence.slice(1)
            if (improvedTitle.length > 80) {
              const words = improvedTitle.split(' ')
              improvedTitle = words.slice(0, 10).join(' ')
            }
            break
          }
        }
      }
      
      if (improvedTitle !== item.title) {
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: { title: improvedTitle }
        })
        console.log(`   ✅ Title fixed: "${improvedTitle}"`)
        titleFixed++
      }
    }
    
    // 2. Retry ERROR heroes with Wikimedia or create missing heroes
    const hero = item.heroRecord
    const needsHero = !hero || hero.status === 'ERROR' || (hero.imageUrl && hero.imageUrl.includes('favicon'))
    
    if (needsHero) {
      const titleForSearch = item.title || 'Israel'
      
      // Extract search terms
      const searchTerms = titleForSearch
        .split(/\s+/)
        .filter(word => word.length > 3 && !['the', 'and', 'for', 'with', 'from', 'about'].includes(word.toLowerCase()))
        .slice(0, 3)
        .join(' ')
      
      const query = searchTerms || titleForSearch.substring(0, 50)
      console.log(`   🔍 Searching Wikimedia for: "${query}"`)
      
      try {
        // Call Wikimedia API directly (not through our API)
        const searchUrl = new URL('https://commons.wikimedia.org/w/api.php')
        searchUrl.searchParams.set('action', 'query')
        searchUrl.searchParams.set('format', 'json')
        searchUrl.searchParams.set('list', 'search')
        searchUrl.searchParams.set('srsearch', query)
        searchUrl.searchParams.set('srnamespace', '6') // File namespace
        searchUrl.searchParams.set('srlimit', '5')
        searchUrl.searchParams.set('srprop', 'timestamp|snippet')
        
        const searchResponse = await fetch(searchUrl.toString(), {
          headers: {
            'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)',
            'Accept': 'application/json'
          },
          signal: AbortSignal.timeout(10000)
        })
        
        let imageUrl: string | null = null
        let source: string = 'skeleton'
        
        if (searchResponse.ok) {
          const searchData = await searchResponse.json()
          if (searchData.query?.search && searchData.query.search.length > 0) {
            const firstResult = searchData.query.search[0]
            const imageTitle = firstResult.title
            
            // Get actual image URL using imageinfo API
            const imageInfoUrl = new URL('https://commons.wikimedia.org/w/api.php')
            imageInfoUrl.searchParams.set('action', 'query')
            imageInfoUrl.searchParams.set('format', 'json')
            imageInfoUrl.searchParams.set('titles', imageTitle)
            imageInfoUrl.searchParams.set('prop', 'imageinfo')
            imageInfoUrl.searchParams.set('iiprop', 'url|thumburl')
            imageInfoUrl.searchParams.set('iiurlwidth', '800')
            
            const imageInfoResponse = await fetch(imageInfoUrl.toString(), {
              headers: {
                'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)',
                'Accept': 'application/json'
              },
              signal: AbortSignal.timeout(10000)
            })
            
            if (imageInfoResponse.ok) {
              const imageInfoData = await imageInfoResponse.json()
              const pages = imageInfoData.query?.pages
              if (pages) {
                const page = Object.values(pages)[0] as any
                const imageInfo = page?.imageinfo?.[0]
                if (imageInfo) {
                  imageUrl = imageInfo.thumburl || imageInfo.url
                  source = 'wikimedia'
                  console.log(`   ✅ Found Wikimedia image: ${imageUrl.substring(0, 60)}...`)
                }
              }
            }
          }
        }
        
        // Fallback to SVG placeholder if Wikimedia fails
        if (!imageUrl) {
          imageUrl = generateSVGPlaceholder(titleForSearch, 800, 400)
          source = 'skeleton'
          console.log(`   ⚠️  No Wikimedia image, using SVG placeholder`)
        }
        
        // Upsert hero
        await prisma.hero.upsert({
          where: { contentId: item.id },
          update: {
            imageUrl: imageUrl,
            status: 'READY',
            sourceUrl: item.sourceUrl || item.canonicalUrl || '',
            errorCode: null,
            errorMessage: null
          },
          create: {
            contentId: item.id,
            title: titleForSearch,
            imageUrl: imageUrl,
            status: 'READY',
            sourceUrl: item.sourceUrl || item.canonicalUrl || ''
          }
        })
        
        if (hero) {
          console.log(`   ✅ Hero retried and updated`)
          heroRetried++
        } else {
          console.log(`   ✅ Hero created`)
          heroCreated++
        }
      } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}`)
        // Still create a placeholder hero
        const placeholderUrl = generateSVGPlaceholder(titleForSearch, 800, 400)
        await prisma.hero.upsert({
          where: { contentId: item.id },
          update: {
            imageUrl: placeholderUrl,
            status: 'READY',
            sourceUrl: item.sourceUrl || item.canonicalUrl || '',
            errorCode: null,
            errorMessage: null
          },
          create: {
            contentId: item.id,
            title: titleForSearch,
            imageUrl: placeholderUrl,
            status: 'READY',
            sourceUrl: item.sourceUrl || item.canonicalUrl || ''
          }
        })
        if (hero) {
          heroRetried++
        } else {
          heroCreated++
        }
      }
    }
  }
  
  console.log(`\n=== Summary ===`)
  console.log(`Titles fixed: ${titleFixed}`)
  console.log(`Heroes retried: ${heroRetried}`)
  console.log(`Heroes created: ${heroCreated}`)
  console.log(`\n✅ Complete!`)
}

const patchHandle = process.argv[2] || 'israel'
fixTitlesAndRetryHeroes(patchHandle)
  .catch(console.error)
  .finally(() => prisma.$disconnect())

