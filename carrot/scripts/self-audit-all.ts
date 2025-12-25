/**
 * Combined self-auditing script for hero images and grammar quality
 * Runs both audits and provides a comprehensive report
 * 
 * Usage: npx tsx scripts/self-audit-all.ts [patchHandle] [--limit=N] [--dry-run]
 */

import { auditAndFixHeroImages } from './self-audit-hero-images'
import { auditAndFixGrammarQuality } from './self-audit-grammar-quality'

async function main() {
  const args = process.argv.slice(2)
  const patchHandle = args[0] || 'israel'
  const limitArg = args.find(arg => arg.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : undefined
  const dryRun = args.includes('--dry-run')

  console.log(`\n🔍 Starting comprehensive self-audit for patch: ${patchHandle}\n`)
  console.log(`   Limit: ${limit || 'unlimited'}`)
  console.log(`   Dry run: ${dryRun ? 'YES' : 'NO'}\n`)

  try {
    // Run hero image audit
    console.log('='.repeat(60))
    console.log('STEP 1: Hero Image Audit')
    console.log('='.repeat(60))
    const heroResult = await auditAndFixHeroImages(patchHandle, limit, dryRun)

    // Run grammar quality audit
    console.log('\n' + '='.repeat(60))
    console.log('STEP 2: Grammar & Quality Audit')
    console.log('='.repeat(60))
    const grammarResult = await auditAndFixGrammarQuality(patchHandle, limit, dryRun)

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('FINAL SUMMARY')
    console.log('='.repeat(60))
    console.log(`\n📊 Hero Images:`)
    console.log(`   Total: ${heroResult.total}`)
    console.log(`   Missing: ${heroResult.missing}`)
    console.log(`   Placeholder: ${heroResult.placeholder}`)
    console.log(`   Fixed: ${heroResult.fixed}`)
    console.log(`   Failed: ${heroResult.failed}`)

    console.log(`\n📊 Grammar & Quality:`)
    console.log(`   Total: ${grammarResult.total}`)
    console.log(`   Poor grammar: ${grammarResult.poorGrammar}`)
    console.log(`   Low quality: ${grammarResult.lowQuality}`)
    console.log(`   Fixed: ${grammarResult.fixed}`)
    console.log(`   Failed: ${grammarResult.failed}`)

    const totalFixed = heroResult.fixed + grammarResult.fixed
    const totalFailed = heroResult.failed + grammarResult.failed

    console.log(`\n✅ Total Fixed: ${totalFixed}`)
    console.log(`❌ Total Failed: ${totalFailed}`)

    if (totalFixed > 0) {
      console.log(`\n🎉 Successfully improved ${totalFixed} items!`)
    }
  } catch (error: any) {
    console.error('❌ Self-audit failed:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

