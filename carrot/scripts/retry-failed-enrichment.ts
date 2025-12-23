/**
 * Retry enrichment for items that previously failed
 */

import { prisma } from '@/lib/prisma'
import { chatStream, type ChatMessage } from '@/lib/llm/providers/DeepSeekClient'

async function cleanupContent(summary: string, keyFacts: string[], title: string) {
  const prompt = `You are an expert editor. Clean up and improve the following content:

EXECUTIVE SUMMARY (current):
${summary}

${keyFacts && keyFacts.length > 0 ? `KEY FACTS (current):
${keyFacts.map((fact: string, i: number) => `${i + 1}. ${fact}`).join('\n')}

Requirements:
- Each fact must be a COMPLETE, meaningful sentence with proper subject and predicate
- Fix grammar, spelling, and punctuation
- COMPLETE fragments and incomplete thoughts - if a fact is incomplete, either complete it with context or remove it
- Remove standalone phrases, sentence fragments, and incomplete statements
- If a fact starts with "It", "That", "This", "They", etc. without clear context, either add context or remove it
- If a fact is a quote fragment, complete it or remove it
- Ensure each fact is substantive and informative (standalone and understandable)
- Each fact should be 20-200 characters
- Maintain factual accuracy
- DO NOT include facts that are incomplete or require context from other facts

` : ''}Requirements for Summary:
- Fix all grammar, spelling, and punctuation errors
- Ensure proper sentence structure and flow
- Make it clear, concise, and professional
- Remove fragments and incomplete thoughts
- Ensure it's a complete, well-written paragraph (2-4 sentences, 120-240 words)
- Remove UI text like "Share or Embed", "Item Preview", "Bookreader", etc.
- Remove metadata like "Openlibrary_edition", "Page_number_confidence", etc.
- Maintain factual accuracy

Return ONLY valid JSON in this exact format:
{
  "summary": "Cleaned and improved executive summary (2-4 sentences, 120-240 words)",
  "keyFacts": ${keyFacts && keyFacts.length > 0 ? `["Fact 1 (complete sentence)", "Fact 2 (complete sentence)", ...]` : '[]'},
  "improvements": ["List of improvements made", "e.g., Fixed grammar", "e.g., Completed fragment"]
}

CRITICAL: Return ONLY the JSON object, no other text.`

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: 'You are an expert editor that improves content quality. Always return valid JSON only, no other text.'
    },
    {
      role: 'user',
      content: prompt
    }
  ]

  let fullResponse = ''
  const stream = chatStream({
    model: 'deepseek-chat',
    messages,
    temperature: 0.3,
    max_tokens: 1500
  })

  for await (const chunk of stream) {
    if (chunk.type === 'token' && chunk.token) {
      fullResponse += chunk.token
    } else if (chunk.type === 'error') {
      throw new Error(chunk.error || 'DeepSeek API error')
    }
  }

  // Parse JSON response
  const jsonMatch = fullResponse.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('No JSON found in response')
  }

  const jsonData = JSON.parse(jsonMatch[0])
  return {
    summary: jsonData.summary || summary,
    keyFacts: Array.isArray(jsonData.keyFacts) ? jsonData.keyFacts : keyFacts,
    improvements: Array.isArray(jsonData.improvements) ? jsonData.improvements : []
  }
}

async function retryFailed() {
  console.log('=== RETRYING FAILED ENRICHMENT ===\n')
  
  const patch = await prisma.patch.findUnique({
    where: { handle: 'israel' },
    select: { id: true }
  })
  
  if (!patch) {
    console.error('Patch "israel" not found')
    return
  }
  
  // Get items that failed cleanup
  const failedItems = await prisma.discoveredContent.findMany({
    where: { 
      patchId: patch.id,
      metadata: {
        path: ['cleanupFailed'],
        equals: true
      }
    },
    select: {
      id: true,
      title: true,
      summary: true,
      textContent: true,
      facts: true,
      metadata: true
    }
  })
  
  console.log(`Found ${failedItems.length} failed items to retry\n`)
  
  let enriched = 0
  let failed = 0
  let skipped = 0
  
  for (let i = 0; i < failedItems.length; i++) {
    const item = failedItems[i]
    const metadata = (item.metadata as any) || {}
    
    console.log(`[${i + 1}/${failedItems.length}] Retrying: ${item.id}`)
    console.log(`   Title: "${item.title?.substring(0, 60)}"`)
    console.log(`   Previous error: ${metadata.cleanupError || 'Unknown'}`)
    
    try {
      const summary = item.summary || ''
      const keyFacts = Array.isArray(item.facts)
        ? item.facts.map((f: any) => f.value || f.text || f).filter(Boolean)
        : []
      
      // Check if we have enough content
      if (!summary || summary.length < 20) {
        console.log(`   ⏭️  Skipping: Not enough content (${summary.length} chars)`)
        skipped++
        continue
      }
      
      console.log(`   🧹 Running DeepSeek cleanup...`)
      
      const cleanupResult = await cleanupContent(
        summary,
        keyFacts,
        item.title || 'Untitled'
      )
      
      const updates: any = {
        metadata: {
          ...metadata,
          grammarCleaned: true,
          grammarCleanedAt: new Date().toISOString(),
          contentQuality: 'good',
          cleanupFailed: false, // Clear failure flag
          cleanupError: undefined // Clear error
        }
      }
      
      let hasChanges = false
      
      if (cleanupResult.summary && cleanupResult.summary.length > 0 && cleanupResult.summary !== summary) {
        updates.summary = cleanupResult.summary
        hasChanges = true
        console.log(`   ✅ Summary cleaned (${summary.length} → ${cleanupResult.summary.length} chars)`)
      }
      
      if (cleanupResult.keyFacts && cleanupResult.keyFacts.length > 0) {
        updates.facts = cleanupResult.keyFacts.map((fact: string) => ({
          label: 'Fact',
          value: fact
        }))
        hasChanges = true
        console.log(`   ✅ Key facts cleaned (${keyFacts.length} → ${cleanupResult.keyFacts.length} facts)`)
      }
      
      if (cleanupResult.improvements && cleanupResult.improvements.length > 0) {
        console.log(`   📝 Improvements: ${cleanupResult.improvements.join(', ')}`)
      }
      
      if (hasChanges) {
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: updates
        })
        enriched++
        console.log(`   ✅ Successfully enriched`)
      } else {
        console.log(`   ⚠️  No changes needed`)
        skipped++
      }
      
    } catch (error: any) {
      failed++
      console.error(`   ❌ Error: ${error.message}`)
      
      // Update error in metadata
      try {
        await prisma.discoveredContent.update({
          where: { id: item.id },
          data: {
            metadata: {
              ...metadata,
              cleanupFailed: true,
              cleanupFailedAt: new Date().toISOString(),
              cleanupError: error.message.substring(0, 200),
              retryCount: (metadata.retryCount || 0) + 1
            } as any
          }
        })
      } catch (updateError) {
        // Ignore update errors
      }
    }
    
    // Rate limiting - 2 second delay
    if (i < failedItems.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  
  console.log(`\n=== SUMMARY ===`)
  console.log(`Total failed items: ${failedItems.length}`)
  console.log(`✅ Enriched: ${enriched}`)
  console.log(`⏭️  Skipped: ${skipped}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`\n✅ Retry complete!`)
}

retryFailed().catch(console.error)

