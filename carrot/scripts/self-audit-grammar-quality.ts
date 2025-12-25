/**
 * Self-auditing script for grammar and content quality
 * Automatically detects poor grammar/content quality and re-processes with DeepSeek
 * 
 * Usage: npx tsx scripts/self-audit-grammar-quality.ts [patchHandle] [--limit=N] [--dry-run] [--min-quality=60]
 */

import { prisma } from '../src/lib/prisma'

interface AuditResult {
  total: number
  poorGrammar: number
  lowQuality: number
  fixed: number
  failed: number
  errors: Array<{ id: string; title: string; error: string }>
}

function detectGrammarIssues(text: string): string[] {
  const issues: string[] = []
  
  // Common grammar issues to detect
  const patterns = [
    { pattern: /\b(their|there|they're)\b.*\b(their|there|they're)\b/i, issue: 'Confused their/there/they\'re' },
    { pattern: /\b(your|you're)\b.*\b(your|you're)\b/i, issue: 'Confused your/you\'re' },
    { pattern: /\b(its|it's)\b.*\b(its|it's)\b/i, issue: 'Confused its/it\'s' },
    { pattern: /[.!?]\s+[a-z]/, issue: 'Missing capitalization after sentence' },
    { pattern: /\b\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+[^.!?]/, issue: 'Run-on sentence (10+ words without punctuation)' },
    { pattern: /\b(a|an)\s+[aeiouAEIOU]/, issue: 'Incorrect article usage' },
    { pattern: /[a-z][A-Z]/, issue: 'Missing space between words' },
    { pattern: /\s{3,}/, issue: 'Multiple consecutive spaces' },
    { pattern: /[a-zA-Z]\s*,\s*[a-zA-Z]/, issue: 'Missing space after comma' }
  ]

  for (const { pattern, issue } of patterns) {
    if (pattern.test(text)) {
      issues.push(issue)
    }
  }

  return issues
}

function hasPoorQuality(summary: string | null, keyPoints: any[] | null): boolean {
  if (!summary || summary.length < 50) return true
  
  // Check for common quality issues
  const qualityIssues = [
    summary.includes('undefined'),
    summary.includes('null'),
    summary.includes('[object Object]'),
    summary.includes('...'),
    summary.length < 100 && !summary.includes('.'),
    summary.split('.').length < 2 // Less than 2 sentences
  ]

  if (qualityIssues.some(issue => issue)) return true

  // Check key points
  if (!keyPoints || keyPoints.length < 3) return true

  return false
}

export async function auditAndFixGrammarQuality(
  patchHandle: string,
  limit?: number,
  dryRun: boolean = false,
  minQuality: number = 60
): Promise<AuditResult> {
  console.log(`\n🔍 Starting grammar and quality audit for patch: ${patchHandle}\n`)

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
      facts: true,
      quotes: true,
      qualityScore: true,
      sourceUrl: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: limit || 100
  })

  console.log(`Found ${items.length} items to audit\n`)

  const result: AuditResult = {
    total: items.length,
    poorGrammar: 0,
    lowQuality: 0,
    fixed: 0,
    failed: 0,
    errors: []
  }

  // Detect if running locally or on server
  const baseUrl = process.env.NEXTAUTH_URL || 'https://carrot-app.onrender.com'
  const isLocal = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')

  for (const item of items) {
    try {
      const facts = item.facts as any[] || []
      const keyPoints = facts.map(f => typeof f === 'string' ? f : f?.value || '').filter(Boolean)
      
      // Check grammar in summary
      const grammarIssues = detectGrammarIssues(item.summary || '')
      const hasGrammarIssues = grammarIssues.length > 0

      // Check quality
      const qualityIsLow = (item.qualityScore || 0) < minQuality || hasPoorQuality(item.summary, keyPoints)

      if (!hasGrammarIssues && !qualityIsLow) {
        // Quality is good, skip
        continue
      }

      if (hasGrammarIssues) {
        result.poorGrammar++
        console.log(`⚠️  Grammar issues in: "${item.title.substring(0, 50)}"`)
        console.log(`   Issues: ${grammarIssues.join(', ')}`)
      }

      if (qualityIsLow) {
        result.lowQuality++
        console.log(`⚠️  Low quality: "${item.title.substring(0, 50)}" (score: ${item.qualityScore || 0})`)
      }

      if (dryRun) {
        console.log(`   [DRY RUN] Would re-process with DeepSeek: ${item.id}`)
        continue
      }

      // Re-process with DeepSeek
      console.log(`   🔄 Re-processing with DeepSeek...`)
      
      // Get original content text
      const contentText = item.summary || item.title

      let deepSeekResult
      
      // Determine which URL to use
      let apiUrl = baseUrl
      if (isLocal) {
        // When running locally, try to use localhost API first
        const localUrl = 'http://localhost:3000'
        try {
          // Try localhost first
          const testResponse = await fetch(`${localUrl}/api/healthz`, { 
            signal: AbortSignal.timeout(1000) 
          })
          if (testResponse.ok) {
            apiUrl = localUrl
            console.log(`   [Local] Using localhost API`)
          }
        } catch {
          // Localhost not available, use production URL
          console.log(`   [Local] Localhost not available, using production API`)
        }
      }
      
      // Use HTTP fetch (works both locally and on server)
      const summarizeResponse = await fetch(`${apiUrl}/api/ai/summarize-content`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: contentText,
            title: item.title,
            url: item.sourceUrl || '',
            groupContext: patchHandle,
            temperature: 0.2
          })
        })

        if (!summarizeResponse.ok) {
          throw new Error(`DeepSeek API failed: ${summarizeResponse.status}`)
        }

        deepSeekResult = await summarizeResponse.json()
      }

      // Update the item with improved content
      const updatedFacts = (deepSeekResult.keyFacts || []).map((fact: string, index: number) => ({
        label: `Insight ${index + 1}`,
        value: fact,
        citation: item.sourceUrl || ''
      }))

      await prisma.discoveredContent.update({
        where: { id: item.id },
        data: {
          summary: deepSeekResult.summary || item.summary,
          facts: updatedFacts as any,
          quotes: (deepSeekResult.notableQuotes || []) as any,
          qualityScore: deepSeekResult.qualityScore || item.qualityScore || 0,
          metadata: {
            ...(item as any).metadata,
            grammarFixed: true,
            fixedAt: new Date().toISOString(),
            issues: deepSeekResult.issues || []
          } as any
        }
      })

      result.fixed++
      console.log(`   ✅ Fixed! Quality score: ${deepSeekResult.qualityScore || 'N/A'}`)
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
  const qualityArg = args.find(arg => arg.startsWith('--min-quality='))
  const minQuality = qualityArg ? parseInt(qualityArg.split('=')[1]) : 60
  const dryRun = args.includes('--dry-run')

  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n')
  }

  try {
    const result = await auditAndFixGrammarQuality(patchHandle, limit, dryRun, minQuality)

    console.log(`\n📊 Audit Summary:`)
    console.log(`   Total items: ${result.total}`)
    console.log(`   Poor grammar: ${result.poorGrammar}`)
    console.log(`   Low quality: ${result.lowQuality}`)
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

