#!/usr/bin/env tsx

/**
 * Test script to verify hero pipeline works
 * Usage: npx tsx scripts/test-hero-pipeline.ts
 */

import { resolveHero } from '../src/lib/media/resolveHero'

async function testHeroPipeline() {
  console.log('🧪 Testing hero pipeline...\n')

  const testCases = [
    {
      name: 'YouTube Video',
      input: {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        type: 'video' as const
      }
    },
    {
      name: 'News Article',
      input: {
        url: 'https://www.bbc.com/news',
        type: 'article' as const
      }
    },
    {
      name: 'PDF Document',
      input: {
        url: 'https://example.com/document.pdf',
        type: 'pdf' as const
      }
    },
    {
      name: 'Image URL',
      input: {
        url: 'https://example.com/image.jpg',
        type: 'image' as const
      }
    },
    {
      name: 'Text Content (no URL)',
      input: {
        type: 'text' as const
      }
    }
  ]

  for (const testCase of testCases) {
    try {
      console.log(`📋 Testing: ${testCase.name}`)
      console.log(`   Input:`, testCase.input)
      
      const result = await resolveHero(testCase.input)
      
      console.log(`   ✅ Result:`)
      console.log(`      Hero: ${result.hero.substring(0, 60)}...`)
      console.log(`      Source: ${result.source}`)
      console.log(`      License: ${result.license}`)
      if (result.dominant) console.log(`      Dominant: ${result.dominant}`)
      if (result.blurDataURL) console.log(`      Blur: ${result.blurDataURL.substring(0, 30)}...`)
      
    } catch (error) {
      console.error(`   ❌ Failed:`, error instanceof Error ? error.message : error)
    }
    
    console.log('')
  }

  console.log('🎉 Hero pipeline test complete!')
}

testHeroPipeline().catch(console.error)
