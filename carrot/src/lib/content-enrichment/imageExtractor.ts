import { JSDOM } from 'jsdom';

export interface ImageExtractionResult {
  hero?: string;
  gallery: string[];
  videoThumb?: string;
  pdfPreview?: string;
  fallback: string;
}

export interface ImageMetadata {
  url: string;
  width: number;
  height: number;
  alt: string;
  caption?: string;
}

export class ImageExtractor {
  private static readonly MIN_IMAGE_SIZE = 200;
  private static readonly MAX_IMAGES = 4;
  private static readonly PREFERRED_ASPECT_RATIOS = [16/9, 4/3, 3/2, 1/1];

  /**
   * Extract images from a web page
   */
  static async extractFromUrl(url: string, type: 'article' | 'video' | 'pdf' | 'post'): Promise<ImageExtractionResult> {
    try {
      // Handle different content types
      switch (type) {
        case 'video':
          return await this.extractVideoThumbnail(url);
        case 'pdf':
          return await this.extractPdfPreview(url);
        default:
          return await this.extractFromWebPage(url);
      }
    } catch (error) {
      console.error('Image extraction failed:', error);
      return this.generateFallback(url, type);
    }
  }

  /**
   * Extract images from a web page (LEGAL COMPLIANCE FOCUS)
   */
  private static async extractFromWebPage(url: string): Promise<ImageExtractionResult> {
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

    // ONLY extract images that are explicitly safe for reuse
    const safeImages = await this.extractSafeImages(document, url);
    
    // Extract favicon (usually safe)
    const favicon = this.extractFavicon(document, url);

    // Build result - prefer safe images, fallback to generated
    const hero = safeImages.hero || this.generateFallback(url, 'article').fallback;
    const gallery = safeImages.gallery;
    
    return {
      hero,
      gallery,
      fallback: this.generateFallback(url, 'article').fallback
    };
  }

  /**
   * Extract ONLY legally safe images
   */
  private static async extractSafeImages(document: Document, baseUrl: string): Promise<{ hero?: string; gallery: string[] }> {
    const safeImages: string[] = [];
    
    // 1. Check for Creative Commons or open source images
    const ccImages = this.extractCreativeCommonsImages(document, baseUrl);
    safeImages.push(...ccImages);
    
    // 2. Check for images with explicit reuse permissions
    const permittedImages = this.extractPermittedImages(document, baseUrl);
    safeImages.push(...permittedImages);
    
    // 3. Check for public domain images
    const publicDomainImages = this.extractPublicDomainImages(document, baseUrl);
    safeImages.push(...publicDomainImages);

    // 4. Check for images from known safe sources
    const safeSourceImages = this.extractSafeSourceImages(document, baseUrl);
    safeImages.push(...safeSourceImages);

    // Remove duplicates and return
    const uniqueImages = [...new Set(safeImages)];
    
    return {
      hero: uniqueImages[0],
      gallery: uniqueImages.slice(0, this.MAX_IMAGES)
    };
  }

  /**
   * Extract Creative Commons images
   */
  private static extractCreativeCommonsImages(document: Document, baseUrl: string): string[] {
    const ccImages: string[] = [];
    
    // Look for images with CC licenses
    const imgTags = document.querySelectorAll('img');
    
    for (const img of imgTags) {
      const src = img.getAttribute('src');
      if (!src) continue;

      const url = this.normalizeImageUrl(src, baseUrl);
      
      // Check for CC license indicators
      const hasCCLicense = this.hasCreativeCommonsLicense(img, document);
      if (hasCCLicense && this.isValidImageUrl(url)) {
        ccImages.push(url);
      }
    }
    
    return ccImages;
  }

  /**
   * Extract images with explicit reuse permissions
   */
  private static extractPermittedImages(document: Document, baseUrl: string): string[] {
    const permittedImages: string[] = [];
    
    // Look for images with explicit reuse permissions
    const imgTags = document.querySelectorAll('img');
    
    for (const img of imgTags) {
      const src = img.getAttribute('src');
      if (!src) continue;

      const url = this.normalizeImageUrl(src, baseUrl);
      
      // Check for explicit reuse permissions
      const hasReusePermission = this.hasReusePermission(img, document);
      if (hasReusePermission && this.isValidImageUrl(url)) {
        permittedImages.push(url);
      }
    }
    
    return permittedImages;
  }

