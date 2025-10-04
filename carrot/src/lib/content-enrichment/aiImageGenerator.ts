import { ContentProcessor } from './contentProcessor';

export interface AIImageGenerationResult {
  hero?: string;
  gallery: string[];
  fallback: string;
}

export interface ImagePrompt {
  text: string;
  style: 'realistic' | 'illustration' | 'minimal' | 'professional';
  aspectRatio: '16:9' | '4:3' | '1:1';
}

export class AIImageGenerator {
  private static readonly JANUS_API_BASE = process.env.JANUS_API_BASE || 'https://api.deepseek.com';
  private static readonly JANUS_API_KEY = process.env.JANUS_API_KEY;

  /**
   * Generate images for discovered content using Janus
   */
  static async generateImagesForContent(
    title: string,
    content: string,
    type: 'article' | 'video' | 'pdf' | 'post',
    url: string
  ): Promise<AIImageGenerationResult> {
    try {
      // Generate hero image
      const heroPrompt = this.createHeroPrompt(title, content, type);
      const heroImage = await this.generateImage(heroPrompt);
      
      // Generate gallery images (optional)
      const galleryPrompts = this.createGalleryPrompts(title, content, type);
      const galleryImages = await Promise.all(
        galleryPrompts.map(prompt => this.generateImage(prompt))
      );

      // Filter out failed generations
      const validGalleryImages = galleryImages.filter(img => img !== null) as string[];

      return {
        hero: heroImage || this.generateFallback(url, type).fallback,
        gallery: validGalleryImages,
        fallback: this.generateFallback(url, type).fallback
      };
    } catch (error) {
      console.error('AI image generation failed:', error);
      return this.generateFallback(url, type);
    }
  }

  /**
   * Create hero image prompt
   */
  private static createHeroPrompt(
    title: string,
    content: string,
    type: string
  ): ImagePrompt {
    // Extract key concepts from title and content
    const concepts = this.extractKeyConcepts(title, content);
    const domain = this.extractDomainFromContent(content);
    
    let promptText = '';
    let style: 'realistic' | 'illustration' | 'minimal' | 'professional' = 'professional';

    switch (type) {
      case 'article':
        promptText = this.createArticlePrompt(title, concepts, domain);
        style = 'professional';
        break;
      case 'video':
        promptText = this.createVideoPrompt(title, concepts, domain);
        style = 'realistic';
        break;
      case 'pdf':
        promptText = this.createPdfPrompt(title, concepts, domain);
        style = 'minimal';
        break;
      default:
        promptText = this.createGenericPrompt(title, concepts, domain);
        style = 'illustration';
    }

    return {
      text: promptText,
      style,
      aspectRatio: '16:9'
    };
  }

  /**
   * Create article-specific prompt
   */
  private static createArticlePrompt(title: string, concepts: string[], domain: string): string {
    const mainConcept = concepts[0] || 'information';
    const secondaryConcept = concepts[1] || 'content';
    
    return `Professional article header image about ${mainConcept} and ${secondaryConcept}. Clean, modern design with subtle gradients. Typography-friendly layout with space for title overlay. Color scheme: professional blues and whites. High quality, 16:9 aspect ratio, suitable for web article header.`;
  }

  /**
   * Create video-specific prompt
   */
  private static createVideoPrompt(title: string, concepts: string[], domain: string): string {
    const mainConcept = concepts[0] || 'content';
    
    return `Dynamic video thumbnail for ${mainConcept}. Engaging visual with play button overlay. Bright, attention-grabbing colors. Professional video thumbnail style, 16:9 aspect ratio. High contrast, clear typography space.`;
  }

  /**
   * Create PDF-specific prompt
   */
  private static createPdfPrompt(title: string, concepts: string[], domain: string): string {
    const mainConcept = concepts[0] || 'document';
    
    return `Clean, minimal document preview for ${mainConcept}. Professional document layout with subtle shadows. Clean typography, document-style design. Neutral colors, 16:9 aspect ratio. Suitable for PDF preview thumbnail.`;
  }

  /**
   * Create generic prompt
   */
  private static createGenericPrompt(title: string, concepts: string[], domain: string): string {
    const mainConcept = concepts[0] || 'content';
    
    return `Modern, clean illustration representing ${mainConcept}. Professional design with subtle colors. 16:9 aspect ratio, suitable for web content. Minimalist style with clear visual hierarchy.`;
  }

