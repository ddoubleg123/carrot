import AgentRegistry from './agentRegistry';
import EmbeddingService from './embeddingService';

export interface AgentMatch {
  agent: any;
  score: number;
  reasons: string[];
  expertise: string[];
}

export interface SelectionCriteria {
  query: string;
  maxAgents?: number;
  minScore?: number;
  requiredExpertise?: string[];
  excludeAgents?: string[];
  context?: string;
}

export class AgentSelector {
  /**
   * Select the best agents for a given query
   */
  static async selectAgents(criteria: SelectionCriteria): Promise<AgentMatch[]> {
    const {
      query,
      maxAgents = 3,
      minScore = 0.3,
      requiredExpertise = [],
      excludeAgents = [],
      context = ''
    } = criteria;

    // Get all active agents
    const allAgents = await AgentRegistry.getAllAgents();
    
    // Filter out excluded agents
    const availableAgents = allAgents.filter(agent => 
      !excludeAgents.includes(agent.id)
    );

    // Score each agent
    const agentMatches: AgentMatch[] = [];

    for (const agent of availableAgents) {
      const match = await this.scoreAgent(agent, query, context, requiredExpertise);
      
      if (match.score >= minScore) {
        agentMatches.push(match);
      }
    }

    // Sort by score (highest first)
    agentMatches.sort((a, b) => b.score - a.score);

    // Return top agents
    return agentMatches.slice(0, maxAgents);
  }

  /**
   * Score an agent based on query relevance
   */
  private static async scoreAgent(
    agent: any,
    query: string,
    context: string,
    requiredExpertise: string[]
  ): Promise<AgentMatch> {
    const reasons: string[] = [];
    let score = 0;

    // 1. Domain expertise matching (40% weight)
    const expertiseScore = this.calculateExpertiseScore(agent.domainExpertise, query, requiredExpertise);
    score += expertiseScore * 0.4;
    
    if (expertiseScore > 0.5) {
      reasons.push(`Strong expertise in ${agent.domainExpertise.join(', ')}`);
    }

    // 2. Name matching (20% weight)
    const nameScore = this.calculateNameScore(agent.name, query);
    score += nameScore * 0.2;
    
    if (nameScore > 0.5) {
      reasons.push(`Name matches query context`);
    }

    // 3. Persona relevance (20% weight)
    const personaScore = this.calculatePersonaScore(agent.persona, query);
    score += personaScore * 0.2;
    
    if (personaScore > 0.5) {
      reasons.push(`Persona aligns with query topic`);
    }

    // 4. Associated patches matching (10% weight)
    const patchScore = this.calculatePatchScore(agent.associatedPatches, query);
    score += patchScore * 0.1;
    
    if (patchScore > 0.5) {
      reasons.push(`Associated with relevant topics`);
    }

    // 5. Context relevance (10% weight)
    const contextScore = this.calculateContextScore(agent, context);
    score += contextScore * 0.1;
    
    if (contextScore > 0.5) {
      reasons.push(`Relevant to current context`);
    }

    // Bonus for required expertise
    if (requiredExpertise.length > 0) {
      const hasRequiredExpertise = requiredExpertise.some(req => 
        agent.domainExpertise.some((exp: string) => 
          exp.toLowerCase().includes(req.toLowerCase()) || 
          req.toLowerCase().includes(exp.toLowerCase())
        )
      );
      
      if (hasRequiredExpertise) {
        score += 0.2;
        reasons.push(`Has required expertise: ${requiredExpertise.join(', ')}`);
      }
    }

    // Ensure score is between 0 and 1
    score = Math.min(1, Math.max(0, score));

    return {
      agent,
      score,
      reasons,
      expertise: agent.domainExpertise,
    };
  }

  /**
   * Calculate expertise matching score
   */
  private static calculateExpertiseScore(
    agentExpertise: string[],
    query: string,
    requiredExpertise: string[]
  ): number {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);
    
    let score = 0;
    let matches = 0;

