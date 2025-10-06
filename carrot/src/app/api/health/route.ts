import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    const headersList = headers();
    
    // Basic health information
    const healthInfo = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      memoryUsage: process.memoryUsage(),
      cpus: require('os').cpus().length,
      // Network and connection info
      userAgent: headersList.get('user-agent'),
      acceptEncoding: headersList.get('accept-encoding'),
      connection: headersList.get('connection'),
      // HTTP version detection
      httpVersion: request.headers.get('x-forwarded-proto') || 'http',
      // Render-specific info
      renderService: process.env.RENDER_SERVICE_ID || 'local',
      renderInstance: process.env.RENDER_INSTANCE_ID || 'local',
      // Performance metrics
      responseTime: 0, // Will be set at the end
    };

    // Test basic connectivity
    const connectivityTests = {
      database: false,
      firebase: false,
      external: false,
    };

    // Test database connectivity (if DATABASE_URL is available)
    if (process.env.DATABASE_URL) {
      try {
        // Simple connectivity test - just check if the URL is valid
        const url = new URL(process.env.DATABASE_URL);
        connectivityTests.database = true;
      } catch (error) {
        console.warn('Database connectivity test failed:', error);
      }
    }

    // Test Firebase connectivity
    if (process.env.FIREBASE_PROJECT_ID) {
      try {
        // Simple Firebase project ID validation
        connectivityTests.firebase = process.env.FIREBASE_PROJECT_ID.length > 0;
      } catch (error) {
        console.warn('Firebase connectivity test failed:', error);
      }
    }

    // Test external connectivity
    try {
      const testUrl = 'https://httpbin.org/get';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(testUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Carrot-Health-Check/1.0',
          'Connection': 'keep-alive'
        }
      });
      
      clearTimeout(timeoutId);
      connectivityTests.external = response.ok;
    } catch (error) {
      console.warn('External connectivity test failed:', error);
    }

    // Calculate response time
    healthInfo.responseTime = Date.now() - startTime;

    // Determine overall health status
    const isHealthy = connectivityTests.database && connectivityTests.firebase;
    healthInfo.status = isHealthy ? 'healthy' : 'degraded';

    return NextResponse.json({
      ...healthInfo,
      connectivity: connectivityTests,
      // Add some diagnostic information
      diagnostics: {
        nodeOptions: process.env.NODE_OPTIONS,
        httpVersion: process.env.HTTP_VERSION,
        disableHttp2: process.env.DISABLE_HTTP2,
        forceHttp1: process.env.FORCE_HTTP1,
        nodeTlsRejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED,
        nodeHttpParser: process.env.NODE_HTTP_PARSER,
      }
    }, { 
      status: isHealthy ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'X-Health-Check': 'true',
        'X-Response-Time': healthInfo.responseTime.toString(),
      }
    });

  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'X-Health-Check': 'true',
        'X-Error': 'true',
      }
    });
  }
}