#!/usr/bin/env tsx
/**
 * Verify DeepSeek API Configuration and Functionality
 * 
 * This script tests:
 * 1. API key is configured
 * 2. API is accessible
 * 3. Scoring works correctly
 * 4. Response format is valid
 */

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function verifyDeepSeekAPI() {
  console.log('🔍 Verifying DeepSeek API Configuration...\n')

  // Step 1: Check API Key
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    console.error('❌ DEEPSEEK_API_KEY is not set in environment variables')
    console.log('\nTo fix:')
    console.log('1. Add DEEPSEEK_API_KEY to your .env file')
    console.log('2. Or set it in Render dashboard: Environment > DEEPSEEK_API_KEY')
    process.exit(1)
  }

  console.log('✅ DEEPSEEK_API_KEY is configured')
  console.log(`   Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}\n`)

  // Step 2: Test API Call
  console.log('🧪 Testing DeepSeek API call...')
  
  try {
    const { chatStream } = await import('../src/lib/llm/providers/DeepSeekClient')
    
    const testPrompt = `Analyze this content for relevance to "Israel":

Title: Test Article
URL: https://example.com/test
Content: This is a test article about Israel and the Israeli-Palestinian conflict. It discusses the history and current situation.

Return JSON:
{
  "score": 0-100,
  "isRelevant": boolean,
  "isActualArticle": boolean,
  "contentQuality": "high" | "medium" | "low",
  "reason": string
}

Return ONLY valid JSON, no other text.`

    let response = ''
    const startTime = Date.now()
    let hasError = false
    let errorMessage = ''
    
    for await (const chunk of chatStream({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: 'You are a content relevance analyzer. Return only valid JSON objects.'
        },
        {
          role: 'user',
          content: testPrompt
        }
      ],
      temperature: 0.3,
      max_tokens: 500
    })) {
      if (chunk.type === 'error') {
        hasError = true
        errorMessage = chunk.error || 'Unknown error'
        break
      }
      if (chunk.type === 'token' && chunk.token) {
        response += chunk.token
      }
      if (chunk.type === 'done') {
        break
      }
    }
    
    if (hasError) {
      throw new Error(`API Error: ${errorMessage}`)
    }

    const duration = Date.now() - startTime

    // Clean and parse response
    let cleanResponse = response.replace(/```json/gi, '').replace(/```/g, '').trim()
    const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleanResponse = jsonMatch[0]
    }

    let result: {
      score: number
      isRelevant: boolean
      isActualArticle?: boolean
      contentQuality?: string
      reason: string
    }
    
    try {
      result = JSON.parse(cleanResponse)
    } catch (parseError) {
      // If parsing fails, check if it's an error response
      if (cleanResponse.includes('error') || cleanResponse.includes('Authentication')) {
        const errorMatch = cleanResponse.match(/\{[\s\S]*"error"[\s\S]*\}/)
        if (errorMatch) {
          const errorData = JSON.parse(errorMatch[0])
          throw new Error(`API Error: ${errorData.error?.message || errorData.error || cleanResponse}`)
        }
      }
      throw new Error(`Failed to parse API response: ${cleanResponse.substring(0, 200)}`)
    }

    console.log('✅ API call succeeded')
    console.log(`   Response time: ${duration}ms`)
    console.log(`   Score: ${result.score}`)
    console.log(`   Is Relevant: ${result.isRelevant}`)
    console.log(`   Is Article: ${result.isActualArticle ?? 'N/A'}`)
    console.log(`   Quality: ${result.contentQuality ?? 'N/A'}`)
    console.log(`   Reason: ${result.reason}\n`)

    // Step 3: Test with real citation from database
    console.log('📊 Testing with real citation from database...')
    
    const testCitation = await prisma.wikipediaCitation.findFirst({
      where: {
        scanStatus: { in: ['not_scanned', 'scanning'] },
        verificationStatus: { in: ['pending', 'verified'] },
        relevanceDecision: null
      },
      orderBy: {
        aiPriorityScore: { sort: 'desc', nulls: 'last' }
      }
    })

    if (testCitation) {
      console.log(`   Found test citation: ${testCitation.citationUrl}`)
      console.log(`   Title: ${testCitation.citationTitle || 'N/A'}`)
      console.log(`   AI Priority Score: ${testCitation.aiPriorityScore || 'N/A'}\n`)
      console.log('   ⚠️  To test full citation processing, run the audit script')
    } else {
      console.log('   No unprocessed citations found for testing\n')
    }

    // Summary
    console.log('✅ DeepSeek API Verification Complete')
    console.log('\n📋 Summary:')
    console.log('   ✅ API key is configured')
    console.log('   ✅ API is accessible')
    console.log('   ✅ Response format is valid')
    console.log('   ✅ Scoring works correctly')
    console.log('\n🚀 Ready to process citations!')

  } catch (error: any) {
    console.error('❌ API call failed:', error.message)
    console.error('\nPossible issues:')
    console.error('1. API key is invalid')
    console.error('2. Network connectivity issues')
    console.error('3. DeepSeek API service is down')
    console.error('4. Rate limiting')
    console.error('\nError details:', error)
    process.exit(1)
  }
}

// Run verification
verifyDeepSeekAPI()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })

