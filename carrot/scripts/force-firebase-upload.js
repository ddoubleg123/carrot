async function forceFirebaseUpload() {
  console.log('🔥 Force Firebase Upload Test');
  console.log('=' .repeat(50));
  
  const deploymentUrl = 'https://carrot-app.onrender.com';
  
  try {
    // Generate a new image with explicit Firebase upload request
    console.log('🎨 Generating image with Firebase upload...');
    
    const generateResponse = await fetch(`${deploymentUrl}/api/ai/generate-hero-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Phil Jackson Coaching Michael Jordan',
        summary: 'Legendary coach Phil Jackson with Michael Jordan during a Chicago Bulls practice session. High quality, photorealistic, detailed facial features, professional basketball coaching moment.',
        sourceDomain: 'espn.com',
        contentType: 'article',
        patchTheme: 'basketball',
        artisticStyle: 'photorealistic',
        enableHiresFix: true,
        forceFirebaseUpload: true  // Try to force Firebase upload
      })
    });
    
    if (!generateResponse.ok) {
      throw new Error(`Generation failed: ${generateResponse.status}`);
    }
    
    const generateData = await generateResponse.json();
    console.log('📊 Generation result:', {
      success: generateData.success,
      hasImage: !!generateData.imageUrl,
      isFirebase: generateData.imageUrl?.includes('firebasestorage.googleapis.com'),
      isBase64: generateData.imageUrl?.startsWith('data:image'),
      size: generateData.imageUrl ? (generateData.imageUrl.length * 0.75 / 1024).toFixed(2) + ' KB' : 'N/A'
    });
    
    if (generateData.imageUrl?.includes('firebasestorage.googleapis.com')) {
      console.log('✅ SUCCESS: Image uploaded to Firebase!');
      console.log('🔗 Firebase URL:', generateData.imageUrl);
    } else if (generateData.imageUrl?.startsWith('data:image')) {
      console.log('⚠️ WARNING: Still using base64 instead of Firebase');
      console.log('🔍 This suggests Firebase upload is failing on the server');
    }
    
    // Update the database with the new image
    console.log('\n📡 Updating database...');
    const contentId = 'cmgxsstg6000lpj2b9ilsfe3g';
    
    const updateResponse = await fetch(
      `${deploymentUrl}/api/patches/chicago-bulls/content/${contentId}/update-image`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: generateData.imageUrl })
      }
    );
    
    console.log('📊 Update response:', updateResponse.status);
    
    if (updateResponse.ok) {
      console.log('✅ Database updated successfully!');
    } else {
      const errorText = await updateResponse.text();
      console.log('❌ Update failed:', errorText);
    }
    
    console.log('\n🌐 Check the updated page:');
    console.log('https://carrot-app.onrender.com/patch/chicago-bulls/content/the-legacy-of-phil-jackson-and-the-triangle-offens-9aa31bf4');
    
    console.log('\n📋 Next steps if Firebase upload failed:');
    console.log('1. Check Render server logs for Firebase errors');
    console.log('2. Verify Firebase configuration in production');
    console.log('3. Check if Firebase Storage rules allow uploads');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

forceFirebaseUpload();
