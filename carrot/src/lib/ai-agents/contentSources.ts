import { RetrievedContent } from './contentRetriever';

export interface ContentSource {
  name: string;
  type: 'api' | 'rss' | 'scraper' | 'dataset';
  baseUrl: string;
  requiresAuth: boolean;
  rateLimit: number; // requests per minute
  maxResults: number;
}

export interface SourceConfig {
  apiKey?: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export class ContentSources {
  // Real API sources
  static readonly WIKIPEDIA: ContentSource = {
    name: 'Wikipedia',
    type: 'api',
    baseUrl: 'https://en.wikipedia.org/api/rest_v1',
    requiresAuth: false,
    rateLimit: 60,
    maxResults: 50
  };

  static readonly ARXIV: ContentSource = {
    name: 'arXiv',
    type: 'api',
    baseUrl: 'http://export.arxiv.org/api/query',
    requiresAuth: false,
    rateLimit: 30,
    maxResults: 100
  };

  static readonly PUBMED: ContentSource = {
    name: 'PubMed',
    type: 'api',
    baseUrl: 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils',
    requiresAuth: false,
    rateLimit: 10,
    maxResults: 50
  };

  static readonly STACKOVERFLOW: ContentSource = {
    name: 'Stack Overflow',
    type: 'api',
    baseUrl: 'https://api.stackexchange.com/2.3',
    requiresAuth: false,
    rateLimit: 30,
    maxResults: 100
  };

  static readonly GITHUB: ContentSource = {
    name: 'GitHub',
    type: 'api',
    baseUrl: 'https://api.github.com',
    requiresAuth: true,
    rateLimit: 60,
    maxResults: 100
  };

  static readonly NEWSAPI: ContentSource = {
    name: 'News API',
    type: 'api',
    baseUrl: 'https://newsapi.org/v2',
    requiresAuth: true,
    rateLimit: 1000,
    maxResults: 100
  };

  static readonly GOOGLE_SCHOLAR: ContentSource = {
    name: 'Google Scholar',
    type: 'scraper',
    baseUrl: 'https://scholar.google.com',
    requiresAuth: false,
    rateLimit: 10,
    maxResults: 20
  };

  static readonly PROJECT_GUTENBERG: ContentSource = {
    name: 'Project Gutenberg',
    type: 'api',
    baseUrl: 'https://www.gutenberg.org',
    requiresAuth: false,
    rateLimit: 30,
    maxResults: 50
  };

  static readonly INTERNET_ARCHIVE: ContentSource = {
    name: 'Internet Archive',
    type: 'api',
    baseUrl: 'https://archive.org',
    requiresAuth: false,
    rateLimit: 20,
    maxResults: 30
  };

  static readonly KAGGLE: ContentSource = {
    name: 'Kaggle',
    type: 'api',
    baseUrl: 'https://www.kaggle.com/api/v1',
    requiresAuth: true,
    rateLimit: 20,
    maxResults: 50
  };

  // RSS Sources
  static readonly RSS_SOURCES = {
    'nature-news': 'https://www.nature.com/news.rss',
    'science-news': 'https://www.science.org/news.rss',
    'mit-news': 'https://news.mit.edu/rss/topic/artificial-intelligence2',
    'hacker-news': 'https://hnrss.org/frontpage',
    'arxiv-cs': 'http://export.arxiv.org/rss/cs',
    'arxiv-physics': 'http://export.arxiv.org/rss/physics',
    'stackoverflow': 'https://stackoverflow.com/feeds/tag/artificial-intelligence'
  };

  // Domain-specific sources
  static readonly DOMAIN_SOURCES: Record<string, (ContentSource | string)[]> = {
    'physics': [this.ARXIV, this.WIKIPEDIA, this.RSS_SOURCES['arxiv-physics']],
    'computer-science': [this.STACKOVERFLOW, this.GITHUB, this.RSS_SOURCES['arxiv-cs']],
    'biology': [this.PUBMED, this.WIKIPEDIA, this.RSS_SOURCES['nature-news']],
    'philosophy': [this.WIKIPEDIA, this.PROJECT_GUTENBERG],
    'economics': [this.WIKIPEDIA, this.RSS_SOURCES['nature-news']],
    'politics': [this.WIKIPEDIA, this.RSS_SOURCES['nature-news']],
    'news': [this.NEWSAPI, this.RSS_SOURCES['nature-news']]
  };

  /**
   * Get sources for a specific domain
   */
  static getSourcesForDomain(domain: string): ContentSource[] {
    const sources = this.DOMAIN_SOURCES[domain.toLowerCase()];
    if (!sources) {
      return [this.WIKIPEDIA];
    }
    
    // Filter out string entries (RSS URLs) and return only ContentSource objects
    return sources.filter((source): source is ContentSource => 
      typeof source === 'object' && 'name' in source
    );
  }

  /**
   * Get all available sources
   */
  static getAllSources(): ContentSource[] {
    return [
      this.WIKIPEDIA,
      this.ARXIV,
      this.PUBMED,
      this.STACKOVERFLOW,
      this.GITHUB,
      this.NEWSAPI,
      this.GOOGLE_SCHOLAR,
      this.PROJECT_GUTENBERG,
      this.INTERNET_ARCHIVE,
      this.KAGGLE
    ];
  }

  /**
   * Check if source requires authentication
   */
  static requiresAuth(sourceName: string): boolean {
    const source = this.getAllSources().find(s => s.name === sourceName);
    return source?.requiresAuth || false;
  }

  /**
   * Get rate limit for source
   */
  static getRateLimit(sourceName: string): number {
    const source = this.getAllSources().find(s => s.name === sourceName);
    return source?.rateLimit || 30;
  }
}
