import { FeedService, FeedItem } from './feedService';
import { AgentRegistry } from './agentRegistry';

export interface AgentSpecificRequest {
  agentId: string;
  maxResults?: number;
  autoFeed?: boolean;
  sourceTypes?: string[];
}

export interface AgentTrainingRecord {
  agentId: string;
  agentName: string;
  domainExpertise: string[];
  totalMemories: number;
  totalFeedEvents: number;
  lastTrainingDate: Date;
  trainingHistory: {
    date: Date;
    sourceType: string;
    sourceTitle: string;
    contentPreview: string;
    relevanceScore: number;
  }[];
  expertiseCoverage: {
    domain: string;
    coverage: number; // 0-100%
    lastUpdated: Date;
  }[];
}

export class AgentSpecificRetriever {
  // Domain-specific search strategies for different agent types
  private static readonly DOMAIN_STRATEGIES = {
    'Physics': {
      sources: ['arxiv', 'wikipedia', 'physics-news'],
      keywords: ['quantum', 'relativity', 'particle', 'cosmology', 'thermodynamics'],
      searchTerms: ['physics research', 'scientific papers', 'theoretical physics']
    },
    'Civil Rights': {
      sources: ['wikipedia', 'news', 'academic'],
      keywords: ['civil rights', 'social justice', 'equality', 'discrimination', 'activism'],
      searchTerms: ['civil rights movement', 'social justice', 'equality studies']
    },
    'Economics': {
      sources: ['arxiv', 'wikipedia', 'economic-news'],
      keywords: ['economics', 'finance', 'market', 'investment', 'monetary policy'],
      searchTerms: ['economic theory', 'financial markets', 'economic policy']
    },
    'Computer Science': {
      sources: ['arxiv', 'github', 'wikipedia', 'tech-news'],
      keywords: ['algorithm', 'programming', 'software', 'artificial intelligence', 'computing'],
      searchTerms: ['computer science research', 'software engineering', 'AI research']
    },
    'Biology': {
      sources: ['arxiv', 'wikipedia', 'biology-news'],
      keywords: ['biology', 'evolution', 'genetics', 'ecology', 'molecular biology'],
      searchTerms: ['biological research', 'evolutionary biology', 'genetics studies']
    },
    'Politics': {
      sources: ['wikipedia', 'news', 'academic'],
      keywords: ['politics', 'government', 'policy', 'democracy', 'governance'],
      searchTerms: ['political science', 'government policy', 'democratic theory']
    }
  };

  /**
   * Get agent-specific content based on their domain expertise
   */
  static async retrieveForAgent(request: AgentSpecificRequest): Promise<{
    success: boolean;
    results: any[];
    trainingRecord: AgentTrainingRecord;
  }> {
    try {
      // Get agent details
      const agent = await AgentRegistry.getAgentById(request.agentId);
      if (!agent) {
        throw new Error(`Agent ${request.agentId} not found`);
      }

      // Determine search strategy based on agent's domain expertise
      const searchStrategy = this.getSearchStrategy(agent.domainExpertise);
      
      // Generate agent-specific search queries
      const searchQueries = this.generateAgentQueries(agent, searchStrategy);
      
      // Retrieve content for each query
      const allResults = [];
      for (const query of searchQueries) {
        const results = await this.searchWithStrategy(query, searchStrategy, request.maxResults || 5);
        allResults.push(...results);
      }

      // Remove duplicates and sort by relevance
      const uniqueResults = this.deduplicateAndRank(allResults, agent.domainExpertise);

      // Auto-feed if requested
      if (request.autoFeed) {
        for (const content of uniqueResults.slice(0, request.maxResults || 5)) {
          const feedItem: FeedItem = {
            content: content.content,
            sourceType: 'url',
            sourceUrl: content.url,
            sourceTitle: content.sourceTitle,
            sourceAuthor: content.sourceAuthor,
            tags: [agent.name.toLowerCase(), ...agent.domainExpertise]
          };
          
          await FeedService.feedAgent(request.agentId, feedItem, 'agent-specific-retrieval');
        }
      }

      // Get training record
      const trainingRecord = await this.getAgentTrainingRecord(request.agentId);

      return {
        success: true,
        results: uniqueResults.slice(0, request.maxResults || 5),
        trainingRecord
      };
    } catch (error) {
      console.error('Error in agent-specific retrieval:', error);
      return {
        success: false,
        results: [],
        trainingRecord: await this.getAgentTrainingRecord(request.agentId)
      };
    }
  }

  /**
   * Get search strategy based on agent's domain expertise
   */
  private static getSearchStrategy(domainExpertise: string[]): any {
    // Find the best matching strategy
    for (const domain of domainExpertise) {
      if (this.DOMAIN_STRATEGIES[domain as keyof typeof this.DOMAIN_STRATEGIES]) {
        return this.DOMAIN_STRATEGIES[domain as keyof typeof this.DOMAIN_STRATEGIES];
      }
    }
    
    // Default strategy for unknown domains
    return {
      sources: ['wikipedia', 'news'],
      keywords: domainExpertise,
      searchTerms: domainExpertise.map(d => `${d} research`)
    };
  }