  /**
   * Create gallery image prompts
   */
  private static createGalleryPrompts(
    title: string,
    content: string,
    type: string
  ): ImagePrompt[] {
    const concepts = this.extractKeyConcepts(title, content);
    const prompts: ImagePrompt[] = [];

    // Generate 2-3 additional images for gallery
    for (let i = 1; i < Math.min(concepts.length, 3); i++) {
      const concept = concepts[i];
      if (concept) {
        prompts.push({
          text: `Supporting visual for ${concept}. Clean, professional design. 4:3 aspect ratio. Complementary to main content.`,
          style: 'minimal',
          aspectRatio: '4:3'
        });
      }
    }

    return prompts;
  }

  /**
   * Generate image using Janus API
   */
  private static async generateImage(prompt: ImagePrompt): Promise<string | null> {
    if (!this.JANUS_API_KEY) {
      console.warn('Janus API key not configured, skipping image generation');
      return null;
    }

    try {
      const response = await fetch(`${this.JANUS_API_BASE}/v1/images/generations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.JANUS_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'janus-flow-1.3b',
          prompt: prompt.text,
          style: prompt.style,
          aspect_ratio: prompt.aspectRatio,
          quality: 'high',
          size: '1024x1024', // Will be resized based on aspect ratio
          num_images: 1
        })
      });

      if (!response.ok) {
        throw new Error(`Janus API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.data && data.data[0] && data.data[0].url) {
        return data.data[0].url;
      }

      return null;
    } catch (error) {
      console.error('Janus image generation failed:', error);
      return null;
    }
  }

  /**
   * Extract key concepts from title and content
   */
  private static extractKeyConcepts(title: string, content: string): string[] {
    // Simple concept extraction (replace with more sophisticated NLP)
    const text = `${title} ${content}`.toLowerCase();
    
    // Common concept patterns
    const conceptPatterns = [
      /technology|tech|digital|software|app|platform/i,
      /business|marketing|strategy|growth|startup/i,
      /design|ui|ux|interface|user experience/i,
      /data|analytics|insights|metrics|performance/i,
      /innovation|future|trends|development/i,
      /education|learning|training|skills/i,
      /health|medical|wellness|fitness/i,
      /finance|money|investment|economy/i,
      /science|research|study|analysis/i,
      /art|creative|visual|design/i
    ];

    const concepts: string[] = [];
    
    for (const pattern of conceptPatterns) {
      const match = text.match(pattern);
      if (match) {
        concepts.push(match[0]);
      }
    }

    // Fallback to title words
    if (concepts.length === 0) {
      const titleWords = title.split(/\s+/).filter(word => word.length > 3);
      concepts.push(...titleWords.slice(0, 3));
    }

    return concepts.slice(0, 5);
  }

  /**
   * Extract domain from content
   */
  private static extractDomainFromContent(content: string): string {
    // Simple domain extraction
    const domainPatterns = [
      /technology|tech/i,
      /business|finance/i,
      /health|medical/i,
      /education|learning/i,
      /science|research/i,
      /art|creative/i
    ];

    for (const pattern of domainPatterns) {
      if (pattern.test(content)) {
        return pattern.source.replace(/[()|]/g, '');
      }
    }

    return 'general';
  }

  /**
   * Generate fallback image
   */
  private static generateFallback(url: string, type: string): AIImageGenerationResult {
    const colors = {
      article: '0A5AFF',
      video: 'FF6A00',
      pdf: '8B5CF6',
      post: '10B981'
    };
    
    const color = colors[type as keyof typeof colors] || '60646C';
    const domain = this.extractDomain(url);
    const encodedDomain = encodeURIComponent(domain);
    
    const fallback = `https://ui-avatars.com/api/?name=${encodedDomain}&background=${color}&color=fff&size=800&format=png&bold=true`;
    
    return {
      fallback,
      gallery: [fallback]
    };
  }

  /**
   * Extract domain from URL
   */
  private static extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'Unknown';
    }
  }

  /**
   * Batch generate images for multiple content items
   */
  static async batchGenerateImages(
    items: Array<{ title: string; content: string; type: string; url: string }>
  ): Promise<Map<string, AIImageGenerationResult>> {
    const results = new Map<string, AIImageGenerationResult>();
    
    // Process in batches to avoid rate limits
    const batchSize = 3;
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (item) => {
        const result = await this.generateImagesForContent(
          item.title,
          item.content,
          item.type as any,
          item.url
        );
        return { url: item.url, result };
      });

      const batchResults = await Promise.all(batchPromises);
      
      for (const { url, result } of batchResults) {
        results.set(url, result);
      }

      // Add delay between batches
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }
}