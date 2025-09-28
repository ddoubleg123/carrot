import { RetrievedContent } from './contentRetriever';

export interface WikipediaReference {
  id: string;
  url: string;
  title: string;
  type: 'journal' | 'book' | 'news' | 'website' | 'academic' | 'other';
  domain: string;
  reliability: 'high' | 'medium' | 'low';
}

export interface WikipediaPageWithReferences {
  title: string;
  content: string;
  url: string;
  references: WikipediaReference[];
  categories: string[];
  lastModified: string;
}

export class WikipediaReferenceExtractor {
  /**
   * Extract references from a Wikipedia page
   */
  static async extractReferencesFromPage(pageTitle: string): Promise<WikipediaPageWithReferences> {
    try {
      // Get the full Wikipedia page content
      const pageContent = await this.fetchWikipediaPageContent(pageTitle);
      
      // Extract references from the page
      const references = await this.parseReferencesFromContent(pageContent);
      
      // Extract categories
      const categories = this.extractCategories(pageContent);
      
      return {
        title: pageContent.title,
        content: pageContent.extract,
        url: pageContent.content_urls?.desktop?.page || '',
        references,
        categories,
        lastModified: pageContent.timestamp || new Date().toISOString()
      };
    } catch (error) {
      console.error('Error extracting Wikipedia references:', error);
      throw error;
    }
  }