  /**
   * Generate agent-specific search queries
   */
  private static generateAgentQueries(agent: any, strategy: any): string[] {
    const queries = [];
    
    // Base queries from agent's expertise
    for (const domain of agent.domainExpertise) {
      queries.push(`${domain} research`);
      queries.push(`recent ${domain} developments`);
      queries.push(`${domain} theory`);
    }
    
    // Add strategy-specific queries
    for (const term of strategy.searchTerms) {
      queries.push(term);
    }
    
    // Add agent-specific queries based on their persona
    if (agent.persona) {
      const personaKeywords = this.extractKeywordsFromPersona(agent.persona);
      for (const keyword of personaKeywords) {
        queries.push(`${keyword} research`);
      }
    }
    
    return [...new Set(queries)]; // Remove duplicates
  }

  /**
   * Extract keywords from agent persona
   */
  private static extractKeywordsFromPersona(persona: string): string[] {
    // Simple keyword extraction - could be enhanced with NLP
    const keywords = [];
    const words = persona.toLowerCase().split(/\s+/);
    
    for (const word of words) {
      if (word.length > 4 && !this.isStopWord(word)) {
        keywords.push(word);
      }
    }
    
    return keywords.slice(0, 5); // Top 5 keywords
  }

  /**
   * Check if word is a stop word
   */
  private static isStopWord(word: string): boolean {
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'within', 'without', 'upon', 'across', 'behind', 'beyond', 'under', 'over', 'around', 'near', 'far', 'here', 'there', 'where', 'when', 'why', 'how', 'what', 'who', 'which', 'that', 'this', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours', 'theirs', 'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'yourselves', 'themselves', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall', 'a', 'an', 'some', 'any', 'all', 'both', 'each', 'every', 'either', 'neither', 'one', 'two', 'three', 'first', 'second', 'third', 'last', 'next', 'other', 'another', 'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'now', 'then', 'well', 'also', 'back', 'even', 'still', 'yet', 'again', 'once', 'more', 'most', 'much', 'many', 'few', 'little', 'less', 'least', 'more', 'most', 'much', 'many', 'few', 'little', 'less', 'least'];
    return stopWords.includes(word);
  }

  /**
   * Search using domain-specific strategy
   */
  private static async searchWithStrategy(query: string, strategy: any, maxResults: number): Promise<any[]> {
    const results = [];
    
    for (const source of strategy.sources) {
      try {
        let sourceResults = [];
        
        switch (source) {
          case 'wikipedia':
            sourceResults = await this.searchWikipedia(query, maxResults);
            break;
          case 'arxiv':
            sourceResults = await this.searchArxiv(query, maxResults);
            break;
          case 'news':
            sourceResults = await this.searchNews(query, maxResults);
            break;
          case 'github':
            sourceResults = await this.searchGitHub(query, maxResults);
            break;
          default:
            console.log(`Source ${source} not implemented yet`);
        }
        
        results.push(...sourceResults);
      } catch (error) {
        console.error(`Error searching ${source}:`, error);
      }
    }
    
    return results;
  }

  /**
   * Search Wikipedia with enhanced relevance scoring
   */
  private static async searchWikipedia(query: string, maxResults: number): Promise<any[]> {
    try {
      const response = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
      );
      
      if (!response.ok) {
        return [];
      }
      
      const data = await response.json();
      
      return [{
        title: data.title,
        url: data.content_urls?.desktop?.page || '',
        content: data.extract || '',
        sourceType: 'wikipedia',
        sourceTitle: data.title,
        sourceAuthor: 'Wikipedia',
        relevanceScore: 0.9,
        domain: this.detectDomain(data.extract || '')
      }];
    } catch (error) {
      console.error('Error searching Wikipedia:', error);
      return [];
    }
  }

  /**
   * Search arXiv with domain filtering
   */
  private static async searchArxiv(query: string, maxResults: number): Promise<any[]> {
    try {
      const response = await fetch(
        `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`
      );
      
      if (!response.ok) {
        return [];
      }
      
      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      const entries = xmlDoc.getElementsByTagName('entry');
      const results = [];
      
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const title = entry.getElementsByTagName('title')[0]?.textContent || '';
        const summary = entry.getElementsByTagName('summary')[0]?.textContent || '';
        const link = entry.getElementsByTagName('link')[0]?.getAttribute('href') || '';
        const authors = Array.from(entry.getElementsByTagName('author')).map(
          author => author.getElementsByTagName('name')[0]?.textContent || ''
        );
        
        results.push({
          title,
          url: link,
          content: summary,
          sourceType: 'arxiv',
          sourceTitle: title,
          sourceAuthor: authors.join(', '),
          relevanceScore: 0.8,
          domain: this.detectDomain(summary)
        });
      }
      
      return results;
    } catch (error) {
      console.error('Error searching arXiv:', error);
      return [];
    }
  }

  /**
   * Search news (placeholder - would integrate with news API)
   */
  private static async searchNews(query: string, maxResults: number): Promise<any[]> {
    // Placeholder for news search
    console.log(`News search for "${query}" would return ${maxResults} results`);
    return [];
  }

  /**
   * Search GitHub (placeholder - would integrate with GitHub API)
   */
  private static async searchGitHub(query: string, maxResults: number): Promise<any[]> {
    // Placeholder for GitHub search
    console.log(`GitHub search for "${query}" would return ${maxResults} results`);
    return [];
  }

  /**
   * Detect domain from content
   */
  private static detectDomain(content: string): string {
    const contentLower = content.toLowerCase();
    
    if (contentLower.includes('physics') || contentLower.includes('quantum') || contentLower.includes('relativity')) {
      return 'Physics';
    }
    if (contentLower.includes('civil rights') || contentLower.includes('equality') || contentLower.includes('justice')) {
      return 'Civil Rights';
    }
    if (contentLower.includes('economics') || contentLower.includes('finance') || contentLower.includes('market')) {
      return 'Economics';
    }
    if (contentLower.includes('computer') || contentLower.includes('algorithm') || contentLower.includes('programming')) {
      return 'Computer Science';
    }
    if (contentLower.includes('biology') || contentLower.includes('evolution') || contentLower.includes('genetics')) {
      return 'Biology';
    }
    if (contentLower.includes('politics') || contentLower.includes('government') || contentLower.includes('policy')) {
      return 'Politics';
    }
    
    return 'General';
  }

  /**
   * Remove duplicates and rank by relevance to agent expertise
   */
  private static deduplicateAndRank(results: any[], agentExpertise: string[]): any[] {
    // Remove duplicates by URL
    const uniqueResults = results.filter((result, index, self) => 
      index === self.findIndex(r => r.url === result.url)
    );
    
    // Rank by relevance to agent expertise
    return uniqueResults.sort((a, b) => {
      const aRelevance = this.calculateRelevance(a, agentExpertise);
      const bRelevance = this.calculateRelevance(b, agentExpertise);
      return bRelevance - aRelevance;
    });
  }

  /**
   * Calculate relevance score based on agent expertise
   */
  private static calculateRelevance(content: any, agentExpertise: string[]): number {
    let score = content.relevanceScore || 0.5;
    
    // Boost score if content domain matches agent expertise
    if (agentExpertise.includes(content.domain)) {
      score += 0.3;
    }
    
    // Boost score if content contains expertise keywords
    const contentLower = content.content.toLowerCase();
    for (const expertise of agentExpertise) {
      if (contentLower.includes(expertise.toLowerCase())) {
        score += 0.1;
      }
    }
    
    return Math.min(score, 1.0); // Cap at 1.0
  }

  /**
   * Get comprehensive training record for an agent
   */
  static async getAgentTrainingRecord(agentId: string): Promise<AgentTrainingRecord> {
    try {
      const agent = await AgentRegistry.getAgentById(agentId);
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }

      // Get feed history and memories (mock for now - would integrate with actual data)
      const feedHistory = await FeedService.getFeedHistory(agentId, 50);
      const memories = await FeedService.getRecentMemories(agentId, 50);
      
      // Calculate expertise coverage
      const expertiseCoverage = agent.domainExpertise.map((domain: string) => ({
        domain,
        coverage: Math.min(100, (memories.length * 10)), // Mock calculation
        lastUpdated: new Date()
      }));

      // Build training history
      const trainingHistory = feedHistory.map(feed => ({
        date: new Date((feed as any).createdAt),
        sourceType: (feed as any).sourceType,
        sourceTitle: (feed as any).sourceTitle || 'Unknown',
        contentPreview: (feed as any).content?.substring(0, 100) + '...' || '',
        relevanceScore: 0.8 // Mock score
      }));

      return {
        agentId,
        agentName: agent.name,
        domainExpertise: agent.domainExpertise,
        totalMemories: memories.length,
        totalFeedEvents: feedHistory.length,
        lastTrainingDate: trainingHistory.length > 0 ? trainingHistory[0].date : new Date(),
        trainingHistory: trainingHistory.slice(0, 20), // Last 20 training events
        expertiseCoverage
      };
    } catch (error) {
      console.error('Error getting training record:', error);
      return {
        agentId,
        agentName: 'Unknown',
        domainExpertise: [],
        totalMemories: 0,
        totalFeedEvents: 0,
        lastTrainingDate: new Date(),
        trainingHistory: [],
        expertiseCoverage: []
      };
    }
  }

  /**
   * Get training records for all agents
   */
  static async getAllTrainingRecords(): Promise<AgentTrainingRecord[]> {
    try {
      const agents = await AgentRegistry.getAllAgents();
      const records = [];
      
      for (const agent of agents) {
        const record = await this.getAgentTrainingRecord(agent.id);
        records.push(record);
      }
      
      return records.sort((a, b) => b.totalMemories - a.totalMemories);
    } catch (error) {
      console.error('Error getting all training records:', error);
      return [];
    }
  }
}
