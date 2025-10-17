// Test script to show enhanced prompt templates
const { buildEnhancedPrompt } = require('./carrot/src/lib/media/enhancedPromptTemplates.ts');

console.log('🎨 ENHANCED PROMPT TEMPLATES TEST\n');

const testCases = [
  {
    userPrompt: "Derrick Rose in Chicago Bulls jersey, basketball court",
    artisticStyle: "Cinematic",
    sourceDomain: "theathletic.com",
    patchTheme: "Sports"
  },
  {
    userPrompt: "Tech innovation, modern workspace",
    artisticStyle: "Modern",
    sourceDomain: "techcrunch.com",
    patchTheme: "Tech"
  },
  {
    userPrompt: "Vintage car, classic automobile",
    artisticStyle: "Vintage",
    sourceDomain: "autoblog.com",
    patchTheme: "Automotive"
  }
];

testCases.forEach((test, index) => {
  console.log(`\n📸 TEST ${index + 1}: ${test.artisticStyle}`);
  console.log(`Input: ${test.userPrompt}`);
  console.log(`Domain: ${test.sourceDomain} | Theme: ${test.patchTheme}`);
  
  try {
    const enhanced = buildEnhancedPrompt(
      test.userPrompt, 
      test.artisticStyle, 
      test.sourceDomain, 
      test.patchTheme
    );
    console.log(`Enhanced: ${enhanced.substring(0, 200)}...`);
  } catch (error) {
    console.log(`Error: ${error.message}`);
  }
});

console.log('\n✅ Enhanced templates are ready!');
