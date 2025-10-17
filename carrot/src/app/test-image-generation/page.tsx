'use client';

import { useState } from 'react';

export default function TestImageGeneration() {
  const [prompt, setPrompt] = useState('professional headshot of a woman, detailed face');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const generateImage = async () => {
    setIsGenerating(true);
    setError(null);
    setResult(null);

    try {
      console.log('🎨 Starting image generation...');
      console.log('Prompt:', prompt);

      // Test the SDXL API endpoint with form data
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('model', 'sd-lora');
      
      const response = await fetch('/api/ghibli/image', {
        method: 'POST',
        body: formData,
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Generation result:', data);
      
      setResult(data);
    } catch (err) {
      console.error('❌ Generation failed:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🧪 Test Image Generation</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Generate Image</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Prompt:
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Enter your prompt here..."
            />
          </div>

          <button
            onClick={generateImage}
            disabled={isGenerating}
            className={`px-6 py-3 rounded-md font-medium ${
              isGenerating
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white`}
          >
            {isGenerating ? '🔄 Generating...' : '🎨 Generate Image'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <h3 className="text-red-800 font-medium">❌ Error</h3>
            <p className="text-red-700 mt-1">{error}</p>
          </div>
        )}

        {result && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-6">
            <h3 className="text-green-800 font-medium">✅ Success!</h3>
            <div className="mt-2">
              <p className="text-green-700">
                <strong>Status:</strong> {result.ok ? 'Success' : 'Failed'}
              </p>
              {result.outputUrl && (
                <div className="mt-3">
                  <p className="text-green-700 mb-2">
                    <strong>Image URL:</strong>
                  </p>
                  <div className="bg-white p-3 rounded border">
                    <img 
                      src={result.outputUrl} 
                      alt="Generated" 
                      className="max-w-full h-auto rounded"
                      onError={(e) => {
                        console.error('Image load error:', e);
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-2 break-all">
                    {result.outputUrl}
                  </p>
                </div>
              )}
              {result.meta && (
                <div className="mt-3">
                  <p className="text-green-700">
                    <strong>Meta:</strong> {JSON.stringify(result.meta, null, 2)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h3 className="text-blue-800 font-medium">🔍 Debug Info</h3>
          <div className="mt-2 text-sm text-blue-700">
            <p><strong>API Endpoint:</strong> /api/ghibli/image</p>
            <p><strong>Model:</strong> sd-lora</p>
            <p><strong>Expected Flow:</strong></p>
            <ol className="list-decimal list-inside mt-1 space-y-1">
              <li>Request sent to /api/ghibli/image</li>
              <li>API tries Vast.ai worker first</li>
              <li>Falls back to local generation if worker fails</li>
              <li>Returns image URL or error</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
