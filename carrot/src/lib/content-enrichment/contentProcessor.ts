import { JSDOM } from 'jsdom';
import { ImageExtractor } from './imageExtractor';
import { AIImageGenerator } from './aiImageGenerator';
import { FreeImageAPIs } from './freeImageAPIs';

export interface ContentProcessingResult {
  content: {
    summary150: string;
    keyPoints: string[];
    notableQuote?: string;
    fullText?: string;
    transcript?: string;
  };
  media: {
    hero?: string;
    gallery: string[];
    videoThumb?: string;
    pdfPreview?: string;
  };
  metadata: {
    author?: string;
    publishDate?: string;
    source: string;
    readingTime: number;
    tags: string[];
    entities: string[];
    citation: any;
  };
  qualityScore: number;
  freshnessScore: number;
  diversityBucket: string;
}

export class ContentProcessor {
  /**
   * Process a discovered content item
   */
  static async processItem(
    url: string, 
    type: 'article' | 'video' | 'pdf' | 'post',
    title: string
  ): Promise<ContentProcessingResult> {
    try {
      // Extract content first to get text for AI image generation
      let contentData;
      switch (type) {
        case 'video':
          contentData = await this.processVideo(url, title);
          break;
        case 'pdf':
          contentData = await this.processPdf(url, title);
          break;
        case 'article':
          contentData = await this.processArticle(url, title);
          break;
        default:
          contentData = await this.processGeneric(url, title);
      }

      // Multi-tier image strategy:
      // 1. AI-generated images (Janus) - primary approach
      // 2. Free API images (Pexels, Unsplash, etc.) - secondary
      // 3. Safe extracted images - tertiary
      // 4. Generated fallback - final fallback

      let finalImageResult = null;

      // Try AI generation first
      try {
        const aiImageResult = await AIImageGenerator.generateImagesForContent(
          title,
          (contentData as any).fullText || contentData.summary150,
          type,
          url
        );
        
        if (aiImageResult.hero && !aiImageResult.hero.includes('ui-avatars.com')) {
          finalImageResult = aiImageResult;
        }
      } catch (error) {
        console.warn('AI image generation failed:', error);
      }

      // Try free APIs if AI generation failed
      if (!finalImageResult) {
        try {
          const freeImageResult = await FreeImageAPIs.getBestImageForContent(
            title,
            (contentData as any).fullText || contentData.summary150,
            type
          );
          
          if (freeImageResult) {
            finalImageResult = {
              hero: freeImageResult.url,
              gallery: [freeImageResult.url],
              fallback: freeImageResult.url
            };
          }
        } catch (error) {
          console.warn('Free image API search failed:', error);
        }
      }

      // Try safe image extraction if free APIs failed
      if (!finalImageResult) {
        try {
          const safeImageResult = await ImageExtractor.extractFromUrl(url, type);
          if (safeImageResult.hero && !safeImageResult.hero.includes('ui-avatars.com')) {
            finalImageResult = safeImageResult;
          }
        } catch (error) {
          console.warn('Safe image extraction failed:', error);
        }
      }

      // Final fallback to generated image
      if (!finalImageResult) {
        finalImageResult = AIImageGenerator.generateFallback(url, type);
      }

      // Extract metadata
      const metadata = await this.extractMetadata(url, type, title);
      
      // Calculate quality and freshness scores
      const qualityScore = this.calculateQualityScore(contentData, finalImageResult, metadata);
      const freshnessScore = this.calculateFreshnessScore(metadata.publishDate);
      const diversityBucket = this.calculateDiversityBucket(url, type);

      return {
        content: contentData,
        media: {
          hero: finalImageResult.hero,
          gallery: finalImageResult.gallery,
          videoThumb: finalImageResult.videoThumb,
          pdfPreview: finalImageResult.pdfPreview
        },
        metadata,
        qualityScore,
        freshnessScore,
        diversityBucket
      };
    } catch (error) {
      console.error('Content processing failed:', error);
      throw error;
    }
  }

