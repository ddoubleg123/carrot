import { NextRequest, NextResponse } from 'next/server';
import { getHTTP1RetryStats, resetHTTP1RetryCounts } from '@/lib/http1Fetch';
import { connectionPool } from '@/lib/connectionPool';
import { http1Fetch } from '@/lib/http1Fetch';
import { globalRequestManager } from '@/lib/GlobalRequestManager';

export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    // Get current retry statistics
    const retryStats = getHTTP1RetryStats();
    const poolStatus = connectionPool.getPoolStatus();
    const globalRequestStatus = globalRequestManager.getStatus();
    
    // Test various endpoints to check network connectivity
    const connectivityTests = {
      internal: false,
      firebase: false,
      external: false,
      http1Forcing: false,
    };
    
    const testResults: Record<string, any> = {};
    
    // Test internal API
    try {
      const internalResponse = await http1Fetch('/api/health', {
        method: 'GET',
        maxRetries: 1,
        retryDelay: 500
      });
      connectivityTests.internal = internalResponse.ok;
      testResults.internal = {
        status: internalResponse.status,
        statusText: internalResponse.statusText,
        headers: Object.fromEntries(internalResponse.headers.entries())
      };
    } catch (error) {
      testResults.internal = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
    
    // Test Firebase Storage
    try {
      const firebaseUrl = 'https://firebasestorage.googleapis.com/v0/b/involuted-river-466315-p0.firebasestorage.app/o/test%2Ftest.txt?alt=media';
      const firebaseResponse = await http1Fetch(firebaseUrl, {
        method: 'HEAD',
        maxRetries: 1,
        retryDelay: 500
      });
      connectivityTests.firebase = firebaseResponse.ok;
      testResults.firebase = {
        status: firebaseResponse.status,
        statusText: firebaseResponse.statusText,
        headers: Object.fromEntries(firebaseResponse.headers.entries())
      };
    } catch (error) {
      testResults.firebase = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
    
    // Test external connectivity
    try {
      const externalResponse = await http1Fetch('https://httpbin.org/get', {
        method: 'GET',
        maxRetries: 1,
        retryDelay: 500
      });
      connectivityTests.external = externalResponse.ok;
      testResults.external = {
        status: externalResponse.status,
        statusText: externalResponse.statusText,
        headers: Object.fromEntries(externalResponse.headers.entries())
      };
    } catch (error) {
      testResults.external = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
    
    // Test HTTP/1.1 forcing effectiveness
    try {
      const http1TestResponse = await http1Fetch('https://httpbin.org/headers', {
        method: 'GET',
        maxRetries: 1,
        retryDelay: 500
      });
      connectivityTests.http1Forcing = http1TestResponse.ok;
      const http1TestData = await http1TestResponse.json();
      testResults.http1Forcing = {
        status: http1TestResponse.status,
        headers: http1TestData.headers,
        httpVersion: http1TestData.headers['X-Forwarded-Proto'] || 'unknown'
      };
    } catch (error) {
      testResults.http1Forcing = {
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
    
    const responseTime = Date.now() - startTime;
    
    return NextResponse.json({
      status: 'success',
      timestamp: new Date().toISOString(),
      responseTime,
      connectivity: connectivityTests,
      testResults,
      retryStats,
      connectionPool: poolStatus,
      globalRequestManager: globalRequestStatus,
      environment: {
        nodeOptions: process.env.NODE_OPTIONS,
        httpVersion: process.env.HTTP_VERSION,
        disableHttp2: process.env.DISABLE_HTTP2,
        forceHttp1: process.env.FORCE_HTTP1,
        nodeTlsRejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED,
        nodeHttpParser: process.env.NODE_HTTP_PARSER,
      },
      recommendations: generateRecommendations(connectivityTests, retryStats, poolStatus)
    }, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'X-Diagnostics': 'network',
        'X-Response-Time': responseTime.toString(),
      }
    });
    
  } catch (error) {
    console.error('Network diagnostics failed:', error);
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      retryStats: getHTTP1RetryStats(),
      connectionPool: connectionPool.getPoolStatus(),
    }, {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'X-Diagnostics': 'network',
        'X-Error': 'true',
      }
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    switch (action) {
      case 'reset-retry-stats':
        resetHTTP1RetryCounts();
        return NextResponse.json({
          status: 'success',
          message: 'Retry statistics reset',
          timestamp: new Date().toISOString()
        });
        
      case 'clear-connection-pool':
        // Note: connectionPool doesn't have a clear method, but we can get status
        return NextResponse.json({
          status: 'success',
          message: 'Connection pool status retrieved',
          poolStatus: connectionPool.getPoolStatus(),
          timestamp: new Date().toISOString()
        });
        
      case 'clear-request-queue':
        globalRequestManager.clearQueue();
        return NextResponse.json({
          status: 'success',
          message: 'Global request queue cleared',
          timestamp: new Date().toISOString()
        });
        
      default:
        return NextResponse.json({
          status: 'error',
          message: 'Unknown action',
          availableActions: ['reset-retry-stats', 'clear-connection-pool', 'clear-request-queue']
        }, { status: 400 });
    }
    
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      message: 'Invalid request body',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 400 });
  }
}

function generateRecommendations(
  connectivity: Record<string, boolean>,
  retryStats: Record<string, number>,
  poolStatus: Record<string, number>
): string[] {
  const recommendations: string[] = [];
  
  if (!connectivity.internal) {
    recommendations.push('Internal API connectivity failed - check server configuration');
  }
  
  if (!connectivity.firebase) {
    recommendations.push('Firebase Storage connectivity failed - check CORS configuration and network settings');
  }
  
  if (!connectivity.external) {
    recommendations.push('External connectivity failed - check network configuration and firewall settings');
  }
  
  if (!connectivity.http1Forcing) {
    recommendations.push('HTTP/1.1 forcing may not be working - check headers and configuration');
  }
  
  const totalRetries = Object.values(retryStats).reduce((sum, count) => sum + count, 0);
  if (totalRetries > 10) {
    recommendations.push('High retry count detected - consider investigating network stability');
  }
  
  const totalConnections = Object.values(poolStatus).reduce((sum, count) => sum + count, 0);
  if (totalConnections > 20) {
    recommendations.push('High connection count detected - consider connection pool optimization');
  }
  
  if (recommendations.length === 0) {
    recommendations.push('All connectivity tests passed - network appears healthy');
  }
  
  return recommendations;
}
