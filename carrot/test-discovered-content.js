const fetch = require('node-fetch');

async function testDiscoveredContent() {
  try {
    console.log('🧪 Testing discovered content API...\n');
    
    const response = await fetch('https://carrot-app.onrender.com/api/patches/israel-14/discovered-content');
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    const data = await response.json();
    console.log('\nResponse data:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.items && Array.isArray(data.items)) {
      console.log(`\n✅ Found ${data.items.length} items`);
      if (data.items.length > 0) {
        console.log('First item:', JSON.stringify(data.items[0], null, 2));
      }
    } else {
      console.log('❌ No items array found');
    }
    
  } catch (error) {
    console.error('❌ Error testing API:', error);
  }
}

testDiscoveredContent();
