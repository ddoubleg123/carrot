// Test production API to see if our fixes are deployed
const testProductionAPI = async () => {
  try {
    console.log('🧪 Testing production API...');
    
    const response = await fetch('https://carrot-app.onrender.com/api/ai/generate-hero-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Michael Jordan eating ice cream',
        summary: 'Michael Jordan eating ice cream inside a basketball arena',
        artisticStyle: 'photorealistic',
        enableHiresFix: false
      })
    });

    const data = await response.json();
    
    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Data:', JSON.stringify(data, null, 2));
    
    if (response.ok) {
      console.log('✅ SUCCESS: Image generated!');
    } else {
      console.log('❌ ERROR:', data.error);
      
      // Check if it's still the old pre-emptive blocking
      if (data.error && data.error.includes('violates content safety rules')) {
        console.log('🚨 OLD CODE: Still using pre-emptive blocking');
      } else {
        console.log('✅ NEW CODE: Using updated error handling');
      }
    }
    
  } catch (error) {
    console.error('❌ Network Error:', error.message);
  }
};

testProductionAPI();
