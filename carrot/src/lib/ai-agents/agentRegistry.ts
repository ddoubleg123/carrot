import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface AgentMetadata {
  councilMembership?: string[];
  userVisibility?: 'public' | 'private' | 'team';
  trainingEnabled?: boolean;
  avatar?: string;
  role?: string;
  expertise?: string[];
  [key: string]: any;
}

export interface CreateAgentData {
  name: string;
  persona: string;
  domainExpertise: string[];
  associatedPatches?: string[];
  vectorDbRef?: string;
  knowledgeProfile?: any;
  feedSubscriptions?: any;
  metadata?: AgentMetadata;
}

export interface UpdateAgentData {
  name?: string;
  persona?: string;
  domainExpertise?: string[];
  associatedPatches?: string[];
  vectorDbRef?: string;
  knowledgeProfile?: any;
  feedSubscriptions?: any;
  metadata?: AgentMetadata;
  isActive?: boolean;
}

export class AgentRegistry {
  /**
   * Create a new AI agent
   */
  static async createAgent(data: CreateAgentData) {
    return await prisma.agent.create({
      data: {
        name: data.name,
        persona: data.persona,
        domainExpertise: data.domainExpertise,
        associatedPatches: data.associatedPatches || [],
        vectorDbRef: data.vectorDbRef,
        knowledgeProfile: data.knowledgeProfile,
        feedSubscriptions: data.feedSubscriptions,
        metadata: data.metadata || {},
      },
    });
  }

  /**
   * Get all active agents
   */
  static async getAllAgents() {
    return await prisma.agent.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get agent by ID
   */
  static async getAgentById(id: string) {
    return await prisma.agent.findUnique({
      where: { id },
      include: {
        memories: {
          orderBy: { createdAt: 'desc' },
          take: 10, // Recent memories
        },
        feedEvents: {
          orderBy: { createdAt: 'desc' },
          take: 5, // Recent feed events
        },
      },
    });
  }

  /**
   * Get agents by domain expertise
   */
  static async getAgentsByExpertise(expertise: string[]) {
    return await prisma.agent.findMany({
      where: {
        isActive: true,
        domainExpertise: {
          hasSome: expertise,
        },
      },
    });
  }

  /**
   * Get agents associated with specific patches
   */
  static async getAgentsByPatches(patches: string[]) {
    return await prisma.agent.findMany({
      where: {
        isActive: true,
        associatedPatches: {
          hasSome: patches,
        },
      },
    });
  }

  /**
   * Update agent
   */
  static async updateAgent(id: string, data: UpdateAgentData) {
    return await prisma.agent.update({
      where: { id },
      data,
    });
  }

  /**
   * Deactivate agent (soft delete)
   */
  static async deactivateAgent(id: string) {
    return await prisma.agent.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Search agents by query (semantic search on name, persona, expertise)
   */
  static async searchAgents(query: string) {
    const agents = await prisma.agent.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { persona: { contains: query, mode: 'insensitive' } },
          { domainExpertise: { hasSome: [query] } },
        ],
      },
    });

    return agents;
  }

  /**
   * Get agent statistics
   */
  static async getAgentStats(agentId: string) {
    const [memoryCount, feedEventCount, conversationCount] = await Promise.all([
      prisma.agentMemory.count({ where: { agentId } }),
      prisma.agentFeedEvent.count({ where: { agentId } }),
      prisma.agentConversation.count({ where: { agentId } }),
    ]);

    return {
      memoryCount,
      feedEventCount,
      conversationCount,
    };
  }

  /**
   * Get agents for a specific query (semantic matching)
   */
  static async getAgentsForQuery(query: string, limit: number = 5) {
    // Simple keyword matching for now - can be enhanced with semantic search
    const keywords = query.toLowerCase().split(' ');
    
    const agents = await prisma.agent.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { persona: { contains: query, mode: 'insensitive' } },
          { domainExpertise: { hasSome: keywords } },
        ],
      },
      take: limit,
    });

    return agents;
  }
}

export default AgentRegistry;
