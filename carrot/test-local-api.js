// Test local API
async function test() {
  try {
    console.log('Testing local API at http://localhost:3005/api/ai/generate-hero-image...');
    
    const response = await fetch('http://localhost:3005/api/ai/generate-hero-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: 'Michael Jordan eating ice cream',
        summary: 'Michael Jordan eating ice cream inside a basketball arena',
        artisticStyle: 'photorealistic'
      })
    });
    
    console.log('Status:', response.status);
    
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('✅ SUCCESS! Image generated');
    } else {
      console.log('❌ ERROR:', data.error);
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

test();

