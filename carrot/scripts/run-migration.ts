/**
 * Run Wikipedia monitoring tables migration
 * Executes the SQL migration file directly via Prisma
 * Run with: npx tsx scripts/run-migration.ts
 */

import { prisma } from '../src/lib/prisma'
import * as fs from 'fs'
import * as path from 'path'

async function runMigration() {
  console.log('Running Wikipedia monitoring tables migration...\n')

  try {
    // Read the SQL file
    const sqlPath = path.resolve(process.cwd(), 'prisma/migrations/manual_wikipedia_tables.sql')
    console.log(`Reading migration file: ${sqlPath}`)
    
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`Migration file not found: ${sqlPath}`)
    }

    const sql = fs.readFileSync(sqlPath, 'utf-8')
    console.log(`Migration file size: ${sql.length} bytes\n`)

    // Parse SQL more carefully - handle DO blocks and multi-line statements
    // Remove single-line comments but preserve structure
    let cleanSql = sql.replace(/--.*$/gm, '').trim()
    
    // Split by semicolon, but handle DO blocks specially
    const statements: string[] = []
    
    // First, extract DO blocks (they contain $$ delimiters)
    const doBlockRegex = /DO\s+\$\$\s*([\s\S]*?)\$\$/g
    const doBlocks: string[] = []
    let match
    let lastIndex = 0
    
    while ((match = doBlockRegex.exec(cleanSql)) !== null) {
      // Add everything before the DO block as regular statements
      const beforeDo = cleanSql.substring(lastIndex, match.index)
      const beforeStatements = beforeDo.split(';').map(s => s.trim()).filter(s => s.length > 10)
      statements.push(...beforeStatements)
      
      // Add the DO block as a single statement
      const doBlock = `DO $$ ${match[1]} $$;`
      statements.push(doBlock)
      
      lastIndex = match.index + match[0].length
    }
    
    // Add remaining statements after last DO block
    const remaining = cleanSql.substring(lastIndex)
    const remainingStatements = remaining.split(';').map(s => s.trim()).filter(s => s.length > 10)
    statements.push(...remainingStatements)

    console.log(`Found ${statements.length} SQL statements to execute\n`)

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      
      // Skip empty or very short statements
      if (statement.length < 10) continue

      console.log(`Executing statement ${i + 1}/${statements.length}...`)
      const preview = statement.substring(0, 80).replace(/\s+/g, ' ')
      console.log(`  ${preview}...`)

      try {
        await prisma.$executeRawUnsafe(statement)
        console.log(`  ✅ Statement ${i + 1} executed successfully\n`)
      } catch (error: any) {
        // Check if it's a "table already exists" or "index already exists" error (which is fine)
        if (
          error.message?.includes('already exists') || 
          error.code === '42P07' ||
          error.meta?.code === '42P07'
        ) {
          console.log(`  ⚠️  Statement ${i + 1} skipped (already exists)\n`)
        } else {
          console.error(`  ❌ Statement ${i + 1} failed:`, error.message)
          throw error
        }
      }
    }

    console.log('✅ Migration completed!\n')

    // Verify tables exist
    console.log('Verifying tables...')
    const monitoringCount = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_name = 'wikipedia_monitoring'`
    )
    const citationsCount = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = 'public' AND table_name = 'wikipedia_citations'`
    )

    const monitoringExists = Number(monitoringCount[0]?.count || 0) > 0
    const citationsExists = Number(citationsCount[0]?.count || 0) > 0

    if (monitoringExists && citationsExists) {
      console.log('✅ Both tables verified successfully!')
      console.log('   - wikipedia_monitoring: exists')
      console.log('   - wikipedia_citations: exists\n')
      
      // Test table structure
      try {
        const testQuery = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
          `SELECT COUNT(*) as count FROM wikipedia_monitoring`
        )
        console.log(`✅ Table is accessible (${testQuery[0]?.count || 0} records)\n`)
      } catch (e: any) {
        console.error('❌ Table exists but not accessible:', e.message)
        process.exit(1)
      }
    } else {
      console.error('❌ Tables not found after migration!')
      console.error(`   - wikipedia_monitoring: ${monitoringExists ? 'exists' : 'missing'}`)
      console.error(`   - wikipedia_citations: ${citationsExists ? 'exists' : 'missing'}`)
      process.exit(1)
    }

    console.log('🎉 Migration successful! Wikipedia monitoring is ready to use.')
    process.exit(0)

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message)
    if (error.code) {
      console.error(`   Error code: ${error.code}`)
    }
    if (error.meta) {
      console.error(`   Details:`, error.meta)
    }
    console.error('\nFull error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

runMigration().catch(console.error)

