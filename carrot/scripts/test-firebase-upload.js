async function testFirebaseUpload() {
  console.log('🔥 Testing Firebase Upload');
  console.log('=' .repeat(40));
  
  try {
    // Test the uploadToFirebase function directly
    const { uploadToFirebase } = await import('../src/lib/uploadToFirebase.js');
    
    // Create a small test image (1x1 pixel PNG)
    const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const buffer = Buffer.from(testImageBase64, 'base64');
    
    console.log('📤 Testing Firebase upload with small test image...');
    console.log('📏 Test image size:', (buffer.length / 1024).toFixed(2), 'KB');
    
    const filename = `test-${Date.now()}.png`;
    const uploadResult = await uploadToFirebase(buffer, filename, 'image/png');
    
    console.log('📊 Upload result:', uploadResult);
    
    if (uploadResult.success) {
      console.log('✅ Firebase upload working!');
      console.log('🔗 Test URL:', uploadResult.url);
    } else {
      console.log('❌ Firebase upload failed:', uploadResult.error);
    }
    
  } catch (error) {
    console.error('❌ Error testing Firebase:', error.message);
    console.log('🔍 This might be a configuration issue');
  }
}

testFirebaseUpload();
