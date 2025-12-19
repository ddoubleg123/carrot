/**
 * Fix hero titles and images
 * 
 * Issues to fix:
 * 1. Poor titles (DOIs, "Untitled", "Book Part", etc.)
 * 2. Missing hero images (placeholder images)
 * 
 * Strategy:
 * - For items with Hero records: Use Hero.title if it's better than DiscoveredContent.title
 * - For items without Hero records or with placeholder images: Trigger enrichment
 * - Improve title extraction to avoid DOIs and generic terms
 */

import { prisma } from '@/lib/prisma'
import { enrichContentId } from '@/lib/enrichment/worker'

// Patterns that indicate poor titles
const POOR_TITLE_PATTERNS = [
  /^10\.\d{4,}\//, // DOI pattern (e.g., "10.1017/chol9780521772488")
  /^untitled$/i,
  /^book part$/i,
  /^article$/i,
  /^page$/i,
  /^document$/i,
  /^content$/i,
  /^untitled content$/i,
  /^https?:\/\//, // URLs as titles
  /^[a-z0-9]{8,}$/i, // Random alphanumeric strings
]

function isPoorTitle(title: string): boolean {
  if (!title || title.trim().length < 3) return true
  return POOR_TITLE_PATTERNS.some(pattern => pattern.test(title.trim()))
}

function isBetterTitle(newTitle: string, oldTitle: string): boolean {
  if (!newTitle || newTitle.trim().length < 3) return false
  if (isPoorTitle(newTitle)) return false
  if (isPoorTitle(oldTitle)) return true // Any non-poor title is better than a poor one
  // Prefer longer, more descriptive titles
  return newTitle.length > oldTitle.length && newTitle.split(' ').length >= 3
}

function isPlaceholderImage(imageUrl: string | null | undefined): boolean {
  if (!imageUrl) return true
  const url = imageUrl.toLowerCase()
  return url.includes('via.placeholder.com') || 
         url.includes('placeholder') ||
         url.includes('favicon') ||
         url.includes('google.com/s2/favicons')
}

async function fixHeroTitlesAndImages() {
  console.log('🔧 Starting hero title and image fix...\n')

  // Get all DiscoveredContent items
  const allContent = await prisma.discoveredContent.findMany({
    include: {
      heroRecord: true
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  console.log(`📊 Found ${allContent.length} DiscoveredContent items\n`)

  let titleFixed = 0
  let imageNeedsFix = 0
  let imageFixed = 0
  let errors = 0

  for (const item of allContent) {
    try {
      let needsUpdate = false
      const updates: any = {}

      // Check title
      const currentTitle = item.title
      const heroTitle = item.heroRecord?.title
      
      if (isPoorTitle(currentTitle)) {
        if (heroTitle && !isPoorTitle(heroTitle)) {
          // Use Hero title if it's better
          updates.title = heroTitle
          needsUpdate = true
          titleFixed++
          console.log(`✅ Title fix: "${currentTitle.substring(0, 50)}" → "${heroTitle.substring(0, 50)}"`)
        } else if (item.sourceUrl) {
          // Try to extract better title from URL
          try {
            const url = new URL(item.sourceUrl)
            const pathParts = url.pathname.split('/').filter(p => p)
            const lastPart = pathParts[pathParts.length - 1]
            
            if (lastPart && lastPart.length > 5 && !isPoorTitle(lastPart)) {
              // Decode URL-encoded title
              const decoded = decodeURIComponent(lastPart.replace(/[-_]/g, ' '))
              if (decoded.length > 5 && decoded.length < 200) {
                updates.title = decoded
                needsUpdate = true
                titleFixed++
                console.log(`✅ Title from URL: "${currentTitle.substring(0, 50)}" → "${decoded.substring(0, 50)}"`)
              }
            }
          } catch (e) {
            // URL parsing failed, skip
          }
        }
      } else if (heroTitle && isBetterTitle(heroTitle, currentTitle)) {
        // Hero title is better even if current isn't "poor"
        updates.title = heroTitle
        needsUpdate = true
        titleFixed++
        console.log(`✅ Title improvement: "${currentTitle.substring(0, 50)}" → "${heroTitle.substring(0, 50)}"`)
      }

      // Check image
      const hasHero = !!item.heroRecord
      const heroImageUrl = item.heroRecord?.imageUrl
      const heroJson = item.hero as any // JSON field on DiscoveredContent
      const jsonImageUrl = heroJson?.url

      const currentImageUrl = heroImageUrl || jsonImageUrl
      const needsImageFix = !hasHero || isPlaceholderImage(currentImageUrl)

      if (needsImageFix) {
        imageNeedsFix++
        console.log(`🖼️  Image needs fix for: "${item.title.substring(0, 50)}" (${hasHero ? 'has hero but placeholder' : 'no hero'})`)
        
        // Trigger enrichment (async, don't await to avoid blocking)
        enrichContentId(item.id)
          .then(result => {
            if (result.ok) {
              imageFixed++
              console.log(`✅ Image generated for: "${item.title.substring(0, 50)}"`)
            } else {
              console.warn(`⚠️  Image generation failed for: "${item.title.substring(0, 50)}" - ${result.errorCode}`)
            }
          })
          .catch(err => {
            console.error(`❌ Error generating image for "${item.title.substring(0, 50)}":`, err.message)
          })
      }

      // Update title if needed
      if (needsUpdate) {
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: updates
        })
      }

    } catch (error: any) {
      errors++
      console.error(`❌ Error processing item ${item.id}:`, error.message)
    }
  }

  console.log('\n📊 Summary:')
  console.log(`   Titles fixed: ${titleFixed}`)
  console.log(`   Images needing fix: ${imageNeedsFix}`)
  console.log(`   Images being generated: ${imageNeedsFix} (check logs above for results)`)
  console.log(`   Errors: ${errors}`)
  console.log('\n✅ Hero title and image fix complete!')
  console.log('   Note: Image generation runs asynchronously. Check logs above for results.')
}

// Run if called directly
if (require.main === module) {
  fixHeroTitlesAndImages()
    .then(() => {
      console.log('\n✅ Script completed')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error)
      process.exit(1)
    })
}

export { fixHeroTitlesAndImages }

