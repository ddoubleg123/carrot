async function directImageUpdate() {
  console.log('🔧 Direct Image Update Script');
  console.log('=' .repeat(50));
  
  const deploymentUrl = 'https://carrot-app.onrender.com';
  
  try {
    // Step 1: Generate new image
    console.log('🎨 Generating new AI image...');
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
        enableHiresFix: true
      })
    });
    
    if (!generateResponse.ok) {
      throw new Error(`Generation failed: ${generateResponse.status}`);
    }
    
    const generateData = await generateResponse.json();
    console.log('✅ Image generated:', generateData.success);
    console.log('📏 Image size:', (generateData.imageUrl.length * 0.75 / 1024).toFixed(2), 'KB');
    
    // Step 2: Find the content ID
    console.log('\n🔍 Finding content ID...');
    const contentResponse = await fetch(`${deploymentUrl}/api/patches/chicago-bulls/discovered-content`);
    const contentData = await contentResponse.json();
    
    const philJacksonItem = contentData.items.find(item => 
      item.title.toLowerCase().includes('phil jackson') || 
      item.title.toLowerCase().includes('triangle offense')
    );
    
    if (!philJacksonItem) {
      throw new Error('Phil Jackson item not found');
    }
    
    console.log('✅ Found item:', philJacksonItem.title);
    console.log('🆔 Content ID:', philJacksonItem.id);
    
    // Step 3: Try direct database update via API
    console.log('\n📡 Attempting direct update...');
    const updateResponse = await fetch(
      `${deploymentUrl}/api/patches/chicago-bulls/content/${philJacksonItem.id}/update-image`,
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
      
      // Try alternative approach - check if we can update via different endpoint
      console.log('\n🔄 Trying alternative update method...');
      
      // Let's try updating the mediaAssets field directly
      const directUpdateResponse = await fetch(`${deploymentUrl}/api/patches/chicago-bulls/content/${philJacksonItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaAssets: {
            hero: generateData.imageUrl
          }
        })
      });
      
      console.log('📊 Direct update response:', directUpdateResponse.status);
      
      if (directUpdateResponse.ok) {
        console.log('✅ Direct update successful!');
      } else {
        const directErrorText = await directUpdateResponse.text();
        console.log('❌ Direct update failed:', directErrorText);
      }
    }
    
    // Step 4: Verify the change
    console.log('\n🔍 Verifying update...');
    const verifyResponse = await fetch(`${deploymentUrl}/api/patches/chicago-bulls/discovered-content`);
    const verifyData = await verifyResponse.json();
    
    const updatedItem = verifyData.items.find(item => item.id === philJacksonItem.id);
    if (updatedItem) {
      console.log('📸 Current image URL:', updatedItem.mediaAssets?.hero?.substring(0, 80) + '...');
      
      if (updatedItem.mediaAssets?.hero === generateData.imageUrl) {
        console.log('✅ Image successfully updated!');
      } else {
        console.log('⚠️ Image may not have updated - checking in browser');
      }
    }
    
    console.log('\n🌐 Check the page:');
    console.log('https://carrot-app.onrender.com/patch/chicago-bulls/content/the-legacy-of-phil-jackson-and-the-triangle-offens-9aa31bf4');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

directImageUpdate();
