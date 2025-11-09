import { NextResponse } from 'next/server';
import { chatStream, type ChatMessage } from '@/lib/llm/providers/DeepSeekClient';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AuditRequest {
  contentId: string;
  patchName: string;
  patchDescription: string;
  patchTags: string[];
  patchCategories: string[];
}

export async function POST(req: Request, context: { params: Promise<{}> }) {
  try {
    const { contentId, patchName, patchDescription, patchTags, patchCategories }: AuditRequest = await req.json();

    if (!contentId) {
      return NextResponse.json({ error: 'Content ID is required' }, { status: 400 });
    }

    // Fetch the content to audit
    const content = await prisma.discoveredContent.findUnique({
      where: { id: contentId },
      include: {
        patch: {
          select: {
            title: true,
            description: true,
            tags: true,
          }
        }
      }
    });

    if (!content) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }

    // Create the audit prompt for DeepSeek
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert content auditor for knowledge groups. Your task is to evaluate discovered content for relevance, accuracy, and quality.

For each piece of content, provide:
1. A relevance score (1-10) - how well does this content match the group's purpose?
2. Quality assessment - is the content well-written, informative, and valuable?
3. Accuracy check - does the content appear factual and reliable?
4. Improvement suggestions - how could this content be better?
5. Final recommendation - approve, reject, or needs revision

Guidelines:
- Be thorough but fair in your assessment
- Consider the group's tags, categories, and purpose
- Look for factual accuracy and proper sourcing
- Evaluate writing quality and informativeness
- Consider the target audience and their needs

Return your assessment as a JSON object with this exact structure:
{
  "auditScore": 8,
  "relevanceScore": 9,
  "qualityScore": 7,
  "accuracyScore": 8,
  "recommendation": "approve|reject|revise",
  "notes": "Detailed assessment notes...",
  "improvements": ["suggestion1", "suggestion2"],
  "strengths": ["strength1", "strength2"],
  "concerns": ["concern1", "concern2"]
}`
      },
      {
        role: 'user',
        content: `Please audit this discovered content for the knowledge group:

GROUP CONTEXT:
Name: "${patchName || content.patch.title}"
Description: "${patchDescription || content.patch.description || 'No description'}"
Tags: ${(patchTags || content.patch.tags).join(', ')}
Categories: ${patchCategories.join(', ')}

${(content.patch?.title ? `Patch: ${content.patch.title}\n` : '')}

CONTENT TO AUDIT:
Category: ${content.category || 'article'}
Title: "${content.title}"
Summary: "${content.summary || content.whyItMatters || 'not provided'}"
Relevance Score (from discovery): ${content.relevanceScore}
Quality Score (from discovery vetter): ${content.qualityScore}
Why It Matters: ${content.whyItMatters || 'not provided'}
Source URL: ${content.sourceUrl}

Please provide a comprehensive audit of this content.`
      }
    ];

    // Use DeepSeek to audit the content
    let fullResponse = '';
    let hasError = false;
    let errorMessage = '';

    try {
      for await (const chunk of chatStream({ 
        model: 'deepseek-chat', 
        messages, 
        temperature: 0.2, 
        max_tokens: 1024 
      })) {
        if (chunk.type === 'token' && chunk.token) {
          fullResponse += chunk.token;
        } else if (chunk.type === 'error') {
          hasError = true;
          errorMessage = chunk.error || 'Unknown error occurred';
          break;
        }
      }
    } catch (error) {
      console.error('DeepSeek audit error:', error);
      hasError = true;
      errorMessage = 'Failed to audit content';
    }

    if (hasError) {
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    // Parse the JSON response from DeepSeek
    let auditResult;
    try {
      // Clean up the response - remove any markdown formatting
      const cleanedResponse = fullResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      auditResult = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse DeepSeek audit response:', fullResponse);
      // Fallback to basic audit if parsing fails
      auditResult = {
        auditScore: 6,
        relevanceScore: content.relevanceScore,
        qualityScore: 6,
        accuracyScore: 6,
        recommendation: 'revise',
        notes: 'Audit parsing failed - manual review required',
        improvements: ['Content needs manual review'],
        strengths: ['Content was discovered by AI'],
        concerns: ['Audit parsing failed']
      };
    }

    // Validate the audit result
    const validatedResult = {
      auditScore: Math.min(10, Math.max(1, auditResult.auditScore || 5)),
      relevanceScore: Math.min(10, Math.max(1, auditResult.relevanceScore || content.relevanceScore)),
      qualityScore: Math.min(10, Math.max(1, auditResult.qualityScore || 5)),
      accuracyScore: Math.min(10, Math.max(1, auditResult.accuracyScore || 5)),
      recommendation: ['approve', 'reject', 'revise'].includes(auditResult.recommendation) 
        ? auditResult.recommendation 
        : 'revise',
      notes: auditResult.notes || 'No notes provided',
      improvements: Array.isArray(auditResult.improvements) ? auditResult.improvements.slice(0, 5) : [],
      strengths: Array.isArray(auditResult.strengths) ? auditResult.strengths.slice(0, 5) : [],
      concerns: Array.isArray(auditResult.concerns) ? auditResult.concerns.slice(0, 5) : []
    };

    // Persist audit results if needed (fields removed in v2.1 schema)
    try {
      // Placeholder for future persistence (e.g., store in metadata JSON)
    } catch (error) {
      console.warn('[Audit Content] Failed to persist audit notes', error)
    }

    return NextResponse.json({
      success: true,
      audit: validatedResult,
      updatedContent: {
        id: content.id,
        category: content.category,
        summary: content.summary,
        whyItMatters: content.whyItMatters
      }
    });

  } catch (error) {
    console.error('Error auditing content:', error);
    return NextResponse.json(
      { error: 'Failed to audit content' },
      { status: 500 }
    );
  }
}
