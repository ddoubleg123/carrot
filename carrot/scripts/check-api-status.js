const API_BASE_URL = 'https://carrot-app.onrender.com';
const PATCH_HANDLE = 'chicago-bulls';

async function checkAPIStatus() {
  console.log('🔍 Checking Chicago Bulls Page via API');
  console.log('=' .repeat(60));

  try {
    // Get discovered content from the API
    const response = await fetch(`${API_BASE_URL}/api/patches/${PATCH_HANDLE}/discovered-content`);
    
    if (!response.ok) {
      console.error(`❌ API error: ${response.status} ${response.statusText}`);
      return;
    }

    const data = await response.json();
    const items = data.items || [];

    console.log(`📊 Total items from API: ${items.length}\n`);

    // Categorize items by image type
    const categories = {
      placeholder: [],
      aiGenerated: [],
      external: [],
      noImage: []
    };

    items.forEach(item => {
      const heroUrl = item.mediaAssets?.hero;
      
      if (!heroUrl) {
        categories.noImage.push(item);
      } else if (heroUrl.includes('Question_mark') || 
                 heroUrl.includes('ui-avatars.com') ||
                 heroUrl.includes('placeholder') ||
                 heroUrl.includes('fallback')) {
        categories.placeholder.push(item);
      } else if (heroUrl.startsWith('data:image/')) {
        categories.aiGenerated.push(item);
      } else {
        categories.external.push(item);
      }
    });

    // Display results
    console.log('📈 Image Status Breakdown:');
    console.log('=' .repeat(40));
    console.log(`🔴 Placeholders: ${categories.placeholder.length}`);
    console.log(`🟢 AI Generated: ${categories.aiGenerated.length}`);
    console.log(`🔵 External URLs: ${categories.external.length}`);
    console.log(`⚪ No Image: ${categories.noImage.length}`);
    console.log('=' .repeat(40));

    if (categories.placeholder.length > 0) {
      console.log('\n🔴 Items with Placeholder Images:');
      categories.placeholder.slice(0, 10).forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.title}`);
        console.log(`      Hero URL: ${item.mediaAssets?.hero?.substring(0, 80)}...`);
      });
      if (categories.placeholder.length > 10) {
        console.log(`   ... and ${categories.placeholder.length - 10} more`);
      }
    }

    if (categories.aiGenerated.length > 0) {
      console.log('\n🟢 Items with AI Generated Images:');
      categories.aiGenerated.slice(0, 5).forEach((item, index) => {
        console.log(`   ${index + 1}. ${item.title}`);
      });
      if (categories.aiGenerated.length > 5) {
        console.log(`   ... and ${categories.aiGenerated.length - 5} more`);
      }
    }

    console.log('\n' + '=' .repeat(60));
    console.log(`🎯 ANSWER: ${categories.placeholder.length} items need placeholder replacement`);
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('❌ Error checking API:', error.message);
  }
}

checkAPIStatus();