  /**
   * Extract public domain images
   */
  private static extractPublicDomainImages(document: Document, baseUrl: string): string[] {
    const publicDomainImages: string[] = [];
    
    // Look for images marked as public domain
    const imgTags = document.querySelectorAll('img');
    
    for (const img of imgTags) {
      const src = img.getAttribute('src');
      if (!src) continue;

      const url = this.normalizeImageUrl(src, baseUrl);
      
      // Check for public domain indicators
      const isPublicDomain = this.isPublicDomain(img, document);
      if (isPublicDomain && this.isValidImageUrl(url)) {
        publicDomainImages.push(url);
      }
    }
    
    return publicDomainImages;
  }

  /**
   * Extract images from known safe sources
   */
  private static extractSafeSourceImages(document: Document, baseUrl: string): string[] {
    const safeSourceImages: string[] = [];
    
    // Known safe image sources (government, educational, etc.)
    const safeDomains = [
      'commons.wikimedia.org',
      'upload.wikimedia.org',
      'images.nasa.gov',
      'www.nasa.gov',
      'unsplash.com',
      'pixabay.com',
      'pexels.com',
      'flickr.com' // Only if CC licensed
    ];
    
    const imgTags = document.querySelectorAll('img');
    
    for (const img of imgTags) {
      const src = img.getAttribute('src');
      if (!src) continue;

      const url = this.normalizeImageUrl(src, baseUrl);
      
      // Check if from safe domain
      const isFromSafeDomain = safeDomains.some(domain => url.includes(domain));
      if (isFromSafeDomain && this.isValidImageUrl(url)) {
        safeSourceImages.push(url);
      }
    }
    
    return safeSourceImages;
  }

  /**
   * Check if image has Creative Commons license
   */
  private static hasCreativeCommonsLicense(img: Element, document: Document): boolean {
    // Check for CC license in alt text, title, or nearby elements
    const alt = img.getAttribute('alt') || '';
    const title = img.getAttribute('title') || '';
    const className = img.getAttribute('class') || '';
    
    const ccIndicators = ['cc', 'creative commons', 'attribution', 'by-sa', 'by-nc'];
    const text = `${alt} ${title} ${className}`.toLowerCase();
    
    return ccIndicators.some(indicator => text.includes(indicator));
  }

  /**
   * Check if image has explicit reuse permission
   */
  private static hasReusePermission(img: Element, document: Document): boolean {
    // Check for explicit reuse permissions
    const alt = img.getAttribute('alt') || '';
    const title = img.getAttribute('title') || '';
    
    const permissionIndicators = [
      'free to use',
      'reuse allowed',
      'permission granted',
      'open source',
      'public use'
    ];
    
    const text = `${alt} ${title}`.toLowerCase();
    return permissionIndicators.some(indicator => text.includes(indicator));
  }

  /**
   * Check if image is public domain
   */
  private static isPublicDomain(img: Element, document: Document): boolean {
    // Check for public domain indicators
    const alt = img.getAttribute('alt') || '';
    const title = img.getAttribute('title') || '';
    
    const publicDomainIndicators = [
      'public domain',
      'pd',
      'no copyright',
      'government work'
    ];
    
    const text = `${alt} ${title}`.toLowerCase();
    return publicDomainIndicators.some(indicator => text.includes(indicator));
  }

  /**
   * Calculate image relevance score
   */
  private static calculateImageScore(img: Element, url: string): number {
    let score = 0;

    // Size-based scoring
    const width = parseInt(img.getAttribute('width') || '0');
    const height = parseInt(img.getAttribute('height') || '0');
    
    if (width >= 400 && height >= 300) score += 10;
    else if (width >= 300 && height >= 200) score += 5;
    else if (width < this.MIN_IMAGE_SIZE || height < this.MIN_IMAGE_SIZE) return 0;

    // Aspect ratio scoring
    if (width && height) {
      const aspectRatio = width / height;
      const closestRatio = this.PREFERRED_ASPECT_RATIOS.reduce((prev, curr) => 
        Math.abs(curr - aspectRatio) < Math.abs(prev - aspectRatio) ? curr : prev
      );
      const ratioScore = 1 - Math.abs(closestRatio - aspectRatio) / closestRatio;
      score += ratioScore * 5;
    }

    // Alt text scoring
    const alt = img.getAttribute('alt') || '';
    if (alt.length > 10 && alt.length < 200) score += 3;
    if (alt.toLowerCase().includes('hero') || alt.toLowerCase().includes('main')) score += 5;

    // Class and ID scoring
    const className = img.getAttribute('class') || '';
    const id = img.getAttribute('id') || '';
    
    if (className.includes('hero') || className.includes('main') || className.includes('featured')) score += 5;
    if (id.includes('hero') || id.includes('main') || id.includes('featured')) score += 5;
    if (className.includes('thumbnail') || className.includes('icon')) score -= 3;

    // URL-based scoring
    if (url.includes('hero') || url.includes('main') || url.includes('featured')) score += 3;
    if (url.includes('thumbnail') || url.includes('icon') || url.includes('avatar')) score -= 2;

    return score;
  }

