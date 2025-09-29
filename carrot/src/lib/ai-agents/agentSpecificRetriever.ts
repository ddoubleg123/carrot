import { FeedService, FeedItem } from './feedService';
import { AgentRegistry } from './agentRegistry';
import { ContentQualityFilter, ContentMetadata } from './contentQualityFilter';

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
      sources: ['arxiv', 'wikipedia', 'news', 'pubmed', 'books'],
      keywords: ['quantum', 'relativity', 'particle', 'cosmology', 'thermodynamics'],
      searchTerms: ['physics research', 'scientific papers', 'theoretical physics']
    },
    'Civil Rights': {
      sources: ['wikipedia', 'news', 'academic', 'books'],
      keywords: ['civil rights', 'social justice', 'equality', 'discrimination', 'activism'],
      searchTerms: ['civil rights movement', 'social justice', 'equality studies']
    },
    'Economics': {
      sources: ['arxiv', 'wikipedia', 'news', 'academic', 'books'],
      keywords: ['economics', 'finance', 'market', 'investment', 'monetary policy'],
      searchTerms: ['economic theory', 'financial markets', 'economic policy']
    },
    'Computer Science': {
      sources: ['arxiv', 'github', 'wikipedia', 'news', 'books'],
      keywords: ['algorithm', 'programming', 'software', 'artificial intelligence', 'computing'],
      searchTerms: ['computer science research', 'software engineering', 'AI research']
    },
    'Biology': {
      sources: ['arxiv', 'wikipedia', 'news', 'pubmed', 'books'],
      keywords: ['biology', 'evolution', 'genetics', 'ecology', 'molecular biology'],
      searchTerms: ['biological research', 'evolutionary biology', 'genetics studies']
    },
    'Politics': {
      sources: ['wikipedia', 'news', 'academic', 'books'],
      keywords: ['politics', 'government', 'policy', 'democracy', 'governance'],
      searchTerms: ['political science', 'government policy', 'democratic theory']
    }
  } as const

  /**
   * Topic-specific retrieval with optional auto-feed.
   * Searches multiple sources for a given topic, applies quality filter, and (optionally) feeds results.
   */
  static async retrieveForTopic(params: {
    agentId: string;
    topic: string;
    maxResults?: number;
    autoFeed?: boolean;
    sourceTypes?: string[]; // subset of ['wikipedia','arxiv','news','github','pubmed','books']
  }): Promise<{ success: boolean; results: any[]; fedCount: number }>{
    const { agentId, topic } = params
    const maxResults = params.maxResults ?? 20
    const autoFeed = !!params.autoFeed
    const allowed = new Set((params.sourceTypes && params.sourceTypes.length ? params.sourceTypes : ['wikipedia','arxiv','news','github','pubmed','books']))
    try {
      const results: any[] = []
      // per-source query
      if (allowed.has('wikipedia')) results.push(...await this.searchWikipedia(topic, maxResults))
      if (allowed.has('arxiv')) results.push(...await this.searchArxiv(topic, maxResults))
      if (allowed.has('news')) results.push(...await this.searchNews(topic, maxResults))
      if (allowed.has('github')) results.push(...await this.searchGitHub(topic, maxResults))
      if (allowed.has('pubmed')) results.push(...await this.searchPubMed(topic, maxResults))
      if (allowed.has('books')) results.push(...await this.searchBooks(topic, maxResults))

      const filtered = await this.applyQualityFilter(results, [topic])
      // de-dupe by URL
      const unique = filtered.filter((r, i, self)=> i===self.findIndex(x=> x.url===r.url))

      let fedCount = 0
      if (autoFeed) {
        const existing = await FeedService.getRecentMemories(agentId, 200)
        const existingUrls = new Set(existing.map((m:any)=> m.sourceUrl).filter(Boolean))
        const existingTitles = new Set(existing.map((m:any)=> m.sourceTitle).filter(Boolean))
        for (const item of unique.slice(0, maxResults)) {
          if (existingUrls.has(item.url) || existingTitles.has(item.title)) continue
          const feedItem: FeedItem = {
            content: item.content,
            sourceType: item.sourceType || 'url',
            sourceUrl: item.url,
            sourceTitle: item.sourceTitle || item.title,
            sourceAuthor: item.sourceAuthor,
            tags: [topic]
          }
          try { await FeedService.feedAgent(agentId, feedItem, 'topic-trainer'); fedCount++ } catch {}
        }
      }

      return { success: true, results: unique.slice(0, maxResults), fedCount }
    } catch (e) {
      console.error('[AgentSpecificRetriever] retrieveForTopic error', e)
      return { success: false, results: [], fedCount: 0 }
    }
  }

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
      console.log(`[AgentSpecificRetriever] Starting retrieval for ${agent.name} with ${searchQueries.length} queries`);
      console.log(`[AgentSpecificRetriever] Search strategy sources: ${searchStrategy.sources.join(', ')}`);
      
      for (const query of searchQueries) {
        console.log(`[AgentSpecificRetriever] Processing query: "${query}"`);
        const results = await this.searchWithStrategy(query, searchStrategy, request.maxResults || 5);
        console.log(`[AgentSpecificRetriever] Query "${query}" returned ${results.length} results`);
        allResults.push(...results);
      }
      
      console.log(`[AgentSpecificRetriever] Total results before deduplication: ${allResults.length}`);

      // Remove duplicates and sort by relevance
      const uniqueResults = this.deduplicateAndRank(allResults, agent.domainExpertise);

      // Auto-feed if requested
      if (request.autoFeed) {
        // Get existing memories to avoid duplicates
        const existingMemories = await FeedService.getRecentMemories(request.agentId, 100);
        const existingUrls = new Set(existingMemories.map(m => m.sourceUrl).filter(Boolean));
        const existingTitles = new Set(existingMemories.map(m => m.sourceTitle).filter(Boolean));
        
        let fedCount = 0;
        for (const content of uniqueResults.slice(0, request.maxResults || 5)) {
          // Skip if we already have this content
          if (existingUrls.has(content.url) || existingTitles.has(content.title)) {
            console.log(`[AgentSpecificRetriever] Skipping duplicate content: ${content.title}`);
            continue;
          }
          
          const feedItem: FeedItem = {
            content: content.content,
            sourceType: 'url',
            sourceUrl: content.url,
            sourceTitle: content.sourceTitle,
            sourceAuthor: content.sourceAuthor,
            tags: [agent.name.toLowerCase(), ...agent.domainExpertise]
          };
          
          try {
            await FeedService.feedAgent(request.agentId, feedItem, 'agent-specific-retrieval');
            console.log(`[AgentSpecificRetriever] Fed NEW content to ${request.agentId}: ${content.title}`);
            fedCount++;
          } catch (error) {
            console.error(`[AgentSpecificRetriever] Error feeding content:`, error);
          }
        }
        
        console.log(`[AgentSpecificRetriever] Fed ${fedCount} new pieces of content to ${request.agentId}`);
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
    
    // Map strategy sources to our content retriever source types
    const sourceMapping: Record<string, string[]> = {
      'wikipedia': ['wikipedia'],
      'arxiv': ['arxiv'],
      'news': ['news'],
      'physics-news': ['news'],
      'economic-news': ['news'],
      'biology-news': ['news'],
      'tech-news': ['news'],
      'github': ['github'],
      'academic': ['pubmed', 'arxiv'],
      'books': ['books']
    };
    
    for (const source of strategy.sources) {
      try {
        const sourceTypes = sourceMapping[source] || ['wikipedia']; // Default to wikipedia if unknown
        
        for (const sourceType of sourceTypes) {
          console.log(`[AgentSpecificRetriever] Searching ${sourceType} for query: "${query}"`);
          
          let sourceResults = [];
          
          switch (sourceType) {
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
            case 'pubmed':
              sourceResults = await this.searchPubMed(query, maxResults);
              break;
            case 'books':
              sourceResults = await this.searchBooks(query, maxResults);
              break;
            default:
              console.log(`[AgentSpecificRetriever] Source ${sourceType} not implemented yet`);
          }
          
          console.log(`[AgentSpecificRetriever] Found ${sourceResults.length} results from ${sourceType}`);
          results.push(...sourceResults);
        }
      } catch (error) {
        console.error(`[AgentSpecificRetriever] Error searching ${source}:`, error);
      }
    }
    
    // Apply content quality filtering
    console.log(`[AgentSpecificRetriever] Applying quality filter to ${results.length} results`);
    const filteredResults = await this.applyQualityFilter(results, strategy.domainExpertise);
    console.log(`[AgentSpecificRetriever] Quality filter reduced results from ${results.length} to ${filteredResults.length}`);
    
    return filteredResults;
  }

  /**
   * Apply content quality filtering to search results
   */
  private static async applyQualityFilter(results: any[], domainExpertise: string[]): Promise<any[]> {
    const filteredResults = [];
    
    for (const result of results) {
      try {
        const contentMetadata: ContentMetadata = {
          title: result.title,
          content: result.content || result.summary || '',
          sourceUrl: result.sourceUrl || result.url,
          sourceType: result.sourceType || 'unknown',
          author: result.author,
          domain: result.domain,
          tags: result.tags || []
        };

        const qualityResult = await ContentQualityFilter.filterContent(contentMetadata, domainExpertise);
        
        if (qualityResult.isRelevant) {
          // Add quality metadata to the result
          result.qualityScore = qualityResult.qualityScore;
          result.qualityIssues = qualityResult.issues;
          result.qualityRecommendations = qualityResult.recommendations;
          filteredResults.push(result);
          
          console.log(`[AgentSpecificRetriever] Content passed quality filter: "${result.title}" (score: ${qualityResult.qualityScore.toFixed(2)})`);
        } else {
          console.log(`[AgentSpecificRetriever] Content filtered out: "${result.title}" - Issues: ${qualityResult.issues.join(', ')}`);
        }
      } catch (error) {
        console.error(`[AgentSpecificRetriever] Error applying quality filter:`, error);
        // If filtering fails, include the result to be safe
        filteredResults.push(result);
      }
    }
    
    return filteredResults;
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
      
      // Use regex parsing instead of DOMParser for server-side compatibility
      const entryMatches = xmlText.match(/<entry>[\s\S]*?<\/entry>/g) || [];
      const results = [];
      
      for (const entryXml of entryMatches) {
        // Extract title
        const titleMatch = entryXml.match(/<title[^>]*>([\s\S]*?)<\/title>/);
        const title = titleMatch ? titleMatch[1].trim() : '';
        
        // Extract summary
        const summaryMatch = entryXml.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
        const summary = summaryMatch ? summaryMatch[1].trim() : '';
        
        // Extract link
        const linkMatch = entryXml.match(/<link[^>]*href="([^"]*)"[^>]*>/);
        const link = linkMatch ? linkMatch[1] : '';
        
        // Extract authors
        const authorMatches = entryXml.match(/<author>[\s\S]*?<\/author>/g) || [];
        const authors = authorMatches.map(authorXml => {
          const nameMatch = authorXml.match(/<name[^>]*>([\s\S]*?)<\/name>/);
          return nameMatch ? nameMatch[1].trim() : '';
        }).filter(name => name);
        
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
   * Search news using News API
   */
  private static async searchNews(query: string, maxResults: number): Promise<any[]> {
    try {
      const { ContentRetriever } = await import('./contentRetriever');
      return await ContentRetriever.searchNews(query, maxResults);
    } catch (error) {
      console.error('Error searching news:', error);
      return [];
    }
  }

  /**
   * Search PubMed for biomedical research
   */
  private static async searchPubMed(query: string, maxResults: number): Promise<any[]> {
    try {
      const { ContentRetriever } = await import('./contentRetriever');
      return await ContentRetriever.searchAcademic(query, maxResults);
    } catch (error) {
      console.error('Error searching PubMed:', error);
      return [];
    }
  }

  /**
   * Search books using Project Gutenberg
   */
  private static async searchBooks(query: string, maxResults: number): Promise<any[]> {
    try {
      const { ContentRetriever } = await import('./contentRetriever');
      return await ContentRetriever.searchBooks(query, maxResults);
    } catch (error) {
      console.error('Error searching books:', error);
      return [];
    }
  }

  /**
   * Search GitHub repositories
   */
  private static async searchGitHub(query: string, maxResults: number): Promise<any[]> {
    try {
      const { ContentRetriever } = await import('./contentRetriever');
      return await ContentRetriever.searchGitHub(query, maxResults);
    } catch (error) {
      console.error('Error searching GitHub:', error);
      return [];
    }
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
      const dbAgents = await AgentRegistry.getAllAgents();
      const records: AgentTrainingRecord[] = [];
      const seen = new Set<string>();
      // DB agents first
      for (const agent of dbAgents) {
        const record = await this.getAgentTrainingRecord(agent.id);
        records.push(record);
        seen.add(agent.id);
      }

      // Include featured agents that are not in DB
      try {
        const { FEATURED_AGENTS } = await import('@/lib/agents');
        for (const f of FEATURED_AGENTS) {
          if (seen.has(f.id)) continue;
          const base = await this.getAgentTrainingRecord(f.id);
          // If DB not found, override with featured metadata
          const merged: AgentTrainingRecord = {
            ...base,
            agentId: f.id,
            agentName: f.name || base.agentName || 'Unknown',
            domainExpertise: Array.isArray(f.domains) ? f.domains : base.domainExpertise,
          };
          records.push(merged);
          seen.add(f.id);
        }
      } catch {}

      return records
        .sort((a, b) => b.totalMemories - a.totalMemories);
    } catch (error) {
      console.error('Error getting all training records:', error);
      return [];
    }
  }

  /**
   * Perform deep Wikipedia learning with references
   */
  static async performWikipediaDeepLearning(
    pageTitle: string,
    agentId: string,
    options: {
      includeReferences?: boolean;
      maxReferences?: number;
      minReliability?: 'high' | 'medium' | 'low';
    } = {}
  ): Promise<any> {
    try {
      const { WikipediaDeepLearning } = await import('./wikipediaDeepLearning');
      
      console.log(`[AgentSpecificRetriever] Starting Wikipedia deep learning for "${pageTitle}"`);
      
      const result = await WikipediaDeepLearning.learnFromWikipediaPage(
        pageTitle,
        agentId,
        {
          includeReferences: true,
          maxReferences: 15, // Limit to avoid overwhelming
          minReliability: 'medium',
          referenceTypes: ['academic', 'journal', 'news', 'book']
        }
      );
      
      console.log(`[AgentSpecificRetriever] Wikipedia deep learning complete for "${pageTitle}"`);
      console.log(`[AgentSpecificRetriever] Processed ${result.processedReferences} references`);
      
      return result;
    } catch (error) {
      console.error(`[AgentSpecificRetriever] Error in Wikipedia deep learning:`, error);
      throw error;
    }
  }
}
