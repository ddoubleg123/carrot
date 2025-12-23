/**
 * Backfill hero images with real images (Wikimedia or AI) instead of placeholders
 */

import { prisma } from '@/lib/prisma'
import { generateSVGPlaceholder } from '@/lib/media/fallbackImages'

async function backfillHeroImages() {
  console.log('=== BACKFILLING HERO IMAGES ===\n')
  
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true }
  })
  
  if (!patch) {
    console.error('Patch "israel" not found')
    return
  }
  
  // Get all heroes with SVG placeholders
  const heroes = await prisma.hero.findMany({
    where: {
      content: {
        patchId: patch.id
      },
      OR: [
        { imageUrl: { startsWith: 'data:image/svg' } },
        { imageUrl: null }
      ]
    },
    include: {
      content: {
        select: {
          id: true,
          title: true,
          summary: true,
          sourceUrl: true
        }
      }
    }
  })
  
  console.log(`Found ${heroes.length} heroes with placeholders to backfill\n`)
  
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://carrot-app.onrender.com'
  let wikimediaSuccess = 0
  let aiSuccess = 0
  let failed = 0
  
  for (let i = 0; i < heroes.length; i++) {
    const hero = heroes[i]
    const content = hero.content
    const title = content.title || 'Israel'
    
    console.log(`[${i + 1}/${heroes.length}] Processing: ${content.id}`)
    console.log(`   Title: "${title.substring(0, 60)}"`)
    
    let imageUrl: string | null = null
    let source: string = 'skeleton'
    
    // Step 1: Try Wikimedia
    try {
      const searchTerms = title
        .split(/\s+/)
        .filter(word => word.length > 3 && !['the', 'and', 'for', 'with', 'from', 'about'].includes(word.toLowerCase()))
        .slice(0, 3)
        .join(' ')
      
      const query = searchTerms || title.substring(0, 50)
      console.log(`   🔍 Searching Wikimedia: "${query}"`)
      
      const searchUrl = new URL('https://commons.wikimedia.org/w/api.php')
      searchUrl.searchParams.set('action', 'query')
      searchUrl.searchParams.set('format', 'json')
      searchUrl.searchParams.set('list', 'search')
      searchUrl.searchParams.set('srsearch', query)
      searchUrl.searchParams.set('srnamespace', '6')
      searchUrl.searchParams.set('srlimit', '5')
      
      const searchResponse = await fetch(searchUrl.toString(), {
        headers: {
          'User-Agent': 'CarrotBot/1.0 (https://carrot-app.onrender.com)',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      })
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json()
        if (searchData.query?.search && searchData.query.search.length > 0) {
          const firstResult = searchData.query.search[0]
          const imageTitle = firstResult.title
          
          // Get actual image URL
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
                wikimediaSuccess++
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.log(`   ⚠️  Wikimedia search failed: ${error.message}`)
    }
    
    // Step 2: Try AI generation if Wikimedia failed
    if (!imageUrl) {
      try {
        console.log(`   🎨 Trying AI generation...`)
        const aiResponse = await fetch(`${baseUrl}/api/ai/generate-hero-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-key': process.env.INTERNAL_API_KEY || ''
          },
          body: JSON.stringify({
            title: title,
            description: (content.summary || '').substring(0, 200),
            topic: 'research',
            style: 'editorial'
          }),
          signal: AbortSignal.timeout(30000) // 30s for AI
        })
        
        if (aiResponse.ok) {
          const aiResult = await aiResponse.json()
          if (aiResult.success && aiResult.imageUrl) {
            imageUrl = aiResult.imageUrl
            source = 'ai'
            console.log(`   ✅ AI image generated: ${imageUrl.substring(0, 60)}...`)
            aiSuccess++
          }
        }
      } catch (error: any) {
        console.log(`   ⚠️  AI generation failed: ${error.message}`)
      }
    }
    
    // Step 3: Update hero record
    if (imageUrl) {
      await prisma.hero.update({
        where: { id: hero.id },
        data: {
          imageUrl: imageUrl,
          status: 'READY',
          sourceUrl: content.sourceUrl || ''
        }
      })
      console.log(`   ✅ Updated hero with ${source} image`)
    } else {
      // Keep placeholder but mark as tried
      console.log(`   ⚠️  No image found, keeping placeholder`)
      failed++
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  
  console.log(`\n=== SUMMARY ===`)
  console.log(`Wikimedia success: ${wikimediaSuccess}`)
  console.log(`AI success: ${aiSuccess}`)
  console.log(`Failed: ${failed}`)
  console.log(`Total processed: ${heroes.length}`)
}

backfillHeroImages().catch(console.error)

