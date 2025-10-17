"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface TestResult {
  test: string;
  success: boolean;
  message: string;
  details?: any;
  troubleshooting?: any;
}

export default function DebugConnectionPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);

  const runConnectionTest = async () => {
    setIsTesting(true);
    setResults([]);

    const tests: TestResult[] = [];

    try {
      // Test 1: Basic connectivity
      console.log('[Debug] Testing basic connectivity...');
      const healthResponse = await fetch('/api/debug/connection-test');
      const healthData = await healthResponse.json();
      
      tests.push({
        test: 'Basic Connection',
        success: healthData.success,
        message: healthData.message,
        details: healthData.health,
        troubleshooting: healthData.troubleshooting
      });

      if (healthData.success) {
        // Test 2: Image generation
        console.log('[Debug] Testing image generation...');
        const genResponse = await fetch('/api/debug/connection-test', {
          method: 'POST'
        });
        const genData = await genResponse.json();
        
        tests.push({
          test: 'Image Generation',
          success: genData.success,
          message: genData.message,
          details: genData.testResult,
          troubleshooting: genData.troubleshooting
        });
      }

    } catch (error) {
      tests.push({
        test: 'Network Error',
        success: false,
        message: `Failed to run tests: ${error instanceof Error ? error.message : 'Unknown error'}`,
        details: { error }
      });
    }

    setResults(tests);
    setIsTesting(false);
  };

  const startSSHTunnel = () => {
    const command = 'ssh -f -N -L 7860:localhost:7860 -p 45583 root@171.247.185.4';
    
    // Copy to clipboard
    navigator.clipboard.writeText(command).then(() => {
      alert(`Command copied to clipboard!\n\nRun this in your terminal:\n${command}\n\nThen refresh this page and test again.`);
    }).catch(() => {
      alert(`Run this command in your terminal:\n${command}\n\nThen refresh this page and test again.`);
    });
  };

  const getStatusIcon = (success: boolean) => {
    if (success) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    } else {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  const getStatusBadge = (success: boolean) => {
    return (
      <Badge variant={success ? "default" : "destructive"}>
        {success ? 'Success' : 'Failed'}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">🔧 Connection Debug Tool</h1>
        <p className="text-gray-600 mb-4">
          Test the connection to Vast.ai SDXL API and troubleshoot issues.
        </p>
        
        <div className="flex gap-4 items-center">
          <Button 
            onClick={runConnectionTest} 
            disabled={isTesting}
            className="flex items-center gap-2"
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {isTesting ? 'Testing...' : 'Run Connection Tests'}
          </Button>
          
          <Button 
            onClick={startSSHTunnel} 
            variant="outline"
          >
            Copy SSH Tunnel Command
          </Button>
        </div>
      </div>

      {/* Quick Fix Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Quick Fix: Start SSH Tunnel
          </CardTitle>
          <CardDescription>
            The most common issue is a missing SSH tunnel to Vast.ai
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold mb-2">Step 1: Open Terminal</h4>
              <p className="text-sm text-gray-600 mb-2">Open PowerShell or Command Prompt</p>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold mb-2">Step 2: Run SSH Tunnel Command</h4>
              <code className="block p-2 bg-black text-green-400 rounded text-sm">
                ssh -f -N -L 7860:localhost:7860 -p 45583 root@171.247.185.4
              </code>
              <p className="text-sm text-gray-600 mt-2">
                This creates a tunnel from your local port 7860 to Vast.ai's SDXL API
              </p>
            </div>
            
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold mb-2">Step 3: Test Connection</h4>
              <p className="text-sm text-gray-600 mb-2">
                Click "Run Connection Tests" above to verify the tunnel is working
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              Connection and functionality test results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {results.map((result, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(result.success)}
                      <h3 className="font-semibold">{result.test}</h3>
                    </div>
                    {getStatusBadge(result.success)}
                  </div>
                  
                  <p className="text-sm mb-3">{result.message}</p>
                  
                  {result.details && (
                    <details className="mb-3">
                      <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                        Show Details
                      </summary>
                      <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </details>
                  )}
                  
                  {result.troubleshooting && !result.success && (
                    <div className="border-l-4 border-orange-500 pl-4">
                      <h4 className="font-medium text-orange-800 mb-2">Troubleshooting Steps:</h4>
                      <ul className="text-sm text-orange-700 space-y-1">
                        {Object.entries(result.troubleshooting).map(([key, value]) => (
                          <li key={key}>
                            <strong>{key}:</strong> {value as string}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Environment Info */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Environment Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Vast.ai URL:</strong>
              <br />
              <code className="bg-gray-100 px-2 py-1 rounded">
                {process.env.NEXT_PUBLIC_VAST_AI_URL || 'http://localhost:7860'}
              </code>
            </div>
            <div>
              <strong>Expected Port:</strong>
              <br />
              <code className="bg-gray-100 px-2 py-1 rounded">7860</code>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-semibold text-blue-800 mb-2">💡 How This Works</h4>
            <p className="text-sm text-blue-700">
              The Carrot app connects to your local port 7860, which should be tunneled to Vast.ai's SDXL API. 
              When the SSH tunnel is active, requests to <code>localhost:7860</code> are forwarded to the Vast.ai instance.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
