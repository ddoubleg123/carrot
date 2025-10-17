#!/usr/bin/env node
/**
 * Test script for the upgraded SDXL API
 * Tests health check and image generation endpoints
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const VAST_API_URL = process.env.VAST_AI_URL || 'http://ssh4.vast.ai:7860';

console.log('🧪 Testing Upgraded SDXL API');
console.log('============================\n');
console.log(`API URL: ${VAST_API_URL}\n`);

async function testHealth() {
  console.log('1️⃣  Testing health endpoint...');
  try {
    const response = await axios.get(`${VAST_API_URL}/health`, {
      timeout: 10000,
    });
    console.log('✅ Health check passed');
    console.log(JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
}

async function testGeneration() {
  console.log('\n2️⃣  Testing image generation...');
  console.log('This may take 30-60 seconds...\n');
  
  const testPrompt = 'A professional headshot of a person with clear, detailed facial features, studio lighting, high quality, photorealistic';
  
  try {
    const startTime = Date.now();
    
    const response = await axios.post(
      `${VAST_API_URL}/generate`,
      {
        prompt: testPrompt,
        negative_prompt: 'blurry, deformed, bad eyes, low quality, bad anatomy, extra limbs, disfigured, lowres, jpeg artifacts',
        seed: 42,
        width: 1024,
        height: 1024,
        steps: 35,
        cfg_scale: 7.0,
        use_hires_fix: true,
        use_face_restoration: false,
      },
      {
        timeout: 120000, // 2 minutes timeout
      }
    );
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`✅ Image generated in ${duration} seconds`);
    console.log(`Model: ${response.data.model}`);
    console.log(`Seed: ${response.data.seed}`);
    
    // Save the image
    if (response.data.image) {
      const base64Data = response.data.image.replace(/^data:image\/png;base64,/, '');
      const outputDir = path.join(__dirname, 'test-results');
      
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filename = `sdxl-test-${Date.now()}.png`;
      const filepath = path.join(outputDir, filename);
      
      fs.writeFileSync(filepath, base64Data, 'base64');
      console.log(`💾 Image saved to: ${filepath}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Image generation failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

async function testSimpleGeneration() {
  console.log('\n3️⃣  Testing simple generation (no hires fix)...');
  console.log('This should be faster...\n');
  
  try {
    const startTime = Date.now();
    
    const response = await axios.post(
      `${VAST_API_URL}/generate`,
      {
        prompt: 'A beautiful sunset over mountains, photorealistic, high quality',
        width: 768,
        height: 768,
        steps: 25,
        cfg_scale: 7.0,
        use_hires_fix: false,
      },
      {
        timeout: 90000,
      }
    );
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`✅ Simple generation completed in ${duration} seconds`);
    
    // Save the image
    if (response.data.image) {
      const base64Data = response.data.image.replace(/^data:image\/png;base64,/, '');
      const outputDir = path.join(__dirname, 'test-results');
      const filename = `sdxl-simple-${Date.now()}.png`;
      const filepath = path.join(outputDir, filename);
      
      fs.writeFileSync(filepath, base64Data, 'base64');
      console.log(`💾 Image saved to: ${filepath}`);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Simple generation failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('Starting tests...\n');
  
  const healthOk = await testHealth();
  
  if (!healthOk) {
    console.log('\n⚠️  Health check failed. API may not be running or not reachable.');
    console.log('Make sure:');
    console.log('1. The SDXL API is running on Vast.ai');
    console.log('2. SSH tunnel is active (if using tunnel)');
    console.log('3. VAST_AI_URL environment variable is set correctly');
    process.exit(1);
  }
  
  const generateOk = await testGeneration();
  const simpleOk = await testSimpleGeneration();
  
  console.log('\n============================');
  console.log('Test Summary:');
  console.log('============================');
  console.log(`Health Check: ${healthOk ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Full Generation: ${generateOk ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Simple Generation: ${simpleOk ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('============================\n');
  
  if (healthOk && generateOk && simpleOk) {
    console.log('🎉 All tests passed! SDXL API is working correctly.');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed. Check the logs above for details.');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});

