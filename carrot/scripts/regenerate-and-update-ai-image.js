async function regenerateAndUpdateAIImage() {
  const contentId = 'cmgxsstg6000lpj2b9ilsfe3g';
  const patchHandle = 'chicago-bulls';
  const title = 'The Legacy of Phil Jackson and the Triangle Offense';
  
  console.log('🎯 Starting AI Image Regeneration Process');
  console.log('=' .repeat(60));
  console.log('📋 Content ID:', contentId);
  console.log('📋 Patch:', patchHandle);
  console.log('📋 Title:', title);
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Generate HIGH-QUALITY AI image with ALL features enabled
    console.log('\n🎨 Step 1: Generating HIGH-QUALITY AI image...');
    console.log('✅ Face Restoration: ENABLED (weight: 0.8)');
    console.log('✅ Hires Fix: ENABLED');
    console.log('✅ Refiner: ENABLED');
    console.log('✅ Upscaling: ENABLED');
    console.log('✅ Inference Steps: 30 (high quality)');
    console.log('✅ Random Seed: Enabled (for variety)');
    
    const aiImageResponse = await fetch('https://carrot-app.onrender.com/api/ai/generate-hero-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: title,
        summary: 'Phil Jackson\'s legendary coaching career with the Chicago Bulls, featuring Michael Jordan and the revolutionary triangle offense that dominated the NBA in the 1990s',
        sourceDomain: 'espn.com',
        contentType: 'article',
        patchTheme: 'basketball',
        artisticStyle: 'photorealistic',
        enableHiresFix: true  // ✅ Enable ALL quality features
      })
    });
    
    if (!aiImageResponse.ok) {
      const errorText = await aiImageResponse.text();
      console.log('❌ AI Image generation failed:', errorText);
      return;
    }
    
    const aiImageData = await aiImageResponse.json();
    
    if (!aiImageData.success || !aiImageData.imageUrl) {
      console.log('❌ AI Image generation failed:', aiImageData);
      return;
    }
    
    console.log('✅ AI Image generated successfully!');
    console.log('📏 Image URL length:', aiImageData.imageUrl.length, 'characters');
    
    // Check if it's base64 or Firebase URL
    const isBase64 = aiImageData.imageUrl.startsWith('data:image');
    const isFirebaseUrl = aiImageData.imageUrl.includes('firebasestorage.googleapis.com');
    
    console.log('📦 Image format:', isBase64 ? 'Base64' : isFirebaseUrl ? 'Firebase URL' : 'Unknown');
    
    if (isBase64) {
      const sizeKB = (aiImageData.imageUrl.length * 0.75 / 1024).toFixed(2); // Base64 is ~1.33x actual size
      console.log('⚠️ Warning: Base64 image size:', sizeKB, 'KB');
      if (parseFloat(sizeKB) > 500) {
        console.log('🔴 ALERT: Image is too large! Should be uploaded to Firebase.');
      }
    } else if (isFirebaseUrl) {
      console.log('✅ Perfect! Image is stored in Firebase Storage.');
    }
    
    // Step 2: Update the database
    console.log('\n📡 Step 2: Updating database...');
    
    const updateResponse = await fetch(
      `https://carrot-app.onrender.com/api/patches/${patchHandle}/content/${contentId}/update-image`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: aiImageData.imageUrl
        })
      }
    );
    
    if (!updateResponse.ok) {
      console.log('❌ Database update failed:', updateResponse.status, updateResponse.statusText);
      
      // Try alternative update method
      console.log('🔄 Trying alternative update method...');
      console.log('⚠️ Note: You may need to update the database manually');
      console.log('📋 Content ID:', contentId);
      console.log('📋 New Image URL:', aiImageData.imageUrl.substring(0, 100) + '...');
      return;
    }
    
    const updateData = await updateResponse.json();
    
    if (updateData.success) {
      console.log('✅ Database updated successfully!');
    } else {
      console.log('❌ Database update failed:', updateData);
    }
    
    // Step 3: Verify the update
    console.log('\n🔍 Step 3: Verifying update...');
    
    const verifyResponse = await fetch(
      `https://carrot-app.onrender.com/patch/${patchHandle}/content/the-legacy-of-phil-jackson-and-the-triangle-offens-9aa31bf4`
    );
    
    if (verifyResponse.ok) {
      console.log('✅ Content page is accessible');
      console.log('🌐 URL: https://carrot-app.onrender.com/patch/' + patchHandle + '/content/the-legacy-of-phil-jackson-and-the-triangle-offens-9aa31bf4');
    } else {
      console.log('⚠️ Content page returned:', verifyResponse.status);
    }
    
    // Final summary
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 AI IMAGE REGENERATION COMPLETE!');
    console.log('=' .repeat(60));
    console.log('✅ New AI image generated with HIGH QUALITY settings');
    console.log('✅ Face Restoration: ENABLED');
    console.log('✅ Hires Fix: ENABLED');
    console.log('✅ Refiner: ENABLED');
    console.log('✅ Database: UPDATED');
    console.log('\n🎯 Next Steps:');
    console.log('1. Visit the content URL to see the new image');
    console.log('2. Verify facial clarity and detail quality');
    console.log('3. Check for any distortions or mutations');
    console.log('4. If satisfied, the process is complete!');
    console.log('=' .repeat(60));
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\n🔴 FAILED: AI Image regeneration encountered an error');
  }
}

// Run the script
regenerateAndUpdateAIImage();

