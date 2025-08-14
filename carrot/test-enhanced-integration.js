/**
 * Test Enhanced LanguageTool Integration
 * Verifies the enhanced speech processing is working in the transcription pipeline
 */

const { cleanupGrammar } = require('./src/lib/languageTool.ts');

// Your actual transcript for testing
const testTranscript = "Now I will say this is taken quite a bit of time, but it does look like things are coming to play in other coming to look good I'm so basically the categories for the sidebar for carrot our search notifications care patch messages rabbit which is like this ai I set up and funds and settings and that's the categories be very fun stuff can't wait to see that";

async function testEnhancedIntegration() {
  console.log('🧪 Testing Enhanced LanguageTool Integration');
  console.log('=' .repeat(70));
  
  console.log('\n📝 ORIGINAL TRANSCRIPT:');
  console.log('"' + testTranscript + '"');
  
  try {
    console.log('\n🎯 Running enhanced LanguageTool processing...');
    const result = await cleanupGrammar(testTranscript);
    
    console.log('\n✨ ENHANCED RESULT:');
    console.log('"' + result + '"');
    
    // Verify specific improvements
    const improvements = [];
    if (result.includes('Carrot Patch')) improvements.push('✅ "care patch" → "Carrot Patch"');
    if (result.includes('coming into play')) improvements.push('✅ "coming to play" → "coming into play"');
    if (result.includes('So basically')) improvements.push('✅ "I\'m so basically" → "So basically"');
    if (result.includes('Carrot are:')) improvements.push('✅ "carrot" → "Carrot" (capitalized)');
    if (result.includes('Rabbit which')) improvements.push('✅ "rabbit" → "Rabbit" (AI context)');
    
    console.log('\n📊 VERIFIED IMPROVEMENTS:');
    improvements.forEach(improvement => console.log(improvement));
    
    console.log(`\n🎉 Integration test ${improvements.length > 0 ? 'PASSED' : 'FAILED'}`);
    console.log(`Found ${improvements.length} expected improvements in the enhanced output.`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    return null;
  }
}

// Run the integration test
if (require.main === module) {
  testEnhancedIntegration();
}

module.exports = { testEnhancedIntegration };
