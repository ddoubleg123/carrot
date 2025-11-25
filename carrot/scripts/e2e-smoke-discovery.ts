/**
 * E2E Smoke Test for Discovery System
 * 
 * Tests:
 * 1. Start discovery run for "chicago-bulls"
 * 2. Wait until ≥ 20 sources saved
 * 3. Trigger hero sync
 * 4. Assert ≥ 10 heroes created with textLength>0
 */

import { prisma } from '../src/lib/prisma'

const PATCH_HANDLE = 'chicago-bulls'
const MIN_SOURCES = 20
const MIN_HEROES = 10
const TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function checkSourcesCount(patchId: string): Promise<number> {
  return await prisma.discoveredContent.count({
    where: { patchId }
  })
}

async function checkHeroesCount(patchId: string): Promise<number> {
  return await prisma.hero.count({
    where: {
      content: {
        patchId
      },
      status: 'READY'
    }
  })
}

async function triggerHeroSync(patchHandle: string) {
  const response = await fetch(`http://localhost:3005/api/maintenance/sync-heroes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      patchSlug: patchHandle,
      limit: 200,
      concurrency: 5
    })
  })
  
  if (!response.ok) {
    throw new Error(`Hero sync failed: ${response.statusText}`)
  }
  
  return await response.json()
}

async function startDiscoveryRun(patchHandle: string) {
  const response = await fetch(`http://localhost:3005/api/patches/${patchHandle}/start-discovery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  })
  
  if (!response.ok) {
    throw new Error(`Failed to start discovery: ${response.statusText}`)
  }
  
  return await response.json()
}

async function main() {
  console.log('🧪 Starting E2E smoke test for discovery system...\n')
  
  try {
    // Step 1: Find or verify patch
    const patch = await prisma.patch.findUnique({
      where: { handle: PATCH_HANDLE },
      select: { id: true, handle: true, title: true }
    })
    
    if (!patch) {
      throw new Error(`Patch "${PATCH_HANDLE}" not found`)
    }
    
    console.log(`✅ Found patch: ${patch.title} (${patch.id})`)
    
    // Step 2: Start discovery run
    console.log('\n📡 Starting discovery run...')
    const runResult = await startDiscoveryRun(PATCH_HANDLE)
    console.log(`✅ Discovery run started: ${runResult.runId || 'N/A'}`)
    
    // Step 3: Wait for sources to be saved
    console.log(`\n⏳ Waiting for ≥${MIN_SOURCES} sources to be saved...`)
    const startTime = Date.now()
    let sourcesCount = 0
    
    while (sourcesCount < MIN_SOURCES && (Date.now() - startTime) < TIMEOUT_MS) {
      sourcesCount = await checkSourcesCount(patch.id)
      console.log(`   Current sources: ${sourcesCount}/${MIN_SOURCES}`)
      
      if (sourcesCount < MIN_SOURCES) {
        await sleep(5000) // Wait 5 seconds
      }
    }
    
    if (sourcesCount < MIN_SOURCES) {
      throw new Error(`Timeout: Only ${sourcesCount} sources saved (expected ≥${MIN_SOURCES})`)
    }
    
    console.log(`✅ ${sourcesCount} sources saved!`)
    
    // Step 4: Trigger hero sync
    console.log('\n🔄 Triggering hero sync...')
    const syncResult = await triggerHeroSync(PATCH_HANDLE)
    console.log(`✅ Hero sync completed:`, {
      processed: syncResult.processed,
      created: syncResult.createdHeroes,
      skipped: syncResult.skipped,
      failed: syncResult.failed
    })
    
    // Step 5: Wait a bit for heroes to be created
    await sleep(3000)
    
    // Step 6: Check heroes count
    const heroesCount = await checkHeroesCount(patch.id)
    console.log(`\n📊 Heroes created: ${heroesCount}`)
    
    if (heroesCount < MIN_HEROES) {
      throw new Error(`Only ${heroesCount} heroes created (expected ≥${MIN_HEROES})`)
    }
    
    // Step 7: Verify heroes have text content
    const heroesWithText = await prisma.hero.count({
      where: {
        content: {
          patchId: patch.id,
          textContent: {
            not: null
          }
        },
        status: 'READY'
      }
    })
    
    console.log(`📝 Heroes with text content: ${heroesWithText}`)
    
    if (heroesWithText < MIN_HEROES) {
      throw new Error(`Only ${heroesWithText} heroes have text content (expected ≥${MIN_HEROES})`)
    }
    
    console.log('\n✅ E2E smoke test PASSED!')
    console.log(`   - Sources saved: ${sourcesCount}`)
    console.log(`   - Heroes created: ${heroesCount}`)
    console.log(`   - Heroes with text: ${heroesWithText}`)
    
    process.exit(0)
  } catch (error) {
    console.error('\n❌ E2E smoke test FAILED:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error)
}

export { main }

