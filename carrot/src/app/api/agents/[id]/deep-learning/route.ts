import { NextRequest, NextResponse } from 'next/server';
import { AgentSpecificRetriever } from '@/lib/ai-agents/agentSpecificRetriever';
import { AgentRegistry } from '@/lib/ai-agents/agentRegistry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/agents/[id]/deep-learning - Comprehensive agent training
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { 
      maxResults = 50,
      autoFeed = true,
      sourceTypes = ['wikipedia', 'arxiv', 'news', 'academic', 'books', 'papers']
    } = body;

    // Get agent details
    const agent = await AgentRegistry.getAgentById(id);
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    console.log(`[Deep Learning] Starting comprehensive training for ${agent.name}`);

    // Generate multiple search queries based on agent's expertise
    const searchQueries = generateComprehensiveQueries(agent);
    
    const allResults = [];
    let totalProcessed = 0;

    // Get existing memories to avoid duplicates across all queries
    const { FeedService } = await import('@/lib/ai-agents/feedService');
    const existingMemories = await FeedService.getRecentMemories(id, 200);
    const existingUrls = new Set(existingMemories.map(m => m.sourceUrl).filter(Boolean));
    const existingTitles = new Set(existingMemories.map(m => m.sourceTitle).filter(Boolean));

    // Process each query with comprehensive search
    for (const query of searchQueries) {
      try {
        const result = await AgentSpecificRetriever.retrieveForAgent({
          agentId: id,
          maxResults: Math.min(10, maxResults - totalProcessed), // Distribute results across queries
          autoFeed: false, // We'll handle feeding manually to avoid duplicates
          sourceTypes
        });

        if (result.success && result.results) {
          // Filter out duplicates before adding to results
          const newResults = result.results.filter(content => 
            !existingUrls.has(content.url) && !existingTitles.has(content.title)
          );
          
          allResults.push(...newResults);
          totalProcessed += newResults.length;
          
          console.log(`[Deep Learning] Query "${query}": ${result.results.length} found, ${newResults.length} new`);
        }

        // Don't exceed maxResults
        if (totalProcessed >= maxResults) {
          break;
        }

        // Small delay to avoid overwhelming APIs
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.warn(`[Deep Learning] Error processing query "${query}":`, error);
        continue;
      }
    }

    // Feed all new content at once
    if (autoFeed && allResults.length > 0) {
      console.log(`[Deep Learning] Feeding ${allResults.length} new pieces of content to ${agent.name}`);
      for (const content of allResults) {
        try {
          const { FeedService } = await import('@/lib/ai-agents/feedService');
          const feedItem = {
            content: content.content,
            sourceType: 'url' as const,
            sourceUrl: content.url,
            sourceTitle: content.title,
            sourceAuthor: content.sourceAuthor,
            tags: [agent.name.toLowerCase(), ...agent.domainExpertise]
          };
          
          await FeedService.feedAgent(id, feedItem, 'deep-learning');
        } catch (error) {
          console.error(`[Deep Learning] Error feeding content:`, error);
        }
      }
    }

    // Get updated training record
    const trainingRecord = await AgentSpecificRetriever.getAgentTrainingRecord(id);

    console.log(`[Deep Learning] Completed training for ${agent.name}: ${allResults.length} items processed`);

    return NextResponse.json({
      success: true,
      agentId: id,
      agentName: agent.name,
      results: allResults,
      trainingRecord,
      message: `Deep learning complete! Processed ${allResults.length} pieces of content for ${agent.name}`
    });

  } catch (error) {
    console.error('Error in deep learning:', error);
    return NextResponse.json(
      { error: 'Failed to perform deep learning' },
      { status: 500 }
    );
  }
}

// Generate comprehensive search queries based on agent expertise
function generateComprehensiveQueries(agent: any): string[] {
  const queries = [];
  
  // Add queries for each domain expertise with more variety
  for (const domain of agent.domainExpertise) {
    queries.push(domain);
    queries.push(`${domain} research`);
    queries.push(`${domain} theory`);
    queries.push(`${domain} applications`);
    queries.push(`recent ${domain} developments`);
    queries.push(`${domain} history`);
    queries.push(`${domain} future trends`);
    queries.push(`${domain} case studies`);
    queries.push(`${domain} methodology`);
    queries.push(`${domain} controversies`);
  }

  // Add general queries based on agent's role/persona with more depth
  if (agent.persona) {
    const personaLower = agent.persona.toLowerCase();
    
    if (personaLower.includes('physicist') || personaLower.includes('einstein')) {
      queries.push(
        'quantum mechanics', 'relativity theory', 'particle physics', 'cosmology',
        'quantum field theory', 'string theory', 'dark matter', 'black holes',
        'quantum entanglement', 'wave-particle duality', 'uncertainty principle',
        'general relativity', 'special relativity', 'quantum gravity'
      );
    }
    
    if (personaLower.includes('civil rights') || personaLower.includes('king')) {
      queries.push(
        'civil rights movement', 'social justice', 'equality', 'activism',
        'nonviolent resistance', 'racial equality', 'voting rights', 'segregation',
        'civil disobedience', 'human rights', 'social change', 'community organizing'
      );
    }
    
    if (personaLower.includes('economist') || personaLower.includes('keynes')) {
      queries.push(
        'economic theory', 'macroeconomics', 'monetary policy', 'market analysis',
        'keynesian economics', 'fiscal policy', 'economic cycles', 'inflation',
        'unemployment', 'economic growth', 'market failures', 'government intervention'
      );
    }
  }

  // Add time-based queries to get different content
  const timeQueries = [
    'historical perspective', 'modern developments', 'future implications',
    'contemporary issues', 'emerging trends', 'classical approaches'
  ];
  queries.push(...timeQueries);

  // Add perspective-based queries
  const perspectiveQueries = [
    'criticisms and debates', 'alternative viewpoints', 'controversial aspects',
    'practical applications', 'theoretical foundations', 'empirical evidence'
  ];
  queries.push(...perspectiveQueries);

  // Remove duplicates and limit to reasonable number
  return [...new Set(queries)].slice(0, 25); // Increased from 15 to 25
}
