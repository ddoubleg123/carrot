import { NextRequest, NextResponse } from 'next/server';

interface CodeAnalysisRequest {
  code: string;
  fileName: string;
}

interface AnalysisResponse {
  summary: string;
  issues: Array<{
    type: 'error' | 'warning' | 'info';
    message: string;
    line?: number;
  }>;
  suggestions: string[];
  complexity: 'low' | 'medium' | 'high';
  maintainability: 'good' | 'fair' | 'poor';
}

export async function POST(request: NextRequest) {
  try {
    const { code, fileName }: CodeAnalysisRequest = await request.json();

    if (!code || !fileName) {
      return NextResponse.json(
        { error: 'Code and fileName are required' },
        { status: 400 }
      );
    }

    // Get the file extension to determine the language
    const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
    const language = getLanguageFromExtension(fileExtension);

    // Create a comprehensive analysis prompt
    const analysisPrompt = createAnalysisPrompt(code, fileName, language);

    // Call DeepSeek API for analysis
    const analysisResult = await callDeepSeekAPI(analysisPrompt);

    // Parse and structure the response
    const structuredResult = parseAnalysisResult(analysisResult, code);

    return NextResponse.json(structuredResult);
  } catch (error) {
    console.error('Code analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze code' },
      { status: 500 }
    );
  }
}

function getLanguageFromExtension(extension: string): string {
  const languageMap: { [key: string]: string } = {
    'js': 'JavaScript',
    'ts': 'TypeScript',
    'tsx': 'TypeScript React',
    'jsx': 'JavaScript React',
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
  return languageMap[extension] || 'Unknown';
}

function createAnalysisPrompt(code: string, fileName: string, language: string): string {
  return `You are an expert code analyst. Analyze the following ${language} code and provide a comprehensive analysis.

File: ${fileName}
Language: ${language}

Code:
\`\`\`${language.toLowerCase()}
${code}
\`\`\`

Please provide a detailed analysis in the following JSON format:
{
  "summary": "Brief overview of what this code does and its overall quality",
  "issues": [
    {
      "type": "error|warning|info",
      "message": "Description of the issue",
      "line": line_number_if_applicable
    }
  ],
  "suggestions": [
    "Specific improvement suggestions"
  ],
  "complexity": "low|medium|high",
  "maintainability": "good|fair|poor"
}

Focus on:
1. Code quality and best practices
2. Potential bugs or issues
3. Performance considerations
4. Security concerns
5. Maintainability and readability
6. Architecture and design patterns

Return only the JSON response, no additional text.`;
}

async function callDeepSeekAPI(prompt: string): Promise<string> {
  // Check if we have a local DeepSeek router running
  const deepSeekUrl = process.env.DEEPSEEK_ROUTER_URL || 'http://localhost:8080/v1/chat/completions';
  
  try {
    const response = await fetch(deepSeekUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Task-Type': 'rag-code', // Use code-aware task type
        'X-Risk-Level': 'low',
      },
      body: JSON.stringify({
        model: 'deepseek-coder-v2:16b',
        messages: [
          {
            role: 'system',
            content: 'You are an expert code analyst. Provide detailed, actionable analysis in JSON format.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('DeepSeek API call failed:', error);
    // Fallback to a simple analysis if DeepSeek is not available
    return generateFallbackAnalysis(prompt);
  }
}

function generateFallbackAnalysis(prompt: string): string {
  // Extract code from the prompt for basic analysis
  const codeMatch = prompt.match(/```[\s\S]*?\n([\s\S]*?)```/);
  const code = codeMatch ? codeMatch[1] : '';
  
  // Basic analysis without AI
  const lines = code.split('\n').length;
  const complexity = lines > 100 ? 'high' : lines > 50 ? 'medium' : 'low';
  
  const issues = [];
  const suggestions = [];
  
  // Basic pattern detection
  if (code.includes('console.log')) {
    issues.push({
      type: 'warning',
      message: 'Console.log statements found - consider removing for production',
    });
  }
  
  if (code.includes('TODO') || code.includes('FIXME')) {
    issues.push({
      type: 'info',
      message: 'TODO or FIXME comments found',
    });
  }
  
  if (code.length > 1000) {
    suggestions.push('Consider breaking this code into smaller functions for better maintainability');
  }
  
  if (code.includes('var ')) {
    suggestions.push('Consider using let/const instead of var for better scoping');
  }
  
  return JSON.stringify({
    summary: `Basic analysis of ${lines} lines of code. This is a fallback analysis as the AI service is not available.`,
    issues,
    suggestions,
    complexity,
    maintainability: complexity === 'low' ? 'good' : complexity === 'medium' ? 'fair' : 'poor',
  });
}

function parseAnalysisResult(analysisResult: string, code: string): AnalysisResponse {
  try {
    // Try to parse as JSON first
    const parsed = JSON.parse(analysisResult);
    return {
      summary: parsed.summary || 'Analysis completed',
      issues: parsed.issues || [],
      suggestions: parsed.suggestions || [],
      complexity: parsed.complexity || 'medium',
      maintainability: parsed.maintainability || 'fair',
    };
  } catch (error) {
    // If JSON parsing fails, create a basic response
    console.error('Failed to parse analysis result:', error);
    return {
      summary: 'Analysis completed with basic checks',
      issues: [
        {
          type: 'info',
          message: 'Unable to parse detailed analysis - using basic analysis',
        },
      ],
      suggestions: [
        'Review the code manually for best practices',
        'Consider using a linter for automated checks',
      ],
      complexity: 'medium',
      maintainability: 'fair',
    };
  }
}
