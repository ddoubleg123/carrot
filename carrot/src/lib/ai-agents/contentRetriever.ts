import { FeedService, FeedItem } from './feedService';
import { RealContentFetcher } from './realContentFetcher';
import { ContentSources } from './contentSources';

export interface RetrievalRequest {
  query: string;
  sourceTypes: ('wikipedia' | 'arxiv' | 'news' | 'web' | 'academic' | 'books' | 'papers' | 'stackoverflow' | 'github' | 'pubmed')[];
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
        case 'papers':
          results = await this.searchArxiv(request.query, request.maxResults);
          break;
        case 'web':
          results = await this.searchWeb(request.query, request.maxResults);
          break;
        case 'news':
          results = await this.searchNews(request.query, request.maxResults);
          break;
        case 'academic':
        case 'pubmed':
          results = await this.searchAcademic(request.query, request.maxResults);
          break;
        case 'books':
          results = await this.searchBooks(request.query, request.maxResults);
          break;
        case 'stackoverflow':
          results = await this.searchStackOverflow(request.query, request.maxResults);
          break;
        case 'github':
          results = await this.searchGitHub(request.query, request.maxResults);
          break;
        default:
          console.warn(`Unknown source type: ${sourceType}`);
          results = [];
      }
      
      allResults.push(...results);
    }
    
    // Sort by relevance score
    return allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Automatically feed retrieved content to agents with expertise-based filtering
   */
  static async autoFeedAgents(request: RetrievalRequest): Promise<{ success: boolean; results: any[] }> {
    try {
      // Retrieve content
      const retrievedContent = await this.retrieveContent(request);
      
      if (retrievedContent.length === 0) {
        return { success: false, results: [] };
      }
      
      // For single agent requests, filter content by expertise relevance
      if (request.agentIds.length === 1) {
        const agentId = request.agentIds[0];
        const filteredContent = await this.filterContentByExpertise(retrievedContent, agentId, request.query);
        
        const results = [];
        for (const content of filteredContent) {
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
              memoriesCreated: result.memoryIds.length,
              relevanceScore: content.relevanceScore
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
        
        return { success: true, results };
      }
      
      // For multiple agents, feed each piece of content to each agent
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

  /**
   * Filter content by agent's expertise relevance
   */
  static async filterContentByExpertise(
    content: RetrievedContent[], 
    agentId: string, 
    query: string
  ): Promise<RetrievedContent[]> {
    try {
      // Get agent details (this would need to be imported from AgentRegistry)
      // For now, we'll use a simple keyword matching approach
      const queryLower = query.toLowerCase();
      
      // Filter content based on relevance to the query and agent expertise
      const filteredContent = content.filter(item => {
        const titleLower = item.title.toLowerCase();
        const contentLower = item.content.toLowerCase();
        
        // Check if content is relevant to the query
        const isRelevantToQuery = titleLower.includes(queryLower) || contentLower.includes(queryLower);
        
        // Additional relevance scoring could be added here
        return isRelevantToQuery;
      });
      
      // Sort by relevance score and return top results
      return filteredContent
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, 5); // Limit to top 5 most relevant pieces
    } catch (error) {
      console.error('Error filtering content by expertise:', error);
      return content; // Return original content if filtering fails
    }
  }

  /**
   * Search news sources using News API
   */
  static async searchNews(query: string, maxResults: number = 5): Promise<RetrievedContent[]> {
    try {
      const apiKey = process.env.NEWS_API_KEY;
      if (!apiKey) {
        console.warn('News API key not configured, using mock data');
        return [{
          title: `Latest News: ${query}`,
          url: `https://news.example.com/search?q=${encodeURIComponent(query)}`,
          content: `Recent developments in ${query} have shown significant progress in the field.`,
          sourceType: 'url' as const,
          sourceTitle: 'News Article',
          sourceAuthor: 'News Source',
          relevanceScore: 0.7
        }];
      }

      return await RealContentFetcher.fetchContent({
        query,
        sourceName: 'newsapi',
        maxResults,
        config: { apiKey }
      });
    } catch (error) {
      console.error('Error searching news:', error);
      return [];
    }
  }

  /**
   * Search academic databases using PubMed
   */
  static async searchAcademic(query: string, maxResults: number = 5): Promise<RetrievedContent[]> {
    try {
      return await RealContentFetcher.fetchContent({
        query,
        sourceName: 'pubmed',
        maxResults
      });
    } catch (error) {
      console.error('Error searching academic:', error);
      return [];
    }
  }

  /**
   * Search books using Project Gutenberg
   */
  static async searchBooks(query: string, maxResults: number = 5): Promise<RetrievedContent[]> {
    try {
      return await RealContentFetcher.fetchContent({
        query,
        sourceName: 'project gutenberg',
        maxResults
      });
    } catch (error) {
      console.error('Error searching books:', error);
      return [];
    }
  }

  /**
   * Search Stack Overflow for technical content
   */
  static async searchStackOverflow(query: string, maxResults: number = 5): Promise<RetrievedContent[]> {
    try {
      return await RealContentFetcher.fetchContent({
        query,
        sourceName: 'stackoverflow',
        maxResults
      });
    } catch (error) {
      console.error('Error searching Stack Overflow:', error);
      return [];
    }
  }

  /**
   * Search GitHub repositories
   */
  static async searchGitHub(query: string, maxResults: number = 5): Promise<RetrievedContent[]> {
    try {
      const apiKey = process.env.GITHUB_API_KEY;
      if (!apiKey) {
        console.warn('GitHub API key not configured, using mock data');
        return [{
          title: `GitHub Repository: ${query}`,
          url: `https://github.com/search?q=${encodeURIComponent(query)}`,
          content: `GitHub repositories related to ${query} with code examples and documentation.`,
          sourceType: 'url' as const,
          sourceTitle: 'GitHub Repository',
          sourceAuthor: 'GitHub User',
          relevanceScore: 0.8
        }];
      }

      return await RealContentFetcher.fetchContent({
        query,
        sourceName: 'github',
        maxResults,
        config: { apiKey }
      });
    } catch (error) {
      console.error('Error searching GitHub:', error);
      return [];
    }
  }
}
