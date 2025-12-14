/**
 * Backfill Wikimedia images for all heroes on a patch
 * Finds content without Wikimedia images and attempts to find suitable images
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function backfillWikimediaHeroes(patchHandle: string) {
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3005'
  
  console.log(`🖼️  Backfilling Wikimedia Images for Patch: ${patchHandle}\n`)
  console.log(`Base URL: ${baseUrl}\n`)

  try {
    // Find the patch
    const patch = await prisma.patch.findUnique({
      where: { handle: patchHandle },
      select: { id: true, title: true, handle: true }
    })

    if (!patch) {
      console.error(`❌ Patch "${patchHandle}" not found`)
      return
    }

    console.log(`✅ Found patch: ${patch.title} (${patch.handle})\n`)

    // Find all content for this patch
    const allContent = await prisma.discoveredContent.findMany({
      where: { patchId: patch.id },
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        canonicalUrl: true
      }
    })

    console.log(`📊 Found ${allContent.length} content items\n`)

    // Get all heroes for this content
    const heroes = await prisma.hero.findMany({
      where: {
        contentId: { in: allContent.map(c => c.id) }
      },
      select: {
        id: true,
        contentId: true,
        imageUrl: true,
        title: true,
        status: true
      }
    })

    console.log(`📊 Found ${heroes.length} existing heroes\n`)

    // Identify heroes that need Wikimedia backfill
    // Skip if already has Wikimedia image
    // Include ERROR status heroes (they may have failed but can still get images)
    const needsBackfill = heroes.filter(hero => {
      const imageUrl = hero.imageUrl || ''
      const hasWikimedia = imageUrl.includes('wikimedia.org') || imageUrl.includes('upload.wikimedia.org')
      const isPlaceholder = imageUrl.includes('via.placeholder.com') || imageUrl.includes('placeholder')
      const isFavicon = imageUrl.includes('google.com/s2/favicons')
      const hasRealImage = imageUrl && !isPlaceholder && !isFavicon && !hasWikimedia
      
      // Need backfill if: not Wikimedia, and (placeholder or favicon or empty), and doesn't have a real image
      // Include both READY and ERROR status (ERROR heroes may have failed enrichment but can still get images)
      return !hasWikimedia && !hasRealImage && (isPlaceholder || isFavicon || !imageUrl) && 
             (hero.status === 'READY' || hero.status === 'ERROR')
    })

    console.log(`🔄 ${needsBackfill.length} heroes need Wikimedia backfill\n`)

    if (needsBackfill.length === 0) {
      console.log('✅ All heroes already have Wikimedia images or are not ready for backfill')
      return
    }

    let successCount = 0
    let failCount = 0
    let skipCount = 0

    // Process each hero
    for (let i = 0; i < needsBackfill.length; i++) {
      const hero = needsBackfill[i]
      const content = allContent.find(c => c.id === hero.contentId)
      
      if (!content) {
        console.log(`⚠️  [${i + 1}/${needsBackfill.length}] Content not found for hero ${hero.id}`)
        skipCount++
        continue
      }

      const title = content.title || hero.title || 'Untitled'
      console.log(`\n[${i + 1}/${needsBackfill.length}] Processing: "${title.substring(0, 60)}"`)

      try {
        // Extract search terms (same logic as enrichment worker)
        const searchTerms = title
          .split(/\s+/)
          .filter(word => word.length > 3 && !['the', 'and', 'for', 'with', 'from', 'about'].includes(word.toLowerCase()))
          .slice(0, 3)
          .join(' ')

        const query = searchTerms || title.substring(0, 50)
        console.log(`   Searching: "${query}"`)

        // Search Wikimedia
        const response = await fetch(`${baseUrl}/api/media/wikimedia-search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-key': process.env.INTERNAL_API_KEY || ''
          },
          body: JSON.stringify({
            query: query,
            limit: 5
          }),
          signal: AbortSignal.timeout(10000) // 10s timeout
        })

        if (!response.ok) {
          console.error(`   ❌ API Error: ${response.status}`)
          failCount++
          continue
        }

        const data = await response.json()

        if (!data.images || data.images.length === 0) {
          console.log(`   ⚠️  No images found - skipping`)
          skipCount++
          continue
        }

        // Use the first image
        const firstImage = data.images[0]
        const imageUrl = firstImage.url || firstImage.thumbnail

        if (!imageUrl) {
          console.log(`   ⚠️  No valid image URL - skipping`)
          skipCount++
          continue
        }

        // Verify it's a direct image URL
        const isDirectImage = imageUrl.includes('upload.wikimedia.org') ||
                             imageUrl.includes('Special:FilePath') ||
                             imageUrl.match(/\.(jpg|jpeg|png|gif|webp)/i)

        if (!isDirectImage) {
          console.log(`   ⚠️  URL doesn't look like a direct image - skipping`)
          skipCount++
          continue
        }

        // Update the hero with new image and set status to READY
        await prisma.hero.update({
          where: { id: hero.id },
          data: {
            imageUrl: imageUrl,
            status: 'READY', // Set to READY if it was ERROR
            updatedAt: new Date()
          }
        })

        // Also update DiscoveredContent.hero JSON field for compatibility
        await prisma.discoveredContent.update({
          where: { id: content.id },
          data: {
            hero: {
              url: imageUrl,
              source: 'wikimedia',
              license: 'fair-use',
              updatedAt: new Date().toISOString()
            } as any
          }
        })

        console.log(`   ✅ Updated with Wikimedia image`)
        console.log(`      ${imageUrl.substring(0, 80)}...`)
        successCount++

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (error: any) {
        console.error(`   ❌ Error: ${error.message}`)
        failCount++
      }
    }

    console.log(`\n\n📊 Backfill Summary:`)
    console.log(`   ✅ Success: ${successCount}`)
    console.log(`   ⚠️  Skipped: ${skipCount}`)
    console.log(`   ❌ Failed: ${failCount}`)
    console.log(`   📝 Total processed: ${needsBackfill.length}`)

    // Show some examples of updated heroes
    if (successCount > 0) {
      console.log(`\n✅ Successfully backfilled ${successCount} heroes with Wikimedia images!`)
      console.log(`   These heroes will now display Wikimedia images instead of placeholders`)
    }

  } catch (error: any) {
    console.error('❌ Backfill failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Get patch handle from command line or use default
const patchHandle = process.argv[2] || 'israel'

backfillWikimediaHeroes(patchHandle)
  .then(() => {
    console.log('\n✨ Backfill complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Backfill failed:', error)
    process.exit(1)
  })

