import { NextRequest, NextResponse } from 'next/server';
import { AgentSpecificRetriever } from '@/lib/ai-agents/agentSpecificRetriever';
import { AgentRegistry } from '@/lib/ai-agents/agentRegistry';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/agents/[id]/wikipedia-deep-learning - Perform deep Wikipedia learning with references
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const { 
      pageTitle,
      includeReferences = true,
      maxReferences = 15,
      minReliability = 'medium'
    } = body;

    if (!pageTitle) {
      return NextResponse.json(
        { error: 'pageTitle is required' },
        { status: 400 }
      );
    }

    // Verify agent exists
    const agent = await AgentRegistry.getAgentById(id);
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    console.log(`[Wikipedia Deep Learning API] Starting deep learning for ${agent.name} from "${pageTitle}"`);

    // Perform deep Wikipedia learning
    const result = await AgentSpecificRetriever.performWikipediaDeepLearning(
      pageTitle,
      id,
      {
        includeReferences,
        maxReferences,
        minReliability
      }
    );

    // Get updated training record
    const trainingRecord = await AgentSpecificRetriever.getAgentTrainingRecord(id);

    return NextResponse.json({
      success: true,
      agentId: id,
      agentName: agent.name,
      pageTitle,
      result,
      trainingRecord,
      message: `Deep Wikipedia learning complete! Processed ${result.processedReferences} references for ${agent.name}`
    });

  } catch (error) {
    console.error('Error in Wikipedia deep learning:', error);
    return NextResponse.json(
      { error: 'Failed to perform Wikipedia deep learning' },
      { status: 500 }
    );
  }
}

// GET /api/agents/[id]/wikipedia-deep-learning - Get Wikipedia learning suggestions for agent
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    
    // Verify agent exists
    const agent = await AgentRegistry.getAgentById(id);
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    // Generate Wikipedia page suggestions based on agent expertise
    const suggestions = generateWikipediaSuggestions(agent);

    return NextResponse.json({
      success: true,
      agentId: id,
      agentName: agent.name,
      suggestions
    });

  } catch (error) {
    console.error('Error getting Wikipedia suggestions:', error);
    return NextResponse.json(
      { error: 'Failed to get Wikipedia suggestions' },
      { status: 500 }
    );
  }
}

// Generate Wikipedia page suggestions based on agent expertise
function generateWikipediaSuggestions(agent: any): string[] {
  const suggestions: string[] = [];
  
  // Add suggestions based on domain expertise
  for (const domain of agent.domainExpertise) {
    switch (domain.toLowerCase()) {
      case 'physics':
        suggestions.push(
          'Quantum mechanics',
          'Theory of relativity',
          'Particle physics',
          'Thermodynamics',
          'Electromagnetism',
          'Nuclear physics',
          'Astrophysics',
          'Quantum field theory'
        );
        break;
        
      case 'economics':
        suggestions.push(
          'Economics',
          'Macroeconomics',
          'Microeconomics',
          'Keynesian economics',
          'Monetary policy',
          'Fiscal policy',
          'Market economy',
          'Economic growth'
        );
        break;
        
      case 'computer science':
        suggestions.push(
          'Computer science',
          'Artificial intelligence',
          'Machine learning',
          'Algorithm',
          'Programming language',
          'Software engineering',
          'Data structure',
          'Computer programming'
        );
        break;
        
      case 'biology':
        suggestions.push(
          'Biology',
          'Evolution',
          'Genetics',
          'Molecular biology',
          'Cell biology',
          'Ecology',
          'Biochemistry',
          'Neuroscience'
        );
        break;
        
      case 'civil rights':
        suggestions.push(
          'Civil rights movement',
          'Martin Luther King Jr.',
          'Social justice',
          'Equality',
          'Discrimination',
          'Human rights',
          'Activism',
          'Nonviolence'
        );
        break;
        
      case 'politics':
        suggestions.push(
          'Politics',
          'Democracy',
          'Government',
          'Political science',
          'Public policy',
          'Political philosophy',
          'Constitution',
          'Political system'
        );
        break;
    }
  }
  
  // Remove duplicates and limit to 10 suggestions
  return [...new Set(suggestions)].slice(0, 10);
}
