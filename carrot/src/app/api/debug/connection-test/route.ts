import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const vastAiUrl = process.env.VAST_AI_URL || 'http://localhost:7860'
  
  try {
    console.log('[Debug] Testing connection to:', vastAiUrl)
    
    // Test basic connectivity
    const healthResponse = await fetch(`${vastAiUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    })
    
    const healthData = await healthResponse.json()
    
    return NextResponse.json({
      success: true,
      vastAiUrl,
      status: 'connected',
      health: healthData,
      message: '✅ Successfully connected to Vast.ai SDXL API'
    })
    
  } catch (error) {
    console.error('[Debug] Connection test failed:', error)
    
    return NextResponse.json({
      success: false,
      vastAiUrl,
      status: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
      troubleshooting: {
        checkSSHTunnel: 'Run: ssh -f -N -L 7860:localhost:7860 -p 45583 root@171.247.185.4',
        checkVastAI: 'Verify Vast.ai instance is running and SDXL API is loaded',
        checkNetwork: 'Ensure no firewall blocking localhost:7860',
        checkAPI: 'Test: curl http://localhost:7860/health'
      },
      message: '❌ Cannot connect to Vast.ai SDXL API'
    }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  const vastAiUrl = process.env.VAST_AI_URL || 'http://localhost:7860'
  
  try {
    console.log('[Debug] Testing image generation to:', vastAiUrl)
    
    // Test a simple image generation
    const testResponse = await fetch(`${vastAiUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: "simple red apple, test image",
        num_inference_steps: 10,
        width: 512,
        height: 512,
        use_refiner: false
      }),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    })
    
    if (!testResponse.ok) {
      throw new Error(`API returned ${testResponse.status}: ${testResponse.statusText}`)
    }
    
    const testData = await testResponse.json()
    
    return NextResponse.json({
      success: true,
      vastAiUrl,
      status: 'generation_working',
      testResult: {
        success: testData.success,
        hasImage: !!testData.image,
        imageSize: testData.image ? testData.image.length : 0,
        generationTime: testData.generation_time_seconds
      },
      message: '✅ Image generation test successful'
    })
    
  } catch (error) {
    console.error('[Debug] Generation test failed:', error)
    
    return NextResponse.json({
      success: false,
      vastAiUrl,
      status: 'generation_failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      troubleshooting: {
        checkModels: 'Ensure SDXL models are loaded (check Vast.ai logs)',
        checkVRAM: 'Verify GPU has enough VRAM (24GB+ recommended)',
        checkTimeout: 'Generation may be taking longer than 30s',
        checkLogs: 'Check Vast.ai instance logs for errors'
      },
      message: '❌ Image generation test failed'
    }, { status: 503 })
  }
}
