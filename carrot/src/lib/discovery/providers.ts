/**
 * Content Provider System
 * 
 * Optimized content fetching with:
 * - Caching with ETags
 * - Rate limiting
 * - Site filtering
 * - Domain diversity tracking
 */

import { DiscoveryRedis } from './redis';

export interface ContentProvider {
  name: string;
  type: 'rss' | 'api' | 'web' | 'youtube' | 'reddit';
  baseUrl: string;
  fetchContent: (cursor?: string) => Promise<ProviderResult>;
  rateLimit: number; // requests per minute
  priority: number; // 0-1
}

export interface ProviderResult {
  items: ContentItem[];
  nextCursor?: string;
  hasMore: boolean;
  etag?: string;
}

export interface ContentItem {
  url: string;
  title: string;
  content?: string;
  description?: string;
  publishedAt?: Date;
  domain: string;
  type: 'article' | 'video' | 'pdf' | 'image';
}

/**
 * Provider Manager with Caching and Rate Limiting
 */
export class ProviderManager {
  private providers: Map<string, ContentProvider> = new Map();
  private cache: Map<string, { data: ProviderResult; etag?: string; timestamp: number }> = new Map();
  private recentDomains: Set<string> = new Set();
  
  /**
   * Register a content provider
   */
  registerProvider(provider: ContentProvider): void {
    this.providers.set(provider.name, provider);
  }
  
  /**
   * Fetch content from provider with caching and rate limiting
   */
  async fetchFromProvider(
    providerName: string, 
    cursor?: string,
    options?: { skipCache?: boolean }
  ): Promise<ProviderResult> {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider not found: ${providerName}`);
    }
    
    // Check rate limit
    const isRateLimited = await DiscoveryRedis.isRateLimited(
      providerName,
      provider.rateLimit,
      60000 // 1 minute window
    );
    
    if (isRateLimited) {
      console.warn(`[Provider] Rate limited: ${providerName}`);
      return {
        items: [],
        hasMore: false
      };
    }
    
    // Check cache
    const cacheKey = `${providerName}:${cursor || 'default'}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && !options?.skipCache) {
      const age = Date.now() - cached.timestamp;
      if (age < 120000) { // 2 minutes
        console.log(`[Provider] Cache hit: ${providerName}`);
        return cached.data;
      }
    }
    
    try {
      // Fetch content
      const result = await provider.fetchContent(cursor);
      
      // Filter out recently seen domains
      const filteredItems = this.filterRecentDomains(result.items);
      
      // Update cache
      this.cache.set(cacheKey, {
        data: { ...result, items: filteredItems },
        etag: result.etag,
        timestamp: Date.now()
      });
      
      // Update recent domains
      filteredItems.forEach(item => this.recentDomains.add(item.domain));
      
      // Clean up old domains (keep last 100)
      if (this.recentDomains.size > 100) {
        const domainsArray = Array.from(this.recentDomains);
        this.recentDomains = new Set(domainsArray.slice(-100));
      }
      
      console.log(`[Provider] Fetched ${filteredItems.length} items from ${providerName}`);
      
      return { ...result, items: filteredItems };
      
    } catch (error) {
      console.error(`[Provider] Error fetching from ${providerName}:`, error);
      throw error;
    }
  }
  
  /**
   * Filter out items from recently seen domains
   */
  private filterRecentDomains(items: ContentItem[]): ContentItem[] {
    return items.filter(item => !this.recentDomains.has(item.domain));
  }
  
  /**
   * Get all registered providers
   */
  getProviders(): ContentProvider[] {
    return Array.from(this.providers.values());
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[Provider] Cache cleared');
  }
  
  /**
   * Get provider stats
   */
  getStats(): {
    totalProviders: number;
    cacheSize: number;
    recentDomains: number;
  } {
    return {
      totalProviders: this.providers.size,
      cacheSize: this.cache.size,
      recentDomains: this.recentDomains.size
    };
  }
}

/**
 * RSS Feed Provider
 */
export class RSSProvider implements ContentProvider {
  name: string;
  type: 'rss' = 'rss';
  baseUrl: string;
  rateLimit: number = 60;
  priority: number = 1.0;
  
  constructor(name: string, feedUrl: string, priority: number = 1.0) {
    this.name = name;
    this.baseUrl = feedUrl;
    this.priority = priority;
  }
  
  async fetchContent(cursor?: string): Promise<ProviderResult> {
    try {
      const response = await fetch(this.baseUrl, {
        headers: {
          'User-Agent': 'Carrot Discovery Bot/1.0',
          ...(cursor ? { 'If-None-Match': cursor } : {})
        }
      });
      
      if (response.status === 304) {
        // Not modified
        return { items: [], hasMore: false };
      }
      
      const etag = response.headers.get('etag') || undefined;
      const text = await response.text();
      
      // Parse RSS (simplified - you'd use a proper RSS parser)
      const items = this.parseRSS(text);
      
      return {
        items,
        hasMore: items.length > 0,
        etag,
        nextCursor: etag
      };
      
    } catch (error) {
      console.error(`[RSS] Error fetching ${this.name}:`, error);
      return { items: [], hasMore: false };
    }
  }
  
  private parseRSS(xml: string): ContentItem[] {
    // Simplified RSS parsing - implement proper XML parsing
    const items: ContentItem[] = [];
    
    // TODO: Implement actual RSS parsing with xml2js or similar
    // For now, return empty array
    
    return items;
  }
}

/**
 * Web Search Provider
 */
export class WebSearchProvider implements ContentProvider {
  name: string;
  type: 'web' = 'web';
  baseUrl: string;
  rateLimit: number = 30;
  priority: number = 0.5;
  private query: string;
  
  constructor(name: string, query: string, priority: number = 0.5) {
    this.name = name;
    this.query = query;
    this.baseUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
    this.priority = priority;
  }
  
  async fetchContent(cursor?: string): Promise<ProviderResult> {
    try {
      const page = cursor ? parseInt(cursor) : 0;
      const url = `${this.baseUrl}&first=${page * 10}`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const html = await response.text();
      
      // Parse search results (simplified)
      const items = this.parseSearchResults(html);
      
      return {
        items,
        hasMore: items.length > 0,
        nextCursor: (page + 1).toString()
      };
      
    } catch (error) {
      console.error(`[Web] Error searching ${this.query}:`, error);
      return { items: [], hasMore: false };
    }
  }
  
  private parseSearchResults(html: string): ContentItem[] {
    // Simplified search result parsing
    const items: ContentItem[] = [];
    
    // TODO: Implement actual HTML parsing with cheerio or similar
    // For now, return empty array
    
    return items;
  }
}

/**
 * Initialize default providers for a patch
 */
export function initializeProviders(patchHandle: string): ProviderManager {
  const manager = new ProviderManager();
  
  // Register RSS providers based on patch
  if (patchHandle.includes('bulls') || patchHandle.includes('basketball')) {
    manager.registerProvider(
      new RSSProvider(
        'rss:nba.com/bulls',
        'https://www.nba.com/bulls/rss.xml',
        1.0
      )
    );
    
    manager.registerProvider(
      new RSSProvider(
        'rss:espn.com/bulls',
        'https://www.espn.com/espn/rss/nba/news',
        0.9
      )
    );
    
    manager.registerProvider(
      new WebSearchProvider(
        'web:bing:chicago+bulls',
        'chicago bulls news',
        0.5
      )
    );
  }
  
  // Add more providers for other patch types
  
  return manager;
}
