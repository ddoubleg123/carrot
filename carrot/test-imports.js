// Test if the prompt imports work
async function test() {
  try {
    console.log('Testing imports...');
    
    // Test dynamic import
    const { sanitizeInputs } = await import('./src/lib/prompt/sanitize.ts');
    const { buildPrompt } = await import('./src/lib/prompt/build.ts');
    
    console.log('✅ Imports successful');
    
    // Test sanitize
    const sanitized = sanitizeInputs('Michael Jordan eating ice cream', 'Michael Jordan eating ice cream inside a basketball arena');
    console.log('Sanitized:', sanitized);
    
    // Test build
    const prompt = buildPrompt({ s: sanitized, styleOverride: 'photorealistic' });
    console.log('Prompt:', prompt);
    
  } catch (error) {
    console.error('❌ Import error:', error.message);
    console.error('Stack:', error.stack);
  }
}

test();

