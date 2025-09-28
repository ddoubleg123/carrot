import { JSDOM } from 'jsdom';

export interface ExtractedContent {
  title?: string;
  content: string;
  author?: string;
  publishedAt?: Date;
  url?: string;
  metadata?: Record<string, any>;
}

export class ContentExtractor {
  /**
   * Extract content from a URL
   */
  static async extractFromUrl(url: string): Promise<ExtractedContent> {
    try {
      // Special handling for YouTube URLs
      if (this.isYouTubeUrl(url)) {
        return await this.extractFromYouTube(url)
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      return this.extractFromHtml(html, url);
    } catch (error) {
      console.error('Error extracting content from URL:', error);
      
      // For Wikipedia URLs, provide a fallback with basic content
      if (url.includes('wikipedia.org')) {
        const title = this.extractTitleFromUrl(url);
        return {
          title: title || 'Wikipedia Article',
          content: `Content from Wikipedia article: ${title || url}. This content was not fully extracted due to technical limitations, but the agent can still learn from the reference.`,
          url,
          metadata: {
            source: 'wikipedia',
            extractionError: error instanceof Error ? error.message : 'Unknown error',
            fallback: true
          }
        };
      }
      
      // For other URLs, provide a minimal fallback
      return {
        title: 'Web Content',
        content: `Content from ${url}. This content was not fully extracted due to technical limitations, but the agent can still learn from the reference.`,
        url,
        metadata: {
          extractionError: error instanceof Error ? error.message : 'Unknown error',
          fallback: true
        }
      };
    }
  }

  private static isYouTubeUrl(url: string): boolean {
    try {
      const u = new URL(url)
      return /(^|\.)youtube\.com$/.test(u.hostname) || u.hostname === 'youtu.be'
    } catch { return false }
  }

  private static extractYouTubeId(url: string): string | null {
    try {
      const u = new URL(url)
      if (u.hostname === 'youtu.be') {
        return u.pathname.slice(1) || null
      }
      if (/(^|\.)youtube\.com$/.test(u.hostname)) {
        if (u.pathname === '/watch') return u.searchParams.get('v')
        const match = u.pathname.match(/\/shorts\/([\w-]{6,})/)
        if (match) return match[1]
      }
    } catch {}
    return null
  }

  private static async extractFromYouTube(url: string): Promise<ExtractedContent> {
    const videoId = this.extractYouTubeId(url)
    const metadata: Record<string, any> = { source: 'youtube', videoId }
    let title: string | undefined
    let author: string | undefined
    let description = ''
    let thumbnail: string | undefined

    // Try oEmbed for title/author/thumbnail
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
      const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(8000) })
      if (res.ok) {
        const j = await res.json() as any
        title = j.title
        author = j.author_name
        thumbnail = j.thumbnail_url
        metadata.oembed = j
      }
    } catch {}

    // Fetch watch page to extract description and meta
    try {
      const watchUrl = videoId ? `https://www.youtube.com/watch?v=${videoId}` : url
      const page = await fetch(watchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) })
      if (page.ok) {
        const html = await page.text()
        const dom = new JSDOM(html)
        const doc = dom.window.document
        // Description meta
        const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content')
          || doc.querySelector('meta[property="og:description"]')?.getAttribute('content')
          || undefined
        if (metaDesc) description = metaDesc
        // Title override if missing
        if (!title) title = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || doc.title || undefined
        // Thumbnail
        const ogImg = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || undefined
        thumbnail = thumbnail || ogImg || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined)
        metadata.thumbnail = thumbnail
      }
    } catch {}

    // Build content body
    const body: string[] = []
    if (title) body.push(`# ${title}`)
    body.push(`YouTube video: ${url}`)
    if (author) body.push(`By: ${author}`)
    if (description) body.push('\n' + description)

    return {
      title: title || 'YouTube Video',
      content: body.join('\n'),
      author,
      url,
      metadata,
    }
  }

  /**
   * Extract title from Wikipedia URL
   */
  private static extractTitleFromUrl(url: string): string | undefined {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('wikipedia.org')) {
        const pathParts = urlObj.pathname.split('/');
        const titlePart = pathParts[pathParts.length - 1];
        if (titlePart) {
          return decodeURIComponent(titlePart.replace(/_/g, ' '));
        }
      }
    } catch (error) {
      console.error('Error extracting title from URL:', error);
    }
    return undefined;
  }

  /**
   * Extract content from HTML
   */
  static extractFromHtml(html: string, url?: string): ExtractedContent {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Extract title
    const title = this.extractTitle(document);

    // Extract main content
    const content = this.extractMainContent(document);

    // Extract author
    const author = this.extractAuthor(document);

    // Extract published date
    const publishedAt = this.extractPublishedDate(document);

    // Extract metadata
    const metadata = this.extractMetadata(document);

    return {
      title,
      content,
      author,
      publishedAt,
      url,
      metadata,
    };
  }

  /**
   * Extract title from document
   */
  private static extractTitle(document: Document): string | undefined {
    // Try various title selectors
    const titleSelectors = [
      'h1',
      'title',
      '[property="og:title"]',
      '[name="twitter:title"]',
      '.title',
      '.headline',
      '.post-title',
      '.article-title',
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const title = element.textContent?.trim();
        if (title && title.length > 0) {
          return title;
        }
      }
    }

    return undefined;
  }

  /**
   * Extract main content from document
   */
  private static extractMainContent(document: Document): string {
    // Try to find the main content area
    const contentSelectors = [
      'article',
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content',
      'main',
      '.main-content',
      '[role="main"]',
    ];

    let contentElement: Element | null = null;

    for (const selector of contentSelectors) {
      contentElement = document.querySelector(selector);
      if (contentElement) {
        break;
      }
    }

    // Fallback to body if no specific content area found
    if (!contentElement) {
      contentElement = document.body;
    }

    if (!contentElement) {
      return '';
    }

    // Remove unwanted elements
    const unwantedSelectors = [
      'script',
      'style',
      'nav',
      'header',
      'footer',
      '.advertisement',
      '.ads',
      '.sidebar',
      '.comments',
      '.social-share',
      '.related-posts',
    ];

    unwantedSelectors.forEach(selector => {
      const elements = contentElement!.querySelectorAll(selector);
      elements.forEach(el => el.remove());
    });

    // Extract text content
    const textContent = contentElement.textContent || '';
    
    // Clean up the text
    return this.cleanText(textContent);
  }

  /**
   * Extract author from document
   */
  private static extractAuthor(document: Document): string | undefined {
    const authorSelectors = [
      '[rel="author"]',
      '.author',
      '.byline',
      '.post-author',
      '[property="article:author"]',
      '[name="author"]',
    ];

    for (const selector of authorSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const author = element.textContent?.trim() || element.getAttribute('content');
        if (author && author.length > 0) {
          return author;
        }
      }
    }

    return undefined;
  }

  /**
   * Extract published date from document
   */
  private static extractPublishedDate(document: Document): Date | undefined {
    const dateSelectors = [
      'time[datetime]',
      '[property="article:published_time"]',
      '[name="article:published_time"]',
      '.published-date',
      '.post-date',
      '.date',
    ];

    for (const selector of dateSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const dateString = element.getAttribute('datetime') || 
                          element.getAttribute('content') || 
                          element.textContent?.trim();
        
        if (dateString) {
          const date = new Date(dateString);
          if (!isNaN(date.getTime())) {
            return date;
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Extract metadata from document
   */
  private static extractMetadata(document: Document): Record<string, any> {
    const metadata: Record<string, any> = {};

    // Extract meta tags
    const metaTags = document.querySelectorAll('meta');
    metaTags.forEach(meta => {
      const name = meta.getAttribute('name') || meta.getAttribute('property');
      const content = meta.getAttribute('content');
      
      if (name && content) {
        metadata[name] = content;
      }
    });

    // Extract Open Graph tags
    const ogTags = document.querySelectorAll('[property^="og:"]');
    ogTags.forEach(tag => {
      const property = tag.getAttribute('property');
      const content = tag.getAttribute('content');
      
      if (property && content) {
        metadata[property] = content;
      }
    });

    // Extract Twitter Card tags
    const twitterTags = document.querySelectorAll('[name^="twitter:"]');
    twitterTags.forEach(tag => {
      const name = tag.getAttribute('name');
      const content = tag.getAttribute('content');
      
      if (name && content) {
        metadata[name] = content;
      }
    });

    return metadata;
  }

  /**
   * Clean and normalize text content
   */
  private static cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/\n\s*\n/g, '\n') // Replace multiple newlines with single newline
      .trim();
  }

  /**
   * Extract content from a file (placeholder for future implementation)
   */
  static async extractFromFile(file: File): Promise<ExtractedContent> {
    // TODO: Implement file content extraction
    // This would handle PDFs, Word docs, etc.
    throw new Error('File extraction not yet implemented');
  }

  /**
   * Extract content from a Carrot post
   */
  static extractFromPost(post: any): ExtractedContent {
    return {
      title: post.title,
      content: post.body || post.content || '',
      author: post.author?.name,
      publishedAt: new Date(post.createdAt),
      url: post.url,
      metadata: {
        postId: post.id,
        type: post.type,
        tags: post.tags,
      },
    };
  }
}

export default ContentExtractor;
