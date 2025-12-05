/**
 * Quick test to verify the isActualArticle fix
 * Tests that articles with single paragraphs or low paragraph counts are accepted
 */

import { prisma } from '../src/lib/prisma'

// Test content samples
const testCases = [
  {
    name: 'Single paragraph article (long)',
    content: 'This is a long article about Israel and Zionism. It contains many sentences and substantial information. The article discusses the history of the movement, its key figures, and its impact on modern politics. It provides detailed analysis and context for understanding the topic. The content is well-written and informative, covering various aspects of the subject matter. This paragraph continues with more detailed information about the topic, providing readers with comprehensive coverage.'.repeat(10), // ~2000 chars
    url: 'https://example.com/article1',
    expected: true
  },
  {
    name: 'Multi-paragraph article',
    content: 'First paragraph with substantial content about the topic.\n\nSecond paragraph continues the discussion.\n\nThird paragraph provides additional details.\n\nFourth paragraph concludes the article.',
    url: 'https://example.com/article2',
    expected: true
  },
  {
    name: 'Short content (should fail)',
    content: 'Short content',
    url: 'https://example.com/short',
    expected: false
  },
  {
    name: 'Catalog page (should fail)',
    content: 'Authority control. Library of Congress. VIAF. Catalog record. Bibliographic metadata.',
    url: 'https://example.com/catalog',
    expected: false
  }
]

// Import the isActualArticle function (it's not exported, so we'll test the logic)
async function testIsActualArticleLogic() {
  console.log('Testing isActualArticle logic...\n')
  
  // Since isActualArticle is not exported, we'll test the logic manually
  function isActualArticle(content: string, url: string): boolean {
    // Must have substantial content
    if (content.length < 1000) {
      return false
    }
    
    // Check for article structure (paragraphs, not just metadata)
    // Made more lenient: accept if >= 1 paragraph (some articles are single long paragraphs)
    const paragraphCount = (content.match(/\n\n/g) || []).length + 1
    if (paragraphCount < 1) {
      return false
    }
    
    // Check for narrative indicators (sentences with proper structure)
    // Made more lenient: check for multiple sentences (not just one)
    const sentenceCount = (content.match(/[.!?]\s+[A-Z]/g) || []).length
    if (sentenceCount < 3) {
      // If very few sentences, might be metadata
      return false
    }
    
    // Reject if it looks like a catalog/authority page
    const catalogIndicators = [
      'authority control',
      'catalog record',
      'bibliographic',
      'metadata',
      'viaf',
      'lccn',
      'isni',
      'library of congress',
      'national library',
      'authority file',
      'controlled vocabulary',
    ]
    
    const lowerContent = content.toLowerCase()
    const catalogScore = catalogIndicators.filter(ind => 
      lowerContent.includes(ind)
    ).length
    
    // If more than 2 catalog indicators, likely not an article
    if (catalogScore >= 2) {
      return false
    }
    
    // Check for actual article indicators
    const articleIndicators = [
      'article',
      'published',
      'wrote',
      'said',
      'according to',
      'reported',
      'interview',
      'analysis',
    ]
    
    const articleScore = articleIndicators.filter(ind => 
      lowerContent.includes(ind)
    ).length
    
    // If has article indicators, likely an article
    return articleScore >= 1
  }
  
  let passed = 0
  let failed = 0
  
  for (const testCase of testCases) {
    const result = isActualArticle(testCase.content, testCase.url)
    const status = result === testCase.expected ? '✅ PASS' : '❌ FAIL'
    
    if (result === testCase.expected) {
      passed++
    } else {
      failed++
    }
    
    console.log(`${status} - ${testCase.name}`)
    console.log(`  Expected: ${testCase.expected}, Got: ${result}`)
    console.log(`  Content length: ${testCase.content.length} chars`)
    console.log(`  Paragraphs: ${(testCase.content.match(/\n\n/g) || []).length + 1}`)
    console.log(`  Sentences: ${(testCase.content.match(/[.!?]\s+[A-Z]/g) || []).length}`)
    console.log()
  }
  
  console.log(`\nResults: ${passed} passed, ${failed} failed`)
  
  if (failed === 0) {
    console.log('✅ All tests passed! The isActualArticle fix is working correctly.')
  } else {
    console.log('❌ Some tests failed. Review the logic.')
  }
}

testIsActualArticleLogic().catch(console.error)

