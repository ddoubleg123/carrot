const API_BASE_URL = 'https://carrot-app.onrender.com';

async function testFacialQuality() {
  console.log('🧪 Testing AI Image Generation with Facial Quality');
  console.log('=' .repeat(60));

  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/generate-hero-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: "Michael Jordan and the Chicago Bulls Championship Team",
        summary: "The 1990s Chicago Bulls dynasty led by Michael Jordan, Scottie Pippen, and Phil Jackson, featuring their championship celebrations and team dynamics",
        contentType: 'article',
        artisticStyle: 'hyperrealistic',
        enableHiresFix: true, // Enable HD for better facial quality
        enableFaceRestore: true, // Enable face restoration
        patchTheme: 'sports'
      })
    });

    if (!response.ok) {
      console.error(`❌ API error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`📄 Error details: ${errorText}`);
      return;
    }

    const data = await response.json();
    
    console.log('📊 AI Image Generation Results:');
    console.log('=' .repeat(40));
    console.log(`✅ Success: ${data.success}`);
    console.log(`🎨 Model: ${data.model || 'Unknown'}`);
    console.log(`🔧 Features Applied:`, JSON.stringify(data.featuresApplied, null, 2));
    console.log(`⏱️ Generation Time: ${data.generationTime || 'Unknown'}ms`);
    
    if (data.imageUrl) {
      console.log(`🖼️ Image URL: ${data.imageUrl.substring(0, 100)}...`);
      console.log(`📏 Image Type: ${data.imageUrl.startsWith('data:image/') ? 'Base64 Data URL' : 'External URL'}`);
      
      // Check if it's a base64 image (AI generated)
      if (data.imageUrl.startsWith('data:image/')) {
        console.log('✅ AI Generated Image (Base64)');
      } else {
        console.log('⚠️ External URL (Not AI Generated)');
      }
    } else {
      console.log('❌ No image URL returned');
    }

    console.log('\n🎯 Facial Quality Test Complete');
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('❌ Error testing facial quality:', error.message);
  }
}

testFacialQuality();