    // Check each agent expertise against query words
    for (const expertise of agentExpertise) {
      const expertiseLower = expertise.toLowerCase();
      
      // Direct match
      if (queryLower.includes(expertiseLower) || expertiseLower.includes(queryLower)) {
        score += 1;
        matches++;
        continue;
      }

      // Word-level matching
      for (const word of queryWords) {
        if (expertiseLower.includes(word) || word.includes(expertiseLower)) {
          score += 0.5;
          matches++;
        }
      }
    }

    // Check required expertise
    if (requiredExpertise.length > 0) {
      const hasRequired = requiredExpertise.some(req => 
        agentExpertise.some(exp => 
          exp.toLowerCase().includes(req.toLowerCase()) || 
          req.toLowerCase().includes(exp.toLowerCase())
        )
      );
      
      if (hasRequired) {
        score += 0.5;
      }
    }

    // Normalize score
    return Math.min(1, score / Math.max(agentExpertise.length, 1));
  }

  /**
   * Calculate name matching score
   */
  private static calculateNameScore(agentName: string, query: string): number {
    const nameLower = agentName.toLowerCase();
    const queryLower = query.toLowerCase();
    
    // Direct name mention
    if (queryLower.includes(nameLower)) {
      return 1;
    }

    // Partial name matching
    const nameWords = nameLower.split(/\s+/);
    const queryWords = queryLower.split(/\s+/);
    
    let matches = 0;
    for (const nameWord of nameWords) {
      for (const queryWord of queryWords) {
        if (nameWord.includes(queryWord) || queryWord.includes(nameWord)) {
          matches++;
        }
      }
    }

    return Math.min(1, matches / nameWords.length);
  }

  /**
   * Calculate persona relevance score
   */
  private static calculatePersonaScore(persona: string, query: string): number {
    const personaLower = persona.toLowerCase();
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);
    
    let score = 0;
    let matches = 0;

    for (const word of queryWords) {
      if (personaLower.includes(word)) {
        score += 0.3;
        matches++;
      }
    }

    return Math.min(1, score);
  }

  /**
   * Calculate associated patches score
   */
  private static calculatePatchScore(patches: string[], query: string): number {
    const queryLower = query.toLowerCase();
    
    let score = 0;
    for (const patch of patches) {
      if (queryLower.includes(patch.toLowerCase())) {
        score += 0.5;
      }
    }

    return Math.min(1, score);
  }

  /**
   * Calculate context relevance score
   */
  private static calculateContextScore(agent: any, context: string): number {
    if (!context) return 0;

    const contextLower = context.toLowerCase();
    
    // Check if context mentions agent's expertise
    let score = 0;
    for (const expertise of agent.domainExpertise) {
      if (contextLower.includes(expertise.toLowerCase())) {
        score += 0.3;
      }
    }

    return Math.min(1, score);
  }

  /**
   * Get agents for a specific query with semantic matching
   */
  static async getAgentsForQuery(query: string, limit: number = 5): Promise<AgentMatch[]> {
    return await this.selectAgents({
      query,
      maxAgents: limit,
      minScore: 0.2,
    });
  }

  /**
   * Get agents by expertise tags
   */
  static async getAgentsByExpertise(expertise: string[], limit: number = 5): Promise<AgentMatch[]> {
    const agents = await AgentRegistry.getAgentsByExpertise(expertise);
    
    return agents.slice(0, limit).map(agent => ({
      agent,
      score: 1.0,
      reasons: [`Direct expertise match: ${expertise.join(', ')}`],
      expertise: agent.domainExpertise,
    }));
  }

  /**
   * Get agents for a specific context (e.g., Carrot patch)
   */
  static async getAgentsForContext(
    context: string,
    query: string,
    limit: number = 3
  ): Promise<AgentMatch[]> {
    return await this.selectAgents({
      query,
      context,
      maxAgents: limit,
      minScore: 0.3,
    });
  }
}

export default AgentSelector;
