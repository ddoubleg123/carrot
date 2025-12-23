/**
 * Enrich content with quotes and grammar cleanup using DeepSeek
 */

import { prisma } from '@/lib/prisma'

async function enrichContent() {
  console.log('=== ENRICHING CONTENT WITH QUOTES AND GRAMMAR CLEANUP ===\n')
  
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true }
  })
  
  if (!patch) {
    console.error('Patch "israel" not found')
    return
  }
  
  // Get all content items
  const contentItems = await prisma.discoveredContent.findMany({
    where: { patchId: patch.id },
    select: {
      id: true,
      title: true,
      summary: true,
      textContent: true,
      quotes: true,
      facts: true,
      metadata: true
    }
  })
  
  console.log(`Found ${contentItems.length} items to enrich\n`)
  
  const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://carrot-app.onrender.com'
  let enriched = 0
  let failed = 0
  
  for (let i = 0; i < contentItems.length; i++) {
    const item = contentItems[i]
    const metadata = (item.metadata as any) || {}
    
    // Skip if already enriched recently
    if (metadata.grammarCleaned && metadata.quotesAdded) {
      console.log(`[${i + 1}/${contentItems.length}] Skipping ${item.id} (already enriched)`)
      continue
    }
    
    console.log(`[${i + 1}/${contentItems.length}] Enriching: ${item.id}`)
    console.log(`   Title: "${item.title?.substring(0, 60)}"`)
    
    try {
      // Step 1: Grammar cleanup
      if (!metadata.grammarCleaned && item.summary) {
        console.log(`   🧹 Running grammar cleanup...`)
        const cleanupResponse = await fetch(`${baseUrl}/api/ai/cleanup-content`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-key': process.env.INTERNAL_API_KEY || ''
          },
          body: JSON.stringify({
            summary: item.summary,
            keyFacts: Array.isArray(item.facts) ? item.facts.map((f: any) => f.value || f.text || f).filter(Boolean) : [],
            title: item.title
          }),
          signal: AbortSignal.timeout(20000)
        })
        
        if (cleanupResponse.ok) {
          const cleanupData = await cleanupResponse.json()
          
          const updates: any = {
            metadata: {
              ...metadata,
              grammarCleaned: true,
              grammarCleanedAt: new Date().toISOString()
            }
          }
          
          if (cleanupData.summary && cleanupData.summary.length > 0) {
            updates.summary = cleanupData.summary
            console.log(`   ✅ Summary cleaned`)
          }
          
          if (cleanupData.keyFacts && Array.isArray(cleanupData.keyFacts) && cleanupData.keyFacts.length > 0) {
            updates.facts = cleanupData.keyFacts.map((fact: string) => ({
              label: 'Fact',
              value: fact
            }))
            console.log(`   ✅ Key facts cleaned (${cleanupData.keyFacts.length} facts)`)
          }
          
          await prisma.discoveredContent.update({
            where: { id: item.id },
            data: updates
          })
        }
      }
      
      // Step 2: Extract quotes using summarize-content API
      if ((!item.quotes || (Array.isArray(item.quotes) && item.quotes.length === 0)) && item.textContent) {
        console.log(`   💬 Extracting quotes...`)
        
        // Use summarize-content API to extract quotes
        const quoteResponse = await fetch(`${baseUrl}/api/ai/summarize-content`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-key': process.env.INTERNAL_API_KEY || ''
          },
          body: JSON.stringify({
            text: item.textContent.substring(0, 10000), // Limit to avoid token limits
            title: item.title,
            url: item.textContent ? undefined : '',
            groupContext: 'Israel'
          }),
          signal: AbortSignal.timeout(45000) // 45s for summarize
        })
        
        if (quoteResponse.ok) {
          const quoteData = await quoteResponse.json()
          
          if (quoteData.notableQuotes && Array.isArray(quoteData.notableQuotes) && quoteData.notableQuotes.length > 0) {
            const quotes = quoteData.notableQuotes.map((q: any) => ({
              text: q.quote || q.text || q,
              speaker: q.attribution || q.speaker || undefined,
              citation: q.citation || undefined
            }))
            
            await prisma.discoveredContent.update({
              where: { id: item.id },
              data: {
                quotes: quotes,
                metadata: {
                  ...metadata,
                  quotesAdded: true,
                  quotesAddedAt: new Date().toISOString()
                }
              }
            })
            
            console.log(`   ✅ Extracted ${quotes.length} quotes`)
          } else {
            console.log(`   ⚠️  No quotes found in response`)
          }
        } else {
          const errorText = await quoteResponse.text()
          console.log(`   ⚠️  Quote extraction failed: ${quoteResponse.status} - ${errorText.substring(0, 100)}`)
        }
      }
      
      enriched++
    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`)
      failed++
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  console.log(`\n=== SUMMARY ===`)
  console.log(`Enriched: ${enriched}`)
  console.log(`Failed: ${failed}`)
  console.log(`Total: ${contentItems.length}`)
}

enrichContent().catch(console.error)

