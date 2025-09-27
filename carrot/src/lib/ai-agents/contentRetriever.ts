import { FeedService, FeedItem } from './feedService';

export interface RetrievalRequest {
  query: string;
  sourceTypes: ('wikipedia' | 'arxiv' | 'news' | 'web')[];
  maxResults: number;
  agentIds: string[];
}

export interface RetrievedContent {
  title: string;
  url: string;
  content: string;
  sourceType: 'url';
  sourceAuthor?: string;
  sourceTitle: string;
  relevanceScore: number;
}

export class ContentRetriever {
  /**
   * Search Wikipedia for content
   */
  static async searchWikipedia(query: string, maxResults: number = 5): Promise<RetrievedContent[]> {
    try {
      // Use Wikipedia API to search for articles
      const searchResponse = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
      );
      
      if (!searchResponse.ok) {
        return [];
      }
      
      const data = await searchResponse.json();
      
      if (data.type === 'disambiguation') {
        // Handle disambiguation pages by getting the first few links
        return [{
          title: data.title,
          url: data.content_urls?.desktop?.page || '',
          content: data.extract || '',
          sourceType: 'url' as const,
          sourceTitle: data.title,
          relevanceScore: 0.9
        }];
      }
      
      return [{
        title: data.title,
        url: data.content_urls?.desktop?.page || '',
        content: data.extract || '',
        sourceType: 'url' as const,
        sourceTitle: data.title,
        relevanceScore: 0.9
      }];
    } catch (error) {
      console.error('Error searching Wikipedia:', error);
      return [];
    }
  }

  /**
   * Search arXiv for academic papers
   */
  static async searchArxiv(query: string, maxResults: number = 5): Promise<RetrievedContent[]> {
    try {
      // Use arXiv API to search for papers
      const searchResponse = await fetch(
        `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`
      );
      
      if (!searchResponse.ok) {
        return [];
      }
      
      const xmlText = await searchResponse.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      const entries = xmlDoc.getElementsByTagName('entry');
      const results: RetrievedContent[] = [];
      
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
          sourceType: 'url' as const,
          sourceAuthor: authors.join(', '),
          sourceTitle: title,
          relevanceScore: 0.8
        });
      }
      
      return results;
    } catch (error) {
      console.error('Error searching arXiv:', error);
      return [];
    }
  }

  /**
   * Search web content (simplified - would need a proper web search API)
   */
  static async searchWeb(query: string, maxResults: number = 5): Promise<RetrievedContent[]> {
    // This is a placeholder - in a real implementation, you'd use:
    // - Google Custom Search API
    // - Bing Search API
    // - DuckDuckGo API
    // - Or a web scraping service
    
    console.log(`Web search for "${query}" would return ${maxResults} results`);
    return [];
  }

  /**
   * Retrieve content from multiple sources
   */
  static async retrieveContent(request: RetrievalRequest): Promise<RetrievedContent[]> {
    const allResults: RetrievedContent[] = [];
    
    for (const sourceType of request.sourceTypes) {
      let results: RetrievedContent[] = [];
      
      switch (sourceType) {
        case 'wikipedia':
          results = await this.searchWikipedia(request.query, request.maxResults);
          break;
        case 'arxiv':
          results = await this.searchArxiv(request.query, request.maxResults);
          break;
        case 'web':
          results = await this.searchWeb(request.query, request.maxResults);
          break;
        case 'news':
          // Placeholder for news search
          console.log(`News search for "${request.query}" not implemented yet`);
          break;
      }
      
      allResults.push(...results);
    }
    
    // Sort by relevance score
    return allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Automatically feed retrieved content to agents
   */
  static async autoFeedAgents(request: RetrievalRequest): Promise<{ success: boolean; results: any[] }> {
    try {
      // Retrieve content
      const retrievedContent = await this.retrieveContent(request);
      
      if (retrievedContent.length === 0) {
        return { success: false, results: [] };
      }
      
      // Feed each piece of content to each agent
      const results = [];
      
      for (const content of retrievedContent) {
        for (const agentId of request.agentIds) {
          const feedItem: FeedItem = {
            content: content.content,
            sourceType: 'url',
            sourceUrl: content.url,
            sourceTitle: content.sourceTitle,
            sourceAuthor: content.sourceAuthor,
            tags: [request.query.toLowerCase()]
          };
          
          try {
            const result = await FeedService.feedAgent(agentId, feedItem, 'auto-retrieval');
            results.push({
              agentId,
              contentTitle: content.title,
              success: true,
              memoriesCreated: result.memoryIds.length
            });
          } catch (error) {
            results.push({
              agentId,
              contentTitle: content.title,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }
      
      return { success: true, results };
    } catch (error) {
      console.error('Error in auto-feed:', error);
      return { success: false, results: [] };
    }
  }
}