  /**
   * Fetch full Wikipedia page content
   */
  private static async fetchWikipediaPageContent(pageTitle: string): Promise<any> {
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/html/${encodeURIComponent(pageTitle)}`
    );
    
    if (!response.ok) {
      throw new Error(`Wikipedia API failed: ${response.status}`);
    }
    
    const html = await response.text();
    return { html, title: pageTitle };
  }

  /**
   * Parse references from Wikipedia HTML content
   */
  private static async parseReferencesFromContent(pageContent: any): Promise<WikipediaReference[]> {
    const references: WikipediaReference[] = [];
    
    // Parse HTML to extract reference links
    const parser = new DOMParser();
    const doc = parser.parseFromString(pageContent.html, 'text/html');
    
    // Find all reference links
    const refLinks = doc.querySelectorAll('a[href^="http"]');
    
    for (const link of refLinks) {
      const href = link.getAttribute('href');
      const text = link.textContent?.trim() || '';
      
      if (href && this.isValidReference(href)) {
        const reference = await this.analyzeReference(href, text);
        if (reference) {
          references.push(reference);
        }
      }
    }
    
    // Remove duplicates and return
    return this.deduplicateReferences(references);
  }

  /**
   * Check if a URL is a valid reference
   */
  private static isValidReference(url: string): boolean {
    // Skip Wikipedia internal links, file uploads, etc.
    const skipPatterns = [
      'wikipedia.org',
      'wikimedia.org',
      'wikidata.org',
      'commons.wikimedia.org',
      'upload.wikimedia.org',
      'mailto:',
      'javascript:',
      '#'
    ];
    
    return !skipPatterns.some(pattern => url.includes(pattern));
  }

  /**
   * Analyze a reference URL to determine its type and reliability
   */
  private static async analyzeReference(url: string, title: string): Promise<WikipediaReference | null> {
    try {
      const domain = new URL(url).hostname;
      const type = this.classifyReferenceType(domain, url);
      const reliability = this.assessReliability(domain, url);
      
      return {
        id: this.generateReferenceId(url),
        url,
        title: title || this.extractTitleFromUrl(url),
        type,
        domain,
        reliability
      };
    } catch (error) {
      console.warn('Error analyzing reference:', url, error);
      return null;
    }
  }

  /**
   * Classify reference type based on domain and URL
   */
  private static classifyReferenceType(domain: string, url: string): WikipediaReference['type'] {
    const domainLower = domain.toLowerCase();
    
    // Academic sources
    if (domainLower.includes('arxiv.org') || 
        domainLower.includes('pubmed.ncbi.nlm.nih.gov') ||
        domainLower.includes('scholar.google.com') ||
        domainLower.includes('jstor.org') ||
        domainLower.includes('doi.org')) {
      return 'academic';
    }
    
    // Journal sources
    if (domainLower.includes('nature.com') ||
        domainLower.includes('science.org') ||
        domainLower.includes('cell.com') ||
        domainLower.includes('springer.com') ||
        domainLower.includes('elsevier.com')) {
      return 'journal';
    }
    
    // News sources
    if (domainLower.includes('bbc.com') ||
        domainLower.includes('cnn.com') ||
        domainLower.includes('nytimes.com') ||
        domainLower.includes('reuters.com') ||
        domainLower.includes('ap.org') ||
        domainLower.includes('news.') ||
        domainLower.includes('.com/news')) {
      return 'news';
    }
    
    // Book sources
    if (domainLower.includes('books.google.com') ||
        domainLower.includes('amazon.com') ||
        domainLower.includes('goodreads.com') ||
        domainLower.includes('isbn')) {
      return 'book';
    }
    
    return 'website';
  }

  /**
   * Assess reliability of a reference source
   */
  private static assessReliability(domain: string, url: string): WikipediaReference['reliability'] {
    const domainLower = domain.toLowerCase();
    
    // High reliability sources
    const highReliability = [
      'nature.com', 'science.org', 'cell.com', 'springer.com', 'elsevier.com',
      'arxiv.org', 'pubmed.ncbi.nlm.nih.gov', 'jstor.org', 'doi.org',
      'bbc.com', 'cnn.com', 'nytimes.com', 'reuters.com', 'ap.org',
      'gov.', '.edu', 'who.int', 'un.org', 'oecd.org'
    ];
    
    // Medium reliability sources
    const mediumReliability = [
      'wikipedia.org', 'britannica.com', 'encyclopedia.com',
      'theguardian.com', 'washingtonpost.com', 'wsj.com',
      'forbes.com', 'bloomberg.com', 'techcrunch.com'
    ];
    
    if (highReliability.some(pattern => domainLower.includes(pattern))) {
      return 'high';
    }
    
    if (mediumReliability.some(pattern => domainLower.includes(pattern))) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Extract categories from Wikipedia page
   */
  private static extractCategories(pageContent: any): string[] {
    // This would need to be implemented with the Wikipedia API
    // For now, return empty array
    return [];
  }

  /**
   * Generate unique ID for reference
   */
  private static generateReferenceId(url: string): string {
    const urlHash = this.simpleHash(url);
    return `ref-${urlHash}`;
  }

  /**
   * Extract title from URL
   */
  private static extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(part => part);
      return pathParts[pathParts.length - 1] || urlObj.hostname;
    } catch {
      return url;
    }
  }

  /**
   * Remove duplicate references
   */
  private static deduplicateReferences(references: WikipediaReference[]): WikipediaReference[] {
    const seen = new Set<string>();
    return references.filter(ref => {
      if (seen.has(ref.url)) {
        return false;
      }
      seen.add(ref.url);
      return true;
    });
  }

  /**
   * Simple hash function
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Fetch content from a reference URL
   */
  static async fetchReferenceContent(reference: WikipediaReference): Promise<RetrievedContent | null> {
    try {
      // Use our existing content extractor
      const { ContentExtractor } = await import('./contentExtractor');
      const extracted = await ContentExtractor.extractFromUrl(reference.url);
      
      return {
        title: extracted.title || reference.title,
        url: reference.url,
        content: extracted.content,
        sourceType: 'url',
        sourceTitle: extracted.title || reference.title,
        sourceAuthor: extracted.author,
        relevanceScore: this.calculateRelevanceScore(reference)
      };
    } catch (error) {
      console.error('Error fetching reference content:', reference.url, error);
      return null;
    }
  }

  /**
   * Calculate relevance score based on reference reliability
   */
  private static calculateRelevanceScore(reference: WikipediaReference): number {
    const reliabilityScores = {
      'high': 0.9,
      'medium': 0.7,
      'low': 0.5
    };
    
    return reliabilityScores[reference.reliability];
  }
}
