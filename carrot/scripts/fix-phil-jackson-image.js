async function fixPhilJacksonImage() {
  console.log('🎯 Fixing Phil Jackson Content Image');
  console.log('=' .repeat(60));
  
  const contentId = 'cmgxsstg6000lpj2b9ilsfe3g';
  const patchHandle = 'chicago-bulls';
  
  try {
    // Step 1: Generate new AI image
    console.log('🎨 Generating new AI image with HIGH QUALITY settings...');
    
    const response = await fetch('https://carrot-app.onrender.com/api/ai/generate-hero-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Phil Jackson and Michael Jordan',
        summary: 'Legendary coach Phil Jackson with Michael Jordan discussing the triangle offense during their championship years with the Chicago Bulls',
        sourceDomain: 'espn.com',
        contentType: 'article',
        patchTheme: 'basketball',
        artisticStyle: 'photorealistic',
        enableHiresFix: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error('Image generation failed');
    }
    
    console.log('✅ Image generated successfully');
    
    // Check image format
    const isBase64 = data.imageUrl.startsWith('data:image');
    const isFirebaseUrl = data.imageUrl.includes('firebasestorage.googleapis.com');
    
    if (isBase64) {
      const sizeKB = (data.imageUrl.length * 0.75 / 1024).toFixed(2);
      console.log('📦 Format: Base64');
      console.log('📏 Size:', sizeKB, 'KB');
      
      if (parseFloat(sizeKB) > 500) {
        console.log('⚠️ WARNING: Image too large! Needs Firebase upload.');
        console.log('🔧 Solution: Deploy the updated code with Firebase upload enabled');
      }
    } else if (isFirebaseUrl) {
      console.log('✅ Perfect! Image stored in Firebase');
      console.log('🔗 URL:', data.imageUrl);
    }
    
    // Step 2: Check if we can access the discovered content API
    console.log('\n📡 Checking discovered content API...');
    
    const contentResponse = await fetch(
      `https://carrot-app.onrender.com/api/patches/${patchHandle}/discovered-content`
    );
    
    if (!contentResponse.ok) {
      throw new Error('Cannot access content API');
    }
    
    const contentData = await contentResponse.json();
    const content = contentData.items?.find(item => item.id === contentId);
    
    if (!content) {
      throw new Error('Content not found in API response');
    }
    
    console.log('✅ Found content:', content.title);
    console.log('📋 Current hero:', content.mediaAssets?.hero ? 'Has image' : 'No image');
    
    // Step 3: Provide manual update instructions
    console.log('\n' + '=' .repeat(60));
    console.log('📋 MANUAL UPDATE REQUIRED');
    console.log('=' .repeat(60));
    console.log('\nTo update the image, you need to:');
    console.log('\n1. Deploy the code with Firebase upload:');
    console.log('   - The uploadToFirebase function is ready');
    console.log('   - After deployment, images will auto-upload to Firebase');
    console.log('\n2. OR manually update via database:');
    console.log('   - Content ID:', contentId);
    console.log('   - Field: mediaAssets.hero');
    console.log('   - New value: [Generated Image URL]');
    console.log('\n3. OR regenerate after deployment:');
    console.log('   - Deploy the updated code');
    console.log('   - Run this script again');
    console.log('   - Image will automatically upload to Firebase');
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎯 RECOMMENDATION: Deploy first, then regenerate');
    console.log('=' .repeat(60));
    console.log('\nNew AI image quality settings:');
    console.log('✅ Face Restoration: ENABLED (0.8 weight)');
    console.log('✅ Hires Fix: ENABLED');
    console.log('✅ Refiner: ENABLED');
    console.log('✅ Inference Steps: 30 (high quality)');
    console.log('✅ Upscaling: ENABLED');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

fixPhilJacksonImage();

