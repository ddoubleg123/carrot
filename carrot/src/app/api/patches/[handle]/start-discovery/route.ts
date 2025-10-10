import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { handle } = await params;
    const body = await request.json();
    const { action } = body;

    if (action !== 'start_deepseek_search') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Get the patch to access its tags and description
    const patch = await prisma.patch.findUnique({
      where: { handle },
      select: {
        id: true,
        name: true,
        description: true,
        tags: true,
        createdBy: true
      }
    });

    if (!patch) {
      return NextResponse.json({ error: 'Patch not found' }, { status: 404 });
    }

    // Check if user has permission to start discovery
    const isOwner = patch.createdBy === session.user.id;
    const isMember = await prisma.patchMember.findUnique({
      where: {
        patch_user_member_unique: {
          patchId: patch.id,
          userId: session.user.id
        }
      }
    });

    if (!isOwner && !isMember) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Check if DeepSeek API key is configured
    if (!process.env.DEEPSEEK_API_KEY) {
      console.error('[Start Discovery] DEEPSEEK_API_KEY not configured', {
        patchId: patch.id,
        handle,
        userId: session.user.id,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json({ 
        error: 'Discovery service not configured. Please set DEEPSEEK_API_KEY environment variable.',
        code: 'MISSING_API_KEY',
        patchId: patch.id
      }, { status: 500 });
    }

    // Start DeepSeek-powered content discovery
    console.log('[Start Discovery] Starting DeepSeek search for patch:', {
      patchId: patch.id,
      handle,
      name: patch.name,
      tags: patch.tags,
      description: patch.description
    });

    // Call DeepSeek API to search for relevant content
    const deepSeekResponse = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: `You are a research assistant that finds high-quality, relevant content about specific topics. 
            Given a topic name, description, and tags, you should search for and return URLs to authoritative sources, 
            recent articles, academic papers, videos, and other educational content that would be valuable for learning about this topic.
            
            Focus on:
            - Academic sources and research papers
            - News articles from reputable sources
            - Educational videos and documentaries
            - Government and institutional reports
            - Expert analysis and commentary
            
            Return your findings as a JSON array of objects with this structure:
            [
              {
                "title": "Content title",
                "url": "https://example.com/article",
                "type": "article|video|paper|report|news",
                "description": "Brief description of the content",
                "relevance_score": 0.95,
                "source_authority": "high|medium|low"
              }
            ]
            
            Only return content that is highly relevant (relevance_score > 0.7) and from authoritative sources.`
          },
          {
            role: 'user',
            content: `Find high-quality content about: "${patch.name}"
            
            Description: ${patch.description || 'No description provided'}
            
            Tags: ${patch.tags.join(', ')}
            
            Please search for and return relevant, authoritative content that would help someone learn about this topic.`
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })
    });

    if (!deepSeekResponse.ok) {
      console.error('[Start Discovery] DeepSeek API error:', {
        status: deepSeekResponse.status,
        statusText: deepSeekResponse.statusText,
        patchId: patch.id,
        handle,
        userId: session.user.id,
        timestamp: new Date().toISOString()
      });
      return NextResponse.json({ 
        error: 'Failed to search for content',
        code: 'DEEPSEEK_API_ERROR',
        status: deepSeekResponse.status,
        patchId: patch.id
      }, { status: 500 });
    }

    const deepSeekData = await deepSeekResponse.json();
    const content = deepSeekData.choices?.[0]?.message?.content;

    if (!content) {
      console.error('[Start Discovery] No content returned from DeepSeek');
      return NextResponse.json({ error: 'No content found' }, { status: 500 });
    }

    // Parse the JSON response from DeepSeek
    let discoveredItems;
    try {
      // Extract JSON from the response (it might be wrapped in markdown)
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      discoveredItems = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('[Start Discovery] Failed to parse DeepSeek response:', parseError);
      return NextResponse.json({ error: 'Failed to parse search results' }, { status: 500 });
    }

    // Save discovered content to database
    const savedItems = [];
    for (const item of discoveredItems) {
      try {
        // Create a source record for each discovered item
        const source = await prisma.source.create({
          data: {
            patchId: patch.id,
            title: item.title,
            url: item.url,
            author: item.source_authority || 'Unknown',
            addedBy: session.user.id,
            citeMeta: {
              description: item.description,
              type: item.type || 'article',
              relevanceScore: item.relevance_score || 0.8,
              status: 'pending_audit'
            }
          }
        });

        savedItems.push({
          id: source.id,
          title: source.title,
          url: source.url,
          type: (source.citeMeta as any)?.type || 'article',
          description: (source.citeMeta as any)?.description || '',
          relevanceScore: (source.citeMeta as any)?.relevanceScore || 0.8,
          status: (source.citeMeta as any)?.status || 'pending_audit'
        });
      } catch (dbError) {
        console.error('[Start Discovery] Failed to save item:', item.title, dbError);
        // Continue with other items even if one fails
      }
    }

    console.log('[Start Discovery] Saved items:', savedItems.length);

    return NextResponse.json({
      success: true,
      message: `Started content discovery for "${patch.name}"`,
      itemsFound: savedItems.length,
      items: savedItems
    });

  } catch (error) {
    console.error('[Start Discovery] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