  /**
   * Process article content
   */
  private static async processArticle(url: string, title: string) {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CarrotBot/1.0; +https://carrot.com/bot)'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Extract main content using readability-like algorithm
    const mainContent = this.extractMainContent(document);
    const fullText = this.cleanText(mainContent);

    // Generate summary using AI (mock for now - replace with real AI)
    const summary150 = await this.generateSummary(fullText, title);
    
    // Extract key points
    const keyPoints = this.extractKeyPoints(fullText);
    
    // Extract notable quote
    const notableQuote = this.extractNotableQuote(fullText);

    return {
      summary150,
      keyPoints,
      notableQuote,
      fullText: fullText.length > 1000 ? fullText.substring(0, 1000) + '...' : fullText
    };
  }

  /**
   * Process video content
   */
  private static async processVideo(url: string, title: string) {
    // For YouTube videos, we could extract description and use AI to summarize
    // For now, generate based on title and URL
    const summary150 = `This video discusses ${title.toLowerCase()}. It provides insights and analysis on the topic with visual content and commentary.`;
    
    const keyPoints = [
      'Visual presentation of key concepts',
      'Expert commentary and analysis',
      'Real-world examples and applications'
    ];

    const notableQuote = '"This video provides valuable insights into the topic with clear explanations and examples."';

    return {
      summary150,
      keyPoints,
      notableQuote,
      transcript: 'Video transcript would be extracted here...'
    };
  }

  /**
   * Process PDF content
   */
  private static async processPdf(url: string, title: string) {
    // PDF processing would require specialized tools
    // For now, generate based on title
    const summary150 = `This PDF document contains detailed information about ${title.toLowerCase()}. It provides comprehensive coverage of the topic with structured content and references.`;
    
    const keyPoints = [
      'Comprehensive documentation',
      'Structured information',
      'Detailed analysis and data'
    ];

    return {
      summary150,
      keyPoints
    };
  }

  /**
   * Process generic content
   */
  private static async processGeneric(url: string, title: string) {
    const summary150 = `This content provides information about ${title.toLowerCase()}. It offers insights and details on the topic.`;
    
    const keyPoints = [
      'Relevant information',
      'Topic coverage',
      'Useful insights'
    ];

    return {
      summary150,
      keyPoints
    };
  }

  /**
   * Extract main content from HTML document
   */
  private static extractMainContent(document: Document): string {
    // Try to find main content areas
    const contentSelectors = [
      'article',
      '[role="main"]',
      '.content',
      '.post-content',
      '.entry-content',
      '.article-content',
      'main',
      '.main-content'
    ];

    for (const selector of contentSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent || '';
      }
    }

    // Fallback: get body content
    const body = document.body;
    if (body) {
      // Remove script and style elements
      const scripts = body.querySelectorAll('script, style, nav, header, footer, aside');
      scripts.forEach(el => el.remove());
      return body.textContent || '';
    }

