import { NextResponse } from 'next/server';
import { chatStream, type ChatMessage } from '@/lib/llm/providers/DeepSeekClient';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface DiscoveryRequest {
  patchId: string;
  patchName: string;
  description: string;
  tags: string[];
  categories: string[];
}

interface DiscoveredContent {
  type: 'document' | 'source' | 'discussion_topic' | 'timeline_event';
  title: string;
  content: string;
  relevance_score: number;
  source_url?: string;
  tags: string[];
}

export async function POST(req: Request, context: { params: Promise<{}> }) {
  try {
    const { patchId, patchName, description, tags, categories }: DiscoveryRequest = await req.json();

    if (!patchId || !patchName) {
      return NextResponse.json({ error: 'Patch ID and name are required' }, { status: 400 });
    }

    // Create the discovery prompt for DeepSeek
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert knowledge discovery agent. Your task is to find and generate relevant content for a knowledge group based on its name, description, tags, and categories.

For each piece of content you discover, provide:
1. A realistic title
2. Detailed, informative content (2-3 paragraphs)
3. A relevance score (1-10)
4. Relevant tags from the group's tag list
5. REAL source URL (use actual, accessible websites - NOT fictional URLs)

Content types to discover:
- Documents: Research papers, guides, tutorials, reports
- Sources: Websites, tools, organizations, experts
- Discussion Topics: Questions, debates, case studies
- Timeline Events: Historical events, milestones, developments

Guidelines:
- Generate 3-5 pieces of content total
- Mix different content types
- Make content realistic and valuable
- Use the group's tags and categories as context
- Ensure high relevance (score 7+)
- CRITICAL: Use REAL, accessible URLs that actually exist and have content

Real URL examples for different topics:
- Sports: ESPN, official team websites, league websites, reputable sports news
- Tech: GitHub, Stack Overflow, official documentation, reputable tech blogs
- Business: company websites, industry publications, government sites
- News: major news outlets, official press releases, verified sources

Return as JSON array with this exact structure:
[
  {
    "type": "document|source|discussion_topic|timeline_event",
    "title": "Content Title",
    "content": "Detailed content here...",
    "relevance_score": 8,
    "source_url": "https://real-website.com/actual-page",
    "tags": ["tag1", "tag2"]
  }
]`
      },
      {
        role: 'user',
        content: `Discover content for this knowledge group:

Name: "${patchName}"
Description: "${description || 'No description provided'}"
Tags: ${tags.join(', ')}
Categories: ${categories.join(', ')}

Generate 3-5 relevant pieces of content that would be valuable for this group.`
      }
    ];

    // Use DeepSeek to discover content
    let fullResponse = '';
    let hasError = false;
    let errorMessage = '';

    try {
      for await (const chunk of chatStream({ 
        model: 'deepseek-chat', 
        messages, 
        temperature: 0.4, 
        max_tokens: 2048 
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
      console.error('DeepSeek discovery error:', error);
      hasError = true;
      errorMessage = 'Failed to discover content';
    }

    if (hasError) {
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    // Parse the JSON response from DeepSeek
    let discoveredContent: DiscoveredContent[] = [];
    try {
      // Clean up the response - remove any markdown formatting
      const cleanedResponse = fullResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      discoveredContent = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse DeepSeek discovery response:', fullResponse);
      // Fallback to basic content if parsing fails
      discoveredContent = [
        {
          type: 'document',
          title: `Introduction to ${patchName}`,
          content: `This is a comprehensive guide to ${patchName}. ${description || 'This group focuses on exploring and understanding this topic in depth.'}`,
          relevance_score: 8,
          source_url: 'https://www.wikipedia.org',
          tags: tags.slice(0, 2)
        }
      ];
    }

    // Validate and clean the discovered content
    discoveredContent = discoveredContent
      .filter(item => item && item.title && item.content)
      .map(item => ({
        ...item,
        relevance_score: Math.min(10, Math.max(1, item.relevance_score || 5)),
        tags: Array.isArray(item.tags) ? item.tags.slice(0, 3) : []
      }))
      .slice(0, 5); // Limit to 5 items

    // Store discovered content in database
    const storedContent = [];
    for (const item of discoveredContent) {
      try {
        const stored = await prisma.discoveredContent.create({
          data: {
            patchId,
            type: item.type,
            title: item.title,
            content: item.content,
            relevanceScore: item.relevance_score,
            sourceUrl: item.source_url,
            tags: item.tags,
            status: 'pending'
          }
        });
        storedContent.push(stored);
      } catch (error) {
        console.error('Failed to store discovered content:', error);
        // Continue with other items even if one fails
      }
    }

    // Trigger automatic audit for discovered content (in background)
    if (storedContent.length > 0) {
      // Don't await this - let it run in background
      fetch(`${new URL(req.url).origin}/api/ai/batch-audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patchId,
          limit: Math.min(3, storedContent.length) // Audit first 3 items automatically
        }),
      }).catch(error => {
        console.error('Background audit failed:', error);
        // Don't fail the discovery if audit fails
      });
    }

    return NextResponse.json({
      success: true,
      patchId,
      discoveredContent: storedContent,
      totalItems: storedContent.length
    });

  } catch (error) {
    console.error('Error discovering content:', error);
    return NextResponse.json(
      { error: 'Failed to discover content' },
      { status: 500 }
    );
  }
}
