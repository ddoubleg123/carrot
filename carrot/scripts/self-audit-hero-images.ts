/**
 * Self-auditing script for hero images
 * Automatically detects missing or placeholder hero images and generates real ones
 * 
 * Usage: npx tsx scripts/self-audit-hero-images.ts [patchHandle] [--limit=N] [--dry-run]
 */

import { prisma } from '../src/lib/prisma'
import { HeroImagePipeline } from '../src/lib/discovery/hero-pipeline'

interface AuditResult {
  total: number
  missing: number
  placeholder: number
  fixed: number
  failed: number
  errors: Array<{ id: string; title: string; error: string }>
}

function isPlaceholderImage(imageUrl: string | null | undefined): boolean {
  if (!imageUrl) return true
  const urlLower = imageUrl.toLowerCase()
  return (
    urlLower.includes('via.placeholder.com') ||
    urlLower.includes('placeholder') ||
    imageUrl.startsWith('data:image/svg') ||
    urlLower.includes('skeleton')
  )
}

export async function auditAndFixHeroImages(
  patchHandle: string,
  limit?: number,
  dryRun: boolean = false
): Promise<AuditResult> {
  console.log(`\n🔍 Starting hero image audit for patch: ${patchHandle}\n`)

  // Find patch
  const patch = await prisma.patch.findUnique({
    where: { handle: patchHandle }
  })

  if (!patch) {
    throw new Error(`Patch not found: ${patchHandle}`)
  }

  // Find all discovered content items
  const items = await prisma.discoveredContent.findMany({
    where: {
      patchId: patch.id
    },
    select: {
      id: true,
      title: true,
      summary: true,
      hero: true,
      sourceUrl: true,
      metadata: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: limit || 100
  })

  console.log(`Found ${items.length} items to audit\n`)

  const result: AuditResult = {
    total: items.length,
    missing: 0,
    placeholder: 0,
    fixed: 0,
    failed: 0,
    errors: []
  }

  // Detect if running locally or on server
  // If NEXTAUTH_URL is localhost, use direct function calls instead of HTTP
  const baseUrl = process.env.NEXTAUTH_URL || 'https://carrot-app.onrender.com'
  const isLocal = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')
  
  // For local development, we'll use direct imports instead of HTTP
  let heroPipeline: HeroImagePipeline | null = null
  if (!isLocal) {
    heroPipeline = new HeroImagePipeline(baseUrl)
  }

  for (const item of items) {
    try {
      // Check hero image status
      const heroJson = item.hero as any
      const heroUrl = heroJson?.url
      const heroSource = heroJson?.source

      const hasNoHero = !heroUrl
      const hasPlaceholder = heroUrl && isPlaceholderImage(heroUrl)

      if (!hasNoHero && !hasPlaceholder) {
        // Has a real hero image, skip
        continue
      }

      if (hasNoHero) {
        result.missing++
        console.log(`❌ Missing hero: "${item.title.substring(0, 50)}"`)
      } else if (hasPlaceholder) {
        result.placeholder++
        console.log(`⚠️  Placeholder hero: "${item.title.substring(0, 50)}"`)
      }

      if (dryRun) {
        console.log(`   [DRY RUN] Would generate hero image for: ${item.id}`)
        continue
      }

      // Generate hero image
      console.log(`   🎨 Generating hero image...`)
      let heroResult
      
      if (isLocal) {
        // Use enrichment worker directly when running locally
        console.log(`   [Local] Using enrichment worker directly...`)
        const { enrichContentId } = await import('../src/lib/enrichment/worker')
        const enrichmentResult = await enrichContentId(item.id)
        
        if (enrichmentResult.ok) {
          // Get the hero from the Hero table
          const heroRecord = await prisma.hero.findUnique({
            where: { contentId: item.id },
            select: { imageUrl: true }
          })
          
          if (heroRecord?.imageUrl) {
            const urlLower = heroRecord.imageUrl.toLowerCase()
            const source = urlLower.includes('wikimedia') ? 'wikimedia' : 
                          urlLower.includes('placeholder') || urlLower.startsWith('data:image/svg') ? 'skeleton' : 'ai'
            
            heroResult = {
              url: heroRecord.imageUrl,
              source: source as 'ai' | 'wikimedia' | 'skeleton',
              width: 1280,
              height: 720
            }
          } else {
            heroResult = null
          }
        } else {
          heroResult = null
        }
      } else {
        // Use HTTP API when running on server
        heroResult = await heroPipeline!.assignHero({
          title: item.title,
          summary: item.summary || '',
          topic: patchHandle
        })
      }

      if (heroResult && heroResult.url) {
        // Update both the JSON hero field AND the Hero table
        // First update the JSON field
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: {
            hero: {
              url: heroResult.url,
              source: heroResult.source,
              license: heroResult.source === 'ai' ? 'generated' : 'source',
              enrichedAt: new Date().toISOString(),
              origin: 'self-audit'
            } as any
          }
        })

        // Also update/create Hero table record (preferred source for API)
        try {
          await prisma.hero.upsert({
            where: { contentId: item.id },
            create: {
              contentId: item.id,
              title: item.title,
              excerpt: item.summary || null,
              imageUrl: heroResult.url,
              sourceUrl: item.sourceUrl || '',
              status: 'READY'
            },
            update: {
              imageUrl: heroResult.url,
              status: 'READY',
              updatedAt: new Date()
            }
          })
          console.log(`   ✅ Hero table updated`)
        } catch (heroTableError: any) {
          console.warn(`   ⚠️  Hero table update failed (non-critical): ${heroTableError.message}`)
          // Continue anyway - JSON field update is sufficient
        }

        result.fixed++
        console.log(`   ✅ Fixed! Source: ${heroResult.source}, URL: ${heroResult.url.substring(0, 60)}...`)
      } else {
        result.failed++
        console.log(`   ❌ Failed to generate hero image`)
      }
    } catch (error: any) {
      result.failed++
      result.errors.push({
        id: item.id,
        title: item.title,
        error: error.message || 'Unknown error'
      })
      console.error(`   ❌ Error: ${error.message}`)
    }
  }

  return result
}

async function main() {
  const args = process.argv.slice(2)
  const patchHandle = args[0] || 'israel'
  const limitArg = args.find(arg => arg.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined
  const dryRun = args.includes('--dry-run')

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n')
  }

  try {
    const result = await auditAndFixHeroImages(patchHandle, limit, dryRun)

    console.log(`\n📊 Audit Summary:`)
    console.log(`   Total items: ${result.total}`)
    console.log(`   Missing heroes: ${result.missing}`)
    console.log(`   Placeholder heroes: ${result.placeholder}`)
    console.log(`   Fixed: ${result.fixed}`)
    console.log(`   Failed: ${result.failed}`)
    if (result.errors.length > 0) {
      console.log(`\n❌ Errors:`)
      result.errors.forEach(err => {
        console.log(`   - ${err.title}: ${err.error}`)
      })
    }
  } catch (error: any) {
    console.error('❌ Audit failed:', error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  main()
}

