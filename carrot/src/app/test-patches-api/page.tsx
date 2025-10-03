'use client';

import { useState } from 'react';

export default function TestPatchesAPI() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testGET = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/patches');
      const data = await response.json();
      setResult({ method: 'GET', status: response.status, data });
    } catch (error) {
      setResult({ method: 'GET', error: error instanceof Error ? error.message : String(error) });
    }
    setLoading(false);
  };

  const testPOST = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/patches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Test Group',
          description: 'Test description',
          tags: ['test'],
          categories: ['test']
        })
      });
      const data = await response.json();
      setResult({ method: 'POST', status: response.status, data });
    } catch (error) {
      setResult({ method: 'POST', error: error instanceof Error ? error.message : String(error) });
    }
    setLoading(false);
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Test Patches API</h1>
      
      <div className="space-y-4">
        <button
          onClick={testGET}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Test GET /api/patches
        </button>
        
        <button
          onClick={testPOST}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
        >
          Test POST /api/patches
        </button>
      </div>

      {result && (
        <div className="mt-6 p-4 bg-gray-100 rounded">
          <h3 className="font-bold mb-2">Result:</h3>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