    return '';
  }

  /**
   * Clean and normalize text
   */
  private static cleanText(text: string): string {
    return text
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/\n\s*\n/g, '\n') // Remove empty lines
      .trim();
  }

  /**
   * Generate AI summary (mock implementation)
   */
  private static async generateSummary(text: string, title: string): Promise<string> {
    // TODO: Replace with real AI summarization using DeepSeek or similar
    // For now, create a simple extractive summary
    
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const firstSentence = sentences[0]?.trim();
    
    if (firstSentence && firstSentence.length <= 180) {
      return firstSentence;
    }

    // Fallback: generate based on title
    return `This content provides valuable insights about ${title.toLowerCase()}. It covers key aspects and offers practical information for understanding the topic.`;
  }

  /**
   * Extract key points from text
   */
  private static extractKeyPoints(text: string): string[] {
    // Simple key point extraction (replace with AI)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const keyPoints: string[] = [];

    // Look for sentences that might be key points
    for (const sentence of sentences.slice(0, 10)) {
      const trimmed = sentence.trim();
      if (trimmed.length > 30 && trimmed.length < 120) {
        keyPoints.push(trimmed);
        if (keyPoints.length >= 3) break;
      }
    }

    // Fallback key points
    if (keyPoints.length === 0) {
      return [
        'Comprehensive topic coverage',
        'Detailed information and insights',
        'Practical applications and examples'
      ];
    }

    return keyPoints;
  }

  /**
   * Extract notable quote from text
   */
  private static extractNotableQuote(text: string): string | undefined {
    // Look for quoted text
    const quotes = text.match(/"([^"]{20,120})"/g);
    if (quotes && quotes.length > 0) {
      return quotes[0].replace(/"/g, '');
    }

    // Look for sentences that might be quotes
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 40 && trimmed.length < 160) {
        return trimmed;
      }
    }

    return undefined;
  }

  /**
   * Extract metadata from URL and content
   */
  private static async extractMetadata(url: string, type: string, title: string) {
    const domain = this.extractDomain(url);
    
    return {
      author: 'Content Author', // TODO: Extract from page
      publishDate: new Date().toISOString(), // TODO: Extract from page
      source: domain,
      readingTime: this.calculateReadingTime(title), // TODO: Calculate from actual content
      tags: this.extractTags(title, type),
      entities: this.extractEntities(title),
      citation: {
        title,
        url,
        type,
        domain
      }
    };
  }

  /**
   * Calculate reading time
   */
  private static calculateReadingTime(text: string): number {
    const wordsPerMinute = 200;
    const wordCount = text.split(/\s+/).length;
    return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
  }

  /**
   * Extract tags from title and content
   */
  private static extractTags(title: string, type: string): string[] {
    const tags = [type];
    
    // Add common tags based on title content
    const titleLower = title.toLowerCase();
    if (titleLower.includes('guide') || titleLower.includes('how to')) tags.push('guide');
    if (titleLower.includes('review') || titleLower.includes('analysis')) tags.push('review');
    if (titleLower.includes('news') || titleLower.includes('update')) tags.push('news');
    if (titleLower.includes('tutorial') || titleLower.includes('learn')) tags.push('tutorial');
    
    return tags;
  }

  /**
   * Extract entities from title
   */
  private static extractEntities(title: string): string[] {
    // Simple entity extraction (replace with NER)
    const words = title.split(/\s+/);
    const entities: string[] = [];
    
    // Look for capitalized words that might be entities
    for (const word of words) {
      if (word.length > 2 && /^[A-Z]/.test(word)) {
        entities.push(word);
      }
    }
    
    return entities.slice(0, 5);
  }

  /**
   * Calculate quality score
   */
  private static calculateQualityScore(content: any, media: any, metadata: any): number {
    let score = 0.5; // Base score

    // Content quality
    if (content.summary150 && content.summary150.length > 50) score += 0.1;
    if (content.keyPoints && content.keyPoints.length >= 3) score += 0.1;
    if (content.fullText && content.fullText.length > 200) score += 0.1;
    if (content.notableQuote) score += 0.05;

    // Media quality
    if (media.hero && !media.hero.includes('ui-avatars.com')) score += 0.1;
    if (media.gallery && media.gallery.length > 0) score += 0.05;

    // Metadata quality
    if (metadata.author) score += 0.05;
    if (metadata.tags && metadata.tags.length > 1) score += 0.05;
    if (metadata.entities && metadata.entities.length > 0) score += 0.05;

    return Math.min(1.0, score);
  }

  /**
   * Calculate freshness score
   */
  private static calculateFreshnessScore(publishDate?: string): number {
    if (!publishDate) return 0.5;

    const publish = new Date(publishDate);
    const now = new Date();
    const daysDiff = (now.getTime() - publish.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff < 7) return 1.0;
    if (daysDiff < 30) return 0.8;
    if (daysDiff < 90) return 0.6;
    if (daysDiff < 365) return 0.4;
    return 0.2;
  }

  /**
   * Calculate diversity bucket
   */
  private static calculateDiversityBucket(url: string, type: string): string {
    const domain = this.extractDomain(url);
    const hash = this.simpleHash(domain);
    return `bucket_${hash % 5}`;
  }

  /**
   * Extract domain from URL
   */
  private static extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }

  /**
   * Simple hash function
   */
  private static simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}
