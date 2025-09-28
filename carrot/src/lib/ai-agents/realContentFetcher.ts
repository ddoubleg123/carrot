import { RetrievedContent } from './contentRetriever';
import { ContentSources, SourceConfig } from './contentSources';

export interface FetchRequest {
  query: string;
  sourceName: string;
  maxResults: number;
  config?: SourceConfig;
}

export class RealContentFetcher {
  private static readonly CACHE = new Map<string, RetrievedContent[]>();
  private static readonly RATE_LIMITS = new Map<string, number>();

  /**
   * Fetch content from PubMed (biomedical research)
   */
  static async fetchFromPubMed(request: FetchRequest): Promise<RetrievedContent[]> {
    try {
      const { query, maxResults = 10 } = request;
      
      // Search for articles
      const searchUrl = `${ContentSources.PUBMED.baseUrl}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json`;
      const searchResponse = await fetch(searchUrl);
      
      if (!searchResponse.ok) {
        throw new Error(`PubMed search failed: ${searchResponse.status}`);
      }
      
      const searchData = await searchResponse.json();
      const pmids = searchData.esearchresult?.idlist || [];
      
      if (pmids.length === 0) {
        return [];
      }
      
      // Get article details
      const detailUrl = `${ContentSources.PUBMED.baseUrl}/efetch.fcgi?db=pubmed&id=${pmids.join(',')}&retmode=xml`;
      const detailResponse = await fetch(detailUrl);
      
      if (!detailResponse.ok) {
        throw new Error(`PubMed detail fetch failed: ${detailResponse.status}`);
      }
      
      const xmlText = await detailResponse.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      const articles = xmlDoc.getElementsByTagName('PubmedArticle');
      const results: RetrievedContent[] = [];
      
      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        const title = article.getElementsByTagName('ArticleTitle')[0]?.textContent || '';
        const abstract = article.getElementsByTagName('AbstractText')[0]?.textContent || '';
        const authors = Array.from(article.getElementsByTagName('Author')).map(
          author => {
            const lastName = author.getElementsByTagName('LastName')[0]?.textContent || '';
            const firstName = author.getElementsByTagName('ForeName')[0]?.textContent || '';
            return `${firstName} ${lastName}`.trim();
          }
        );
        
        if (title && abstract) {
          results.push({
            title,
            url: `https://pubmed.ncbi.nlm.nih.gov/${pmids[i]}/`,
            content: abstract,
            sourceType: 'url',
            sourceTitle: title,
            sourceAuthor: authors.join(', '),
            relevanceScore: 0.9
          });
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error fetching from PubMed:', error);
      return [];
    }
  }

  /**
   * Fetch content from Stack Overflow
   */
  static async fetchFromStackOverflow(request: FetchRequest): Promise<RetrievedContent[]> {
    try {
      const { query, maxResults = 10 } = request;
      
      const url = `${ContentSources.STACKOVERFLOW.baseUrl}/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(query)}&site=stackoverflow&pagesize=${maxResults}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Stack Overflow API failed: ${response.status}`);
      }
      
      const data = await response.json();
      const items = data.items || [];
      
      return items.map((item: any) => ({
        title: item.title,
        url: item.link,
        content: item.body || '',
        sourceType: 'url' as const,
        sourceTitle: item.title,
        sourceAuthor: item.owner?.display_name || 'Stack Overflow User',
        relevanceScore: 0.8
      }));
    } catch (error) {
      console.error('Error fetching from Stack Overflow:', error);
      return [];
    }
  }

  /**
   * Fetch content from GitHub repositories
   */
  static async fetchFromGitHub(request: FetchRequest): Promise<RetrievedContent[]> {
    try {
      const { query, maxResults = 10, config } = request;
      
      if (!config?.apiKey) {
        console.warn('GitHub API key not provided');
        return [];
      }
      
      const url = `${ContentSources.GITHUB.baseUrl}/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=${maxResults}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `token ${config.apiKey}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`GitHub API failed: ${response.status}`);
      }
      
      const data = await response.json();
      const repos = data.items || [];
      
      return repos.map((repo: any) => ({
        title: repo.name,
        url: repo.html_url,
        content: repo.description || '',
        sourceType: 'url' as const,
        sourceTitle: repo.full_name,
        sourceAuthor: repo.owner?.login || 'GitHub User',
        relevanceScore: 0.7
      }));
    } catch (error) {
      console.error('Error fetching from GitHub:', error);
      return [];
    }
  }

  /**
   * Fetch content from News API
   */
  static async fetchFromNewsAPI(request: FetchRequest): Promise<RetrievedContent[]> {
    try {
      const { query, maxResults = 10, config } = request;
      
      if (!config?.apiKey) {
        console.warn('News API key not provided');
        return [];
      }
      
      const url = `${ContentSources.NEWSAPI.baseUrl}/everything?q=${encodeURIComponent(query)}&pageSize=${maxResults}&sortBy=relevancy&apiKey=${config.apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`News API failed: ${response.status}`);
      }
      
      const data = await response.json();
      const articles = data.articles || [];
      
      return articles.map((article: any) => ({
        title: article.title,
        url: article.url,
        content: article.description || article.content || '',
        sourceType: 'url' as const,
        sourceTitle: article.title,
        sourceAuthor: article.author || article.source?.name || 'News Source',
        relevanceScore: 0.6
      }));
    } catch (error) {
      console.error('Error fetching from News API:', error);
      return [];
    }
  }

  /**
   * Fetch content from Project Gutenberg
   */
  static async fetchFromProjectGutenberg(request: FetchRequest): Promise<RetrievedContent[]> {
    try {
      const { query, maxResults = 10 } = request;
      
      // Project Gutenberg doesn't have a direct API, so we'll use their catalog
      const url = `https://www.gutenberg.org/ebooks/search/?query=${encodeURIComponent(query)}&submit_search=Go%21`;
      
      // This is a simplified implementation - in production, you'd need to scrape the HTML
      // or use a Gutenberg API wrapper
      return [{
        title: `Project Gutenberg: ${query}`,
        url: url,
        content: `Classic literature and books related to ${query} from Project Gutenberg's collection.`,
        sourceType: 'url' as const,
        sourceTitle: `Gutenberg: ${query}`,
        sourceAuthor: 'Project Gutenberg',
        relevanceScore: 0.8
      }];
    } catch (error) {
      console.error('Error fetching from Project Gutenberg:', error);
      return [];
    }
  }

  /**
   * Fetch content from RSS feeds
   */
  static async fetchFromRSS(feedUrl: string, maxResults: number = 10): Promise<RetrievedContent[]> {
    try {
      const response = await fetch(feedUrl);
      if (!response.ok) {
        throw new Error(`RSS fetch failed: ${response.status}`);
      }
      
      const xmlText = await response.text();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
      
      const items = xmlDoc.getElementsByTagName('item');
      const results: RetrievedContent[] = [];
      
      for (let i = 0; i < Math.min(items.length, maxResults); i++) {
        const item = items[i];
        const title = item.getElementsByTagName('title')[0]?.textContent || '';
        const description = item.getElementsByTagName('description')[0]?.textContent || '';
        const link = item.getElementsByTagName('link')[0]?.textContent || '';
        
        if (title && description) {
          results.push({
            title,
            url: link,
            content: description,
            sourceType: 'url' as const,
            sourceTitle: title,
            sourceAuthor: 'RSS Feed',
            relevanceScore: 0.7
          });
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error fetching from RSS:', error);
      return [];
    }
  }

  /**
   * Main fetch method that routes to appropriate source
   */
  static async fetchContent(request: FetchRequest): Promise<RetrievedContent[]> {
    const { sourceName } = request;
    
    // Check rate limiting
    if (this.isRateLimited(sourceName)) {
      console.warn(`Rate limited for ${sourceName}, skipping`);
      return [];
    }
    
    // Check cache first
    const cacheKey = `${sourceName}:${request.query}:${request.maxResults}`;
    if (this.CACHE.has(cacheKey)) {
      return this.CACHE.get(cacheKey)!;
    }
    
    let results: RetrievedContent[] = [];
    
    try {
      switch (sourceName.toLowerCase()) {
        case 'pubmed':
          results = await this.fetchFromPubMed(request);
          break;
        case 'stackoverflow':
          results = await this.fetchFromStackOverflow(request);
          break;
        case 'github':
          results = await this.fetchFromGitHub(request);
          break;
        case 'newsapi':
          results = await this.fetchFromNewsAPI(request);
          break;
        case 'project gutenberg':
          results = await this.fetchFromProjectGutenberg(request);
          break;
        default:
          console.warn(`Unknown source: ${sourceName}`);
          return [];
      }
      
      // Cache results
      this.CACHE.set(cacheKey, results);
      
      // Update rate limit
      this.updateRateLimit(sourceName);
      
      return results;
    } catch (error) {
      console.error(`Error fetching from ${sourceName}:`, error);
      return [];
    }
  }

  /**
   * Check if source is rate limited
   */
  private static isRateLimited(sourceName: string): boolean {
    const lastRequest = this.RATE_LIMITS.get(sourceName);
    if (!lastRequest) return false;
    
    const rateLimit = ContentSources.getRateLimit(sourceName);
    const timeSinceLastRequest = Date.now() - lastRequest;
    const minInterval = (60 * 1000) / rateLimit; // Convert to milliseconds
    
    return timeSinceLastRequest < minInterval;
  }

  /**
   * Update rate limit tracking
   */
  private static updateRateLimit(sourceName: string): void {
    this.RATE_LIMITS.set(sourceName, Date.now());
  }

  /**
   * Clear cache
   */
  static clearCache(): void {
    this.CACHE.clear();
  }
}
