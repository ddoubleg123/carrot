'use client';

import { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Textarea } from '../../../components/ui/textarea';
import { Badge } from '../../../components/ui/badge';
import { FileText, Upload, Code, AlertCircle, CheckCircle, Clock } from 'lucide-react';

interface AnalysisResult {
  fileName: string;
  fileType: string;
  analysis: {
    summary: string;
    issues: Array<{
      type: 'error' | 'warning' | 'info';
      message: string;
      line?: number;
    }>;
    suggestions: string[];
    complexity: 'low' | 'medium' | 'high';
    maintainability: 'good' | 'fair' | 'poor';
  };
  timestamp: Date;
}

export default function CodeAnalysisPage() {
  const [fileContent, setFileContent] = useState('');
  const [fileName, setFileName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setFileContent(content);
        setFileName(file.name);
        setError(null);
        setAnalysisResult(null);
      };
      reader.readAsText(file);
    }
  };

  const analyzeFile = async (content: string, name: string) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      // Call the DeepSeek API for code analysis
      const response = await fetch('/api/analyze-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: content,
          fileName: name,
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const result = await response.json();
      
      // Transform the result into our expected format
      const analysisResult: AnalysisResult = {
        fileName: name,
        fileType: getFileType(name),
        analysis: {
          summary: result.summary || 'Code analysis completed',
          issues: result.issues || [],
          suggestions: result.suggestions || [],
          complexity: result.complexity || 'medium',
          maintainability: result.maintainability || 'fair',
        },
        timestamp: new Date(),
      };

      setAnalysisResult(analysisResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getFileType = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const typeMap: { [key: string]: string } = {
      'js': 'JavaScript',
      'ts': 'TypeScript',
      'tsx': 'React TypeScript',
      'jsx': 'React JavaScript',
      'py': 'Python',
      'java': 'Java',
      'go': 'Go',
      'rs': 'Rust',
      'cpp': 'C++',
      'c': 'C',
      'cs': 'C#',
      'php': 'PHP',
      'rb': 'Ruby',
      'swift': 'Swift',
      'kt': 'Kotlin',
    };
    return typeMap[extension || ''] || 'Unknown';
  };

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'low':
        return 'bg-green-100 text-green-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'high':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getMaintainabilityColor = (maintainability: string) => {
    switch (maintainability) {
      case 'good':
        return 'bg-green-100 text-green-800';
      case 'fair':
        return 'bg-yellow-100 text-yellow-800';
      case 'poor':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Code Analysis</h1>
        <p className="text-gray-600">
          Upload your code files for comprehensive analysis including issues, suggestions, and maintainability insights.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Code File
            </CardTitle>
            <CardDescription>
              Select a code file to analyze. Supports JavaScript, TypeScript, Python, and more.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <input
                type="file"
                accept=".js,.ts,.tsx,.jsx,.py,.java,.go,.rs,.cpp,.c,.cs,.php,.rb,.swift,.kt"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>

            {fileContent && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    File: {fileName}
                  </label>
                  <Textarea
                    value={fileContent}
                    onChange={(e) => setFileContent(e.target.value)}
                    placeholder="Paste your code here or upload a file..."
                    className="min-h-[300px] font-mono text-sm"
                  />
                </div>

                <Button
                  onClick={() => analyzeFile(fileContent, fileName)}
                  disabled={isAnalyzing || !fileContent.trim()}
                  className="w-full"
                >
                  {isAnalyzing ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Code className="h-4 w-4 mr-2" />
                      Analyze Code
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analysis Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Analysis Results
            </CardTitle>
            <CardDescription>
              Detailed analysis of your code including issues and suggestions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Analysis Error</span>
                </div>
                <p className="text-red-700 mt-1">{error}</p>
              </div>
            )}

            {analysisResult ? (
              <div className="space-y-6">
                {/* File Info */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{analysisResult.fileName}</h3>
                    <p className="text-sm text-gray-600">{analysisResult.fileType}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={getComplexityColor(analysisResult.analysis.complexity)}>
                      {analysisResult.analysis.complexity} complexity
                    </Badge>
                    <Badge className={getMaintainabilityColor(analysisResult.analysis.maintainability)}>
                      {analysisResult.analysis.maintainability} maintainability
                    </Badge>
                  </div>
                </div>

                {/* Summary */}
                <div>
                  <h4 className="font-medium mb-2">Summary</h4>
                  <p className="text-sm text-gray-700">{analysisResult.analysis.summary}</p>
                </div>

                {/* Issues */}
                {analysisResult.analysis.issues.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Issues Found</h4>
                    <div className="space-y-2">
                      {analysisResult.analysis.issues.map((issue, index) => (
                        <div key={index} className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
                          {getIssueIcon(issue.type)}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{issue.message}</p>
                            {issue.line && (
                              <p className="text-xs text-gray-500 mt-1">Line {issue.line}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggestions */}
                {analysisResult.analysis.suggestions.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-3">Suggestions</h4>
                    <div className="space-y-2">
                      {analysisResult.analysis.suggestions.map((suggestion, index) => (
                        <div key={index} className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                          <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                          <p className="text-sm text-blue-800">{suggestion}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-500 pt-4 border-t">
                  Analyzed at {analysisResult.timestamp.toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Upload a code file to see analysis results</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
