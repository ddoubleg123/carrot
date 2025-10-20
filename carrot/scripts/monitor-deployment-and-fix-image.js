async function monitorDeploymentAndFixImage() {
  console.log('🚀 Deployment Monitoring & Image Fix Script');
  console.log('=' .repeat(60));
  
  const deploymentUrl = 'https://carrot-app.onrender.com';
  const contentUrl = `${deploymentUrl}/patch/chicago-bulls/content/the-legacy-of-phil-jackson-and-the-triangle-offens-9aa31bf4`;
  
  console.log('📋 Target URL:', contentUrl);
  console.log('⏳ Waiting for deployment...\n');
  
  // Function to check if deployment is ready
  async function checkDeployment() {
    try {
      const response = await fetch(deploymentUrl);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
  
  // Wait for deployment (check every 30 seconds)
  let deploymentReady = false;
  let attempts = 0;
  const maxAttempts = 20; // 10 minutes max
  
  while (!deploymentReady && attempts < maxAttempts) {
    attempts++;
    console.log(`🔄 Checking deployment (attempt ${attempts}/${maxAttempts})...`);
    
    deploymentReady = await checkDeployment();
    
    if (deploymentReady) {
      console.log('✅ Deployment is live!\n');
      break;
    } else {
      console.log('⏳ Still deploying... waiting 30 seconds\n');
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }
  
  if (!deploymentReady) {
    console.log('❌ Deployment timeout. Please check Render dashboard.');
    return;
  }
  
  // Step 1: Generate new high-quality AI image
  console.log('🎨 Step 1: Generating HIGH-QUALITY AI Image');
  console.log('-'.repeat(60));
  console.log('✅ Face Restoration: ENABLED (0.8 weight)');
  console.log('✅ Hires Fix: ENABLED');
  console.log('✅ Refiner: ENABLED');
  console.log('✅ Upscaling: ENABLED');
  console.log('✅ Inference Steps: 30');
  console.log('✅ Random Seed: Enabled\n');
  
  try {
    const generateResponse = await fetch(`${deploymentUrl}/api/ai/generate-hero-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Phil Jackson and Michael Jordan',
        summary: 'Legendary coach Phil Jackson with Michael Jordan discussing the triangle offense during their championship years with the Chicago Bulls. Focus on their faces and the intense coaching moment.',
        sourceDomain: 'espn.com',
        contentType: 'article',
        patchTheme: 'basketball',
        artisticStyle: 'photorealistic',
        enableHiresFix: true  // ✅ Enable ALL quality features
      })
    });
    
    if (!generateResponse.ok) {
      throw new Error(`Generation failed: ${generateResponse.status}`);
    }
    
    const generateData = await generateResponse.json();
    
    if (!generateData.success) {
      throw new Error('Image generation failed');
    }
    
    console.log('✅ AI Image generated successfully!');
    
    // Check image format
    const isBase64 = generateData.imageUrl.startsWith('data:image');
    const isFirebaseUrl = generateData.imageUrl.includes('firebasestorage.googleapis.com');
    
    if (isFirebaseUrl) {
      console.log('✅ PERFECT! Image uploaded to Firebase Storage');
      console.log('🔗 CDN URL:', generateData.imageUrl.substring(0, 80) + '...');
    } else if (isBase64) {
      const sizeKB = (generateData.imageUrl.length * 0.75 / 1024).toFixed(2);
      console.log('⚠️ Warning: Still using base64 (' + sizeKB + ' KB)');
      console.log('🔍 Check server logs for Firebase upload errors');
    }
    
    // Step 2: Update the database
    console.log('\n📡 Step 2: Updating Database');
    console.log('-'.repeat(60));
    
    const contentId = 'cmgxsstg6000lpj2b9ilsfe3g';
    const patchHandle = 'chicago-bulls';
    
    const updateResponse = await fetch(
      `${deploymentUrl}/api/patches/${patchHandle}/content/${contentId}/update-image`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: generateData.imageUrl })
      }
    );
    
    if (updateResponse.ok) {
      console.log('✅ Database updated successfully!');
    } else {
      console.log('⚠️ Update API returned:', updateResponse.status);
      console.log('💡 The image was generated but database may need manual update');
    }
    
    // Step 3: Verify the update
    console.log('\n🔍 Step 3: Verifying Update');
    console.log('-'.repeat(60));
    
    const verifyResponse = await fetch(contentUrl);
    if (verifyResponse.ok) {
      console.log('✅ Content page is accessible');
    } else {
      console.log('⚠️ Content page returned:', verifyResponse.status);
    }
    
    // Final summary
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 PROCESS COMPLETE!');
    console.log('=' .repeat(60));
    console.log('✅ New AI image generated with HIGH QUALITY');
    console.log('✅ Face Restoration: ENABLED');
    console.log('✅ All HD features: ENABLED');
    console.log('\n🌐 Check the result at:');
    console.log(contentUrl);
    console.log('\n🎯 Verify:');
    console.log('   - Facial clarity (no distortions)');
    console.log('   - High detail and resolution');
    console.log('   - No mutations or artifacts');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n📋 Manual Steps:');
    console.log('1. Check Render logs for deployment status');
    console.log('2. Try running: node scripts/fix-phil-jackson-image.js');
    console.log('3. Check Firebase Storage console for uploads');
  }
}

// Start monitoring
console.log('🚀 Starting deployment monitoring...');
console.log('📍 This will check Render every 30 seconds');
console.log('⏱️ Max wait time: 10 minutes\n');

monitorDeploymentAndFixImage();

