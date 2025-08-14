// Test script for LanguageTool grammar cleanup
// Since this is a TypeScript file, we'll test via API endpoint instead
const fetch = require('node-fetch');

async function testGrammarCleanup() {
  console.log('🧪 Testing LanguageTool grammar cleanup...\n');
  
  // Test cases that match the grammar issues we found in the database
  const testCases = [
    'well i think this is a test', // Missing capitalization, punctuation
    'hello world how are you', // Missing punctuation
    'i am doing well today', // Lowercase "i", missing punctuation
    'this is a test message for grammar cleanup', // Missing punctuation
  ];
  
  for (let i = 0; i < testCases.length; i++) {
    const testText = testCases[i];
    console.log(`--- Test Case ${i + 1} ---`);
    console.log(`Original: "${testText}"`);
    
    try {
      // Test LanguageTool API cleanup
      const cleaned = await cleanupGrammar(testText);
      console.log(`LanguageTool: "${cleaned}"`);
      
      // Test basic fallback cleanup
      const basicCleaned = basicGrammarCleanup(testText);
      console.log(`Basic Cleanup: "${basicCleaned}"`);
      
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
    
    console.log('');
  }
}

testGrammarCleanup();
