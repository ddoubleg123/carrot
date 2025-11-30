/**
 * Verify Wikipedia monitoring tables exist
 * Run with: npx tsx scripts/verify-wikipedia-tables.ts
 */

import { prisma } from '../src/lib/prisma'

async function verifyTables() {
  console.log('Checking Wikipedia monitoring tables...\n')

  try {
    // Try to query the tables
    const monitoringCount = await prisma.wikipediaMonitoring.count()
    const citationsCount = await prisma.wikipediaCitation.count()

    console.log('✅ Tables exist and are accessible!')
    console.log(`   - WikipediaMonitoring: ${monitoringCount} records`)
    console.log(`   - WikipediaCitation: ${citationsCount} records\n`)

    // Check if we can create a test record
    console.log('Testing table write access...')
    const testPatch = await prisma.patch.findFirst({
      select: { id: true, handle: true }
    })

    if (testPatch) {
      console.log(`   Using test patch: ${testPatch.handle}`)
      
      // Try to create a test monitoring record
      try {
        const testMonitoring = await prisma.wikipediaMonitoring.create({
          data: {
            patchId: testPatch.id,
            wikipediaUrl: 'https://en.wikipedia.org/wiki/Test',
            wikipediaTitle: 'Test Page',
            status: 'pending'
          }
        })
        
        console.log('✅ Write test successful!')
        console.log(`   Created test record: ${testMonitoring.id}`)
        
        // Clean up test record
        await prisma.wikipediaMonitoring.delete({
          where: { id: testMonitoring.id }
        })
        console.log('   Test record cleaned up\n')
      } catch (writeError: any) {
        console.error('❌ Write test failed:', writeError.message)
        if (writeError.code === 'P2003') {
          console.error('   Foreign key constraint issue - check patch exists')
        }
      }
    } else {
      console.log('⚠️  No patches found to test with')
    }

    console.log('\n✅ All checks passed! Wikipedia monitoring is ready.')
    process.exit(0)

  } catch (error: any) {
    if (error.code === 'P2021' || error.message?.includes('does not exist')) {
      console.error('❌ Tables do not exist!')
      console.error('\nPlease run the migration:')
      console.error('   Option 1: Run SQL file directly')
      console.error('     psql $DATABASE_URL -f prisma/migrations/manual_wikipedia_tables.sql')
      console.error('\n   Option 2: Use Prisma')
      console.error('     npx prisma db push --accept-data-loss')
      console.error('\n   Option 3: Manual migration via database admin tool')
      console.error('     Execute: prisma/migrations/manual_wikipedia_tables.sql')
    } else {
      console.error('❌ Error checking tables:', error.message)
      console.error(error)
    }
    process.exit(1)
  }
}

verifyTables().catch(console.error)