  /**
   * Check if image is decorative (icons, logos, etc.)
   */
  private static isDecorativeImage(img: Element): boolean {
    const src = img.getAttribute('src') || '';
    const alt = img.getAttribute('alt') || '';
    const className = img.getAttribute('class') || '';
    const id = img.getAttribute('id') || '';

    // Skip small images
    const width = parseInt(img.getAttribute('width') || '0');
    const height = parseInt(img.getAttribute('height') || '0');
    if (width < 100 || height < 100) return true;

    // Skip common decorative patterns
    const decorativePatterns = [
      'icon', 'logo', 'avatar', 'thumbnail', 'sprite', 'pixel',
      'spacer', 'divider', 'bullet', 'arrow', 'button'
    ];

    const text = `${src} ${alt} ${className} ${id}`.toLowerCase();
    return decorativePatterns.some(pattern => text.includes(pattern));
  }

  /**
   * Extract favicon
   */
  private static extractFavicon(document: Document, baseUrl: string): string | null {
    // Try various favicon sources
    const faviconSelectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
      'link[rel="apple-touch-icon-precomposed"]'
    ];

    for (const selector of faviconSelectors) {
      const link = document.querySelector(selector);
      if (link) {
        const href = link.getAttribute('href');
        if (href) {
          return this.normalizeImageUrl(href, baseUrl);
        }
      }
    }

    // Default favicon
    try {
      const url = new URL(baseUrl);
      return `${url.protocol}//${url.host}/favicon.ico`;
    } catch {
      return null;
    }
  }

  /**
   * Extract YouTube thumbnail
   */
  private static async extractVideoThumbnail(url: string): Promise<ImageExtractionResult> {
    try {
      const videoId = this.extractYouTubeId(url);
      if (videoId) {
        // Try different thumbnail qualities
        const thumbnails = [
          `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
        ];

        // Test which thumbnail exists
        for (const thumb of thumbnails) {
          if (await this.testImageUrl(thumb)) {
            return {
              videoThumb: thumb,
              gallery: [thumb],
              fallback: this.generateFallback(url, 'video').fallback
            };
          }
        }
      }
    } catch (error) {
      console.error('YouTube thumbnail extraction failed:', error);
    }

    return this.generateFallback(url, 'video');
  }

  /**
   * Extract PDF preview (first page)
   */
  private static async extractPdfPreview(url: string): Promise<ImageExtractionResult> {
    // For now, return fallback - PDF preview extraction requires specialized tools
    return this.generateFallback(url, 'pdf');
  }

  /**
   * Extract YouTube video ID
   */
  private static extractYouTubeId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  }

  /**
   * Normalize image URL
   */
  private static normalizeImageUrl(url: string, baseUrl?: string): string {
    try {
      // If already absolute, return as-is
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return url;
      }

      // If baseUrl provided, resolve relative URL
      if (baseUrl) {
        return new URL(url, baseUrl).toString();
      }

      return url;
    } catch {
      return url;
    }
  }

  /**
   * Validate image URL
   */
  private static isValidImageUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname.toLowerCase();
      
      // Check for image extensions
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
      const hasImageExtension = imageExtensions.some(ext => pathname.endsWith(ext));
      
      // Check for common image CDN patterns
      const imageCdnPatterns = [
        'imgur.com', 'cloudinary.com', 'amazonaws.com', 'googleusercontent.com',
        'youtube.com/vi/', 'img.youtube.com', 'cdn.', 'images.'
      ];
      const hasImageCdn = imageCdnPatterns.some(pattern => url.includes(pattern));

      return hasImageExtension || hasImageCdn;
    } catch {
      return false;
    }
  }

  /**
   * Test if image URL is accessible
   */
  private static async testImageUrl(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok && response.headers.get('content-type')?.startsWith('image/');
    } catch {
      return false;
    }
  }

  /**
   * Generate fallback image
   */
  private static generateFallback(url: string, type: string): ImageExtractionResult {
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
}
