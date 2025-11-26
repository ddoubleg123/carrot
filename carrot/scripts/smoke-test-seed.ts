/**
 * Smoke test seed
 * Uses two deterministic, paywall-free URLs to avoid flaky CI
 */

import { prisma } from '../src/lib/prisma'

const SMOKE_TEST_URLS = [
  'https://www.basketball-reference.com/boxscores/202401010LAL.html', // Basketball-Reference game recap
  'https://www.nba.com/news' // NBA.com article (homepage, always accessible)
]

export async function seedSmokeTest(patchId: string) {
  console.log('[Smoke Test Seed] Seeding smoke test URLs for patch:', patchId)
  
  for (const url of SMOKE_TEST_URLS) {
    try {
      // Check if already exists
      const existing = await prisma.discoveredContent.findFirst({
        where: {
          patchId,
          canonicalUrl: url
        }
      })
      
      if (existing) {
        console.log(`[Smoke Test Seed] ✅ Already exists: ${url}`)
        continue
      }
      
      // Create discovered content
      await prisma.discoveredContent.create({
        data: {
          patchId,
          canonicalUrl: url,
          sourceUrl: url,
          title: `Smoke Test: ${new URL(url).hostname}`,
          status: 'ready',
          textContent: 'Smoke test content for CI validation',
          relevanceScore: 0.5,
          qualityScore: 0.5
        }
      })
      
      console.log(`[Smoke Test Seed] ✅ Created: ${url}`)
    } catch (error) {
      console.error(`[Smoke Test Seed] ❌ Failed to seed ${url}:`, error)
    }
  }
  
  console.log('[Smoke Test Seed] ✅ Smoke test seeding complete')
}

// CLI usage
if (require.main === module) {
  const patchId = process.argv[2]
  if (!patchId) {
    console.error('Usage: tsx scripts/smoke-test-seed.ts <patch-id>')
    process.exit(1)
  }
  
  seedSmokeTest(patchId)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

