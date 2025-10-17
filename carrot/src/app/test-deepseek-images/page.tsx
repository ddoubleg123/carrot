"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Loader2, Image as ImageIcon, Download } from 'lucide-react';

interface TestResult {
  prompt: string;
  imageUrl: string | null;
  error: string | null;
  loading: boolean;
  timestamp: string;
}

// Helper function to format timestamp consistently
const formatTimestamp = (timestamp: string) => {
  const date = new Date(parseInt(timestamp));
  return date.toLocaleTimeString();
};

export default function TestDeepSeekImagesPage() {
  const [title, setTitle] = useState('Derrick Rose MVP Season Analysis');
  const [summary, setSummary] = useState('Comprehensive look at Derrick Rose\'s 2011 MVP season with the Bulls, including his stats, impact on the team, and legacy in Chicago basketball.');
  const [sourceDomain, setSourceDomain] = useState('theathletic.com');
  const [patchTheme, setPatchTheme] = useState('Sports');
  const [contentType, setContentType] = useState('article');
  const [artisticStyle, setArtisticStyle] = useState('hyperrealistic');
  const [enableHiresFix, setEnableHiresFix] = useState(true); // Default to true for HD quality
  const [results, setResults] = useState<TestResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const generateImage = async () => {
    setIsGenerating(true);
    const timestamp = Date.now().toString();
    
    // Add loading result
    const loadingResult: TestResult = {
      prompt: `Generating for: ${title}`,
      imageUrl: null,
      error: null,
      loading: true,
      timestamp
    };
    
    setResults(prev => [loadingResult, ...prev]);

    try {
      console.log('[TestDeepSeek] Starting image generation...');
      
      const response = await fetch('/api/ai/generate-hero-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          summary,
          sourceDomain,
          contentType,
          patchTheme,
          artisticStyle,
          enableHiresFix
        })
      });

      const data = await response.json();
      
      console.log('[TestDeepSeek] API Response:', data);

      if (response.ok && data.imageUrl) {
        // Update the loading result with success
        setResults(prev => prev.map(result => 
          result.timestamp === timestamp 
            ? {
                prompt: data.prompt || `Generated for: ${title}`,
                imageUrl: data.imageUrl,
                error: null,
                loading: false,
                timestamp
              }
            : result
        ));
        
        console.log('[TestDeepSeek] ✅ Image generated successfully:', data.imageUrl);
      } else {
        // Update the loading result with error
        setResults(prev => prev.map(result => 
          result.timestamp === timestamp 
            ? {
                prompt: `Failed for: ${title}`,
                imageUrl: null,
                error: data.error || 'Unknown error occurred',
                loading: false,
                timestamp
              }
            : result
        ));
        
        console.error('[TestDeepSeek] ❌ Image generation failed:', data.error);
      }
    } catch (error) {
      console.error('[TestDeepSeek] Network error:', error);
      
      // Update the loading result with error
      setResults(prev => prev.map(result => 
        result.timestamp === timestamp 
          ? {
              prompt: `Error for: ${title}`,
              imageUrl: null,
              error: error instanceof Error ? error.message : 'Network error',
              loading: false,
              timestamp
            }
          : result
      ));
    } finally {
      setIsGenerating(false);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">DeepSeek Janus Pro Image Generation Test</h1>
        <p className="text-gray-600 mb-4">
          Test the DeepSeek Janus Pro API integration for generating hero images.
        </p>
        
        <div className="flex gap-4 items-center">
          <Button 
            onClick={generateImage} 
            disabled={isGenerating}
            className="flex items-center gap-2"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
            {isGenerating ? 'Generating...' : 'Generate Image'}
          </Button>
          
          <Button 
            onClick={clearResults} 
            variant="outline"
            disabled={isGenerating}
          >
            Clear Results
          </Button>
          
          <Badge variant={isGenerating ? "secondary" : "default"}>
            {isGenerating ? 'Generating...' : 'Ready'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Form */}
        <Card>
          <CardHeader>
            <CardTitle>Image Generation Parameters</CardTitle>
            <CardDescription>
              Configure the parameters for AI image generation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Article title..."
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Summary</label>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Article summary..."
                className="w-full min-h-[100px]"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Source Domain</label>
                <Input
                  value={sourceDomain}
                  onChange={(e) => setSourceDomain(e.target.value)}
                  placeholder="theathletic.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Patch Theme</label>
                <Input
                  value={patchTheme}
                  onChange={(e) => setPatchTheme(e.target.value)}
                  placeholder="Sports"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Content Type</label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="article">Article</option>
                <option value="video">Video</option>
                <option value="pdf">PDF</option>
                <option value="image">Image</option>
                <option value="text">Text</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Artistic Style</label>
              <select
                value={artisticStyle}
                onChange={(e) => setArtisticStyle(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="hyperrealistic">🎭 Hyper-Realistic (Photorealistic)</option>
                <option value="illustration">🎨 Illustration (Stylized Art)</option>
                <option value="animation">🎬 Animation (Cartoon/Anime Style)</option>
                <option value="painting">🖼️ Painting (Artistic Brushwork)</option>
                <option value="digital_art">💻 Digital Art (Modern CGI)</option>
                <option value="sketch">✏️ Sketch (Pencil/Drawing)</option>
                <option value="watercolor">🎨 Watercolor (Soft & Flowing)</option>
                <option value="oil_painting">🖌️ Oil Painting (Classic Art)</option>
                <option value="minimalist">⚪ Minimalist (Clean & Simple)</option>
                <option value="vintage">📸 Vintage (Retro Photography)</option>
              </select>
            </div>
            
            <div className="flex items-center justify-between border rounded-lg p-3 bg-white">
              <div>
                <div className="font-medium">HD (High-Resolution Fix)</div>
                <div className="text-sm text-slate-500">
                  Enables extra resolution enhancement (~10s slower)
                </div>
              </div>
              {isClient ? (
                <Switch
                  checked={enableHiresFix}
                  onCheckedChange={(val) => setEnableHiresFix(!!val)}
                />
              ) : (
                <div className="h-6 w-11 bg-gray-200 rounded-full animate-pulse"></div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card>
          <CardHeader>
            <CardTitle>Generation Results</CardTitle>
            <CardDescription>
              {results.length} image{results.length !== 1 ? 's' : ''} generated
            </CardDescription>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No images generated yet. Click "Generate Image" to test.
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {results.map((result, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={result.loading ? "secondary" : result.error ? "destructive" : "default"}>
                        {result.loading ? 'Generating...' : result.error ? 'Failed' : 'Success'}
                      </Badge>
                      <span className="text-xs text-gray-500">{formatTimestamp(result.timestamp)}</span>
                    </div>
                    
                    {result.loading ? (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Generating image...</span>
                      </div>
                    ) : result.error ? (
                      <div className="text-red-600 text-sm">
                        <strong>Error:</strong> {result.error}
                      </div>
                    ) : result.imageUrl ? (
                      <div>
                        <div className="mb-2">
                          <strong className="text-sm">Prompt:</strong>
                          <p className="text-sm text-gray-600 mt-1">{result.prompt}</p>
                        </div>
                        
                        <div className="relative">
                          <img
                            src={result.imageUrl}
                            alt="Generated image"
                            className="w-full h-auto rounded-lg border"
                            onError={(e) => {
                              console.error('Image failed to load:', result.imageUrl);
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          
                          {result.imageUrl && (
                            <div className="absolute top-2 right-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = result.imageUrl!;
                                  link.download = `deepseek-generated-${result.timestamp}.jpg`;
                                  link.click();
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-2 text-xs text-gray-500 break-all">
                          <strong>URL:</strong> {result.imageUrl}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* API Status */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>API Status & Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <strong>API Endpoint:</strong>
              <br />
              <code className="bg-gray-100 px-2 py-1 rounded">/api/ai/generate-hero-image</code>
            </div>
            <div>
              <strong>Model:</strong>
              <br />
              <code className="bg-gray-100 px-2 py-1 rounded">janus-pro-1b</code>
            </div>
            <div>
              <strong>Image Size:</strong>
              <br />
              <code className="bg-gray-100 px-2 py-1 rounded">1280x720</code>
            </div>
          </div>
          
          <div className="mt-4 text-sm text-gray-600">
            <p>
              <strong>Note:</strong> This test page calls the DeepSeek Janus Pro API directly. 
              Check the browser console and network tab for detailed API responses and any errors.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
