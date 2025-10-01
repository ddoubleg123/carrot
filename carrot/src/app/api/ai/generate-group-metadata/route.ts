import { NextResponse } from 'next/server';
import { chatStream, type ChatMessage } from '@/lib/llm/providers/DeepSeekClient';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, context: { params: Promise<{}> }) {
  try {
    const { groupName, description } = await req.json();

    if (!groupName || !groupName.trim()) {
      return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
    }

    // Create the prompt for DeepSeek to generate tags and categories
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert at analyzing topics and generating relevant tags and categories for knowledge groups. 

Your task is to analyze a group name and description, then generate:
1. 8-12 relevant tags (short, descriptive keywords)
2. 3-5 relevant categories (broader topic areas)

Guidelines:
- Tags should be specific, searchable keywords
- Categories should be broad topic areas that this group would fit into
- Consider both the explicit topic and related/adjacent topics
- Think about what content would be relevant to this group
- Use lowercase for tags, title case for categories
- Be comprehensive but focused

Return your response as a JSON object with this exact structure:
{
  "tags": ["tag1", "tag2", "tag3", ...],
  "categories": ["Category 1", "Category 2", "Category 3", ...]
}`
      },
      {
        role: 'user',
        content: `Group Name: "${groupName}"
${description ? `Description: "${description}"` : ''}

Please generate relevant tags and categories for this knowledge group.`
      }
    ];

    // Use DeepSeek to generate the metadata
    let fullResponse = '';
    let hasError = false;
    let errorMessage = '';

    try {
      for await (const chunk of chatStream({ 
        model: 'deepseek-chat', 
        messages, 
        temperature: 0.3, 
        max_tokens: 512 
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
      console.error('DeepSeek API error:', error);
      hasError = true;
      errorMessage = 'Failed to generate metadata';
    }

    if (hasError) {
      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }

    // Parse the JSON response from DeepSeek
    let parsedResponse;
    try {
      // Clean up the response - remove any markdown formatting
      const cleanedResponse = fullResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();
      
      parsedResponse = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error('Failed to parse DeepSeek response:', fullResponse);
      // Fallback to basic tags if parsing fails
      parsedResponse = {
        tags: [groupName.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')],
        categories: ['General']
      };
    }

    // Validate the response structure
    if (!parsedResponse.tags || !Array.isArray(parsedResponse.tags)) {
      parsedResponse.tags = [groupName.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-')];
    }
    
    if (!parsedResponse.categories || !Array.isArray(parsedResponse.categories)) {
      parsedResponse.categories = ['General'];
    }

    // Ensure we have reasonable limits
    parsedResponse.tags = parsedResponse.tags.slice(0, 12);
    parsedResponse.categories = parsedResponse.categories.slice(0, 5);

    return NextResponse.json({
      success: true,
      metadata: parsedResponse
    });

  } catch (error) {
    console.error('Error generating group metadata:', error);
    return NextResponse.json(
      { error: 'Failed to generate group metadata' },
      { status: 500 }
    );
  }
}
