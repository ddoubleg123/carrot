async function testAIQualitySettings() {
  console.log('🧪 Testing AI Image Quality Settings');
  console.log('=' .repeat(60));
  
  // Intercept and log the request
  const originalFetch = global.fetch;
  let capturedRequest = null;
  
  // Mock fetch to capture the request
  global.fetch = async (url, options) => {
    if (url.includes('/generate')) {
      console.log('\n📤 Captured SDXL API Request:');
      console.log('URL:', url);
      const body = JSON.parse(options.body);
      capturedRequest = body;
      
      console.log('\n🔍 Quality Settings Sent to SDXL:');
      console.log('=' .repeat(60));
      console.log('✅ Face Restoration:', body.use_face_restoration);
      console.log('   - Weight:', body.face_restoration_weight);
      console.log('✅ Hires Fix:', body.hires_fix);
      console.log('✅ Refiner:', body.use_refiner);
      console.log('✅ Upscaling:', body.use_realesrgan);
      console.log('✅ Inference Steps:', body.num_inference_steps);
      console.log('✅ Random Seed:', body.seed === -1 ? 'Yes (random)' : `No (fixed: ${body.seed})`);
      console.log('=' .repeat(60));
      
      // Return mock response
      return {
        ok: true,
        json: async () => ({
          success: true,
          image: 'data:image/png;base64,test'
        })
      };
    }
    return originalFetch(url, options);
  };
  
  try {
    // Test with enableHiresFix = true
    console.log('\n🧪 Test 1: enableHiresFix = TRUE');
    console.log('-'.repeat(60));
    
    const response1 = await fetch('http://localhost:3000/api/ai/generate-hero-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Image',
        summary: 'Testing quality settings',
        enableHiresFix: true  // ✅ TRUE
      })
    });
    
    console.log('\n✅ Expected Results:');
    console.log('   - Face Restoration: true ✅');
    console.log('   - Hires Fix: true ✅');
    console.log('   - Refiner: true ✅');
    console.log('   - Upscaling: true ✅');
    
    if (capturedRequest) {
      const allCorrect = 
        capturedRequest.use_face_restoration === true &&
        capturedRequest.hires_fix === true &&
        capturedRequest.use_refiner === true &&
        capturedRequest.use_realesrgan === true &&
        capturedRequest.num_inference_steps === 30 &&
        capturedRequest.seed === -1;
      
      if (allCorrect) {
        console.log('\n🎉 ALL SETTINGS CORRECT!');
      } else {
        console.log('\n❌ SOME SETTINGS INCORRECT:');
        if (!capturedRequest.use_face_restoration) console.log('   - Face Restoration: FAILED');
        if (!capturedRequest.hires_fix) console.log('   - Hires Fix: FAILED');
        if (!capturedRequest.use_refiner) console.log('   - Refiner: FAILED');
        if (!capturedRequest.use_realesrgan) console.log('   - Upscaling: FAILED');
        if (capturedRequest.num_inference_steps !== 30) console.log('   - Steps: FAILED');
        if (capturedRequest.seed !== -1) console.log('   - Random Seed: FAILED');
      }
    }
    
    // Test with enableHiresFix = false
    console.log('\n\n🧪 Test 2: enableHiresFix = FALSE');
    console.log('-'.repeat(60));
    
    capturedRequest = null;
    const response2 = await fetch('http://localhost:3000/api/ai/generate-hero-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Test Image',
        summary: 'Testing quality settings',
        enableHiresFix: false  // ✅ FALSE
      })
    });
    
    console.log('\n✅ Expected Results:');
    console.log('   - Face Restoration: true ✅ (ALWAYS on)');
    console.log('   - Hires Fix: false (disabled by request)');
    console.log('   - Refiner: false (disabled by request)');
    console.log('   - Upscaling: false (disabled by request)');
    
    if (capturedRequest) {
      const correctForDisabled = 
        capturedRequest.use_face_restoration === true &&  // STILL TRUE
        capturedRequest.hires_fix === false &&
        capturedRequest.use_refiner === false &&
        capturedRequest.use_realesrgan === false;
      
      if (correctForDisabled) {
        console.log('\n🎉 CORRECT! Face restoration stays ON even when HD is OFF');
      } else {
        console.log('\n❌ INCORRECT BEHAVIOR');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    global.fetch = originalFetch;
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log('✅ Testing Complete');
  console.log('=' .repeat(60));
}

// Note: This test requires the local server to be running
console.log('⚠️ Note: Start the dev server with: npm run dev');
console.log('⚠️ Then run this test to verify settings\n');

testAIQualitySettings();

