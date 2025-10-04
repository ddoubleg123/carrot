/**
 * Free Image APIs - Legal Commercial Use
 * 
 * This module provides access to multiple free image APIs that allow
 * commercial use without copyright concerns.
 */

export interface ImageSearchResult {
  id: string;
  url: string;
  thumbnail: string;
  width: number;
  height: number;
  photographer?: string;
  source: string;
  license: string;
  attribution?: string;
}

export interface ImageSearchOptions {
  query: string;
  perPage?: number;
  orientation?: 'landscape' | 'portrait' | 'square';
  size?: 'small' | 'medium' | 'large';
  color?: string;
}

export class FreeImageAPIs {
  private static readonly API_KEYS = {
    pexels: process.env.PEXELS_API_KEY,
    unsplash: process.env.UNSPLASH_ACCESS_KEY,
    pixabay: process.env.PIXABAY_API_KEY,
    // NASA and Wikimedia don't require API keys
  };

  /**
   * Search for images across multiple free APIs
   */
  static async searchImages(options: ImageSearchOptions): Promise<ImageSearchResult[]> {
    const results: ImageSearchResult[] = [];

    // Search multiple APIs in parallel
    const searches = [
      this.searchPexels(options),
      this.searchUnsplash(options),
      this.searchPixabay(options),
      this.searchWikimedia(options),
      this.searchNASA(options)
    ];

    const searchResults = await Promise.allSettled(searches);
    
    for (const result of searchResults) {
      if (result.status === 'fulfilled') {
        results.push(...result.value);
      }
    }

    // Remove duplicates and sort by relevance
    return this.deduplicateAndRank(results, options.query);
  }

  /**
   * Pexels API - Free commercial use, no attribution required
   */
  private static async searchPexels(options: ImageSearchOptions): Promise<ImageSearchResult[]> {
    if (!this.API_KEYS.pexels) {
      console.warn('Pexels API key not configured');
      return [];
    }

    try {
      const response = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(options.query)}&per_page=${options.perPage || 10}&orientation=${options.orientation || 'landscape'}`,
        {
          headers: {
            'Authorization': this.API_KEYS.pexels
          }
        }
      );

      if (!response.ok) throw new Error(`Pexels API error: ${response.status}`);

      const data = await response.json();
      
      return data.photos.map((photo: any) => ({
        id: `pexels_${photo.id}`,
        url: photo.src.large2x || photo.src.large,
        thumbnail: photo.src.medium,
        width: photo.width,
        height: photo.height,
        photographer: photo.photographer,
        source: 'Pexels',
        license: 'Pexels License (Free for commercial use)',
        attribution: `Photo by ${photo.photographer} on Pexels`
      }));
    } catch (error) {
      console.error('Pexels search failed:', error);
      return [];
    }
  }

  /**
   * Unsplash API - Free commercial use, attribution appreciated
   */
  private static async searchUnsplash(options: ImageSearchOptions): Promise<ImageSearchResult[]> {
    if (!this.API_KEYS.unsplash) {
      console.warn('Unsplash API key not configured');
      return [];
    }

    try {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(options.query)}&per_page=${options.perPage || 10}&orientation=${options.orientation || 'landscape'}`,
        {
          headers: {
            'Authorization': `Client-ID ${this.API_KEYS.unsplash}`
          }
        }
      );

      if (!response.ok) throw new Error(`Unsplash API error: ${response.status}`);

      const data = await response.json();
      
      return data.results.map((photo: any) => ({
        id: `unsplash_${photo.id}`,
        url: photo.urls.full,
        thumbnail: photo.urls.regular,
        width: photo.width,
        height: photo.height,
        photographer: photo.user.name,
        source: 'Unsplash',
        license: 'Unsplash License (Free for commercial use)',
        attribution: `Photo by ${photo.user.name} on Unsplash`
      }));
    } catch (error) {
      console.error('Unsplash search failed:', error);
      return [];
    }
  }

  /**
   * Pixabay API - Free commercial use, no attribution required
   */
  private static async searchPixabay(options: ImageSearchOptions): Promise<ImageSearchResult[]> {
    if (!this.API_KEYS.pixabay) {
      console.warn('Pixabay API key not configured');
      return [];
    }

    try {
      const response = await fetch(
        `https://pixabay.com/api/?key=${this.API_KEYS.pixabay}&q=${encodeURIComponent(options.query)}&per_page=${options.perPage || 10}&image_type=photo&orientation=${options.orientation || 'horizontal'}&safesearch=true`
      );

      if (!response.ok) throw new Error(`Pixabay API error: ${response.status}`);

      const data = await response.json();
      
      return data.hits.map((photo: any) => ({
        id: `pixabay_${photo.id}`,
        url: photo.largeImageURL,
        thumbnail: photo.previewURL,
        width: photo.imageWidth,
        height: photo.imageHeight,
        photographer: photo.user,
        source: 'Pixabay',
        license: 'Pixabay License (Free for commercial use)',
        attribution: `Image by ${photo.user} from Pixabay`
      }));
    } catch (error) {
      console.error('Pixabay search failed:', error);
      return [];
    }
  }

  /**
   * Wikimedia Commons - Public domain and Creative Commons
   */
  private static async searchWikimedia(options: ImageSearchOptions): Promise<ImageSearchResult[]> {
    try {
      // Search for images with free licenses
      const response = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(options.query)}&srnamespace=6&srlimit=${options.perPage || 10}&srprop=size&origin=*`
      );

      if (!response.ok) throw new Error(`Wikimedia API error: ${response.status}`);

      const data = await response.json();
      
      if (!data.query?.search) return [];

      // Get image details for each result
      const imageDetails = await Promise.all(
        data.query.search.map(async (result: any) => {
          try {
            const detailResponse = await fetch(
              `https://commons.wikimedia.org/w/api.php?action=query&format=json&titles=${encodeURIComponent(result.title)}&prop=imageinfo&iiprop=url|size|extmetadata&origin=*`
            );
            
            if (!detailResponse.ok) return null;
            
            const detailData = await detailResponse.json();
            const pages = detailData.query?.pages;
            const pageId = Object.keys(pages)[0];
            const page = pages[pageId];
            
            if (!page?.imageinfo?.[0]) return null;
            
            const imageInfo = page.imageinfo[0];
            const metadata = imageInfo.extmetadata;
            
            // Check if image has free license
            const license = metadata?.LicenseShortName?.value || metadata?.License?.value || '';
            if (!this.isFreeLicense(license)) return null;
            
            return {
              id: `wikimedia_${result.pageid}`,
              url: imageInfo.url,
              thumbnail: imageInfo.thumburl || imageInfo.url,
              width: imageInfo.width,
              height: imageInfo.height,
              photographer: metadata?.Artist?.value || 'Unknown',
              source: 'Wikimedia Commons',
              license: license,
              attribution: `Image from Wikimedia Commons, ${license}`
            };
          } catch (error) {
            console.error('Wikimedia detail fetch failed:', error);
            return null;
          }
        })
      );

      return imageDetails.filter(Boolean) as ImageSearchResult[];
    } catch (error) {
      console.error('Wikimedia search failed:', error);
      return [];
    }
  }

  /**
   * NASA Images - Public domain
   */
  private static async searchNASA(options: ImageSearchOptions): Promise<ImageSearchResult[]> {
    try {
      const response = await fetch(
        `https://images-api.nasa.gov/search?q=${encodeURIComponent(options.query)}&media_type=image&page_size=${options.perPage || 10}`
      );

      if (!response.ok) throw new Error(`NASA API error: ${response.status}`);

      const data = await response.json();
      
      return data.collection.items.map((item: any) => {
        const links = item.links || [];
        const data = item.data?.[0] || {};
        
        return {
          id: `nasa_${item.data?.[0]?.nasa_id || Math.random()}`,
          url: links.find((link: any) => link.render === 'image')?.href || links[0]?.href,
          thumbnail: links.find((link: any) => link.render === 'image')?.href || links[0]?.href,
          width: 0, // NASA doesn't provide dimensions
          height: 0,
          photographer: data.photographer || 'NASA',
          source: 'NASA',
          license: 'Public Domain',
          attribution: `Image courtesy of NASA`
        };
      });
    } catch (error) {
      console.error('NASA search failed:', error);
      return [];
    }
  }

  /**
   * Check if a license is free for commercial use
   */
  private static isFreeLicense(license: string): boolean {
    const freeLicenses = [
      'public domain',
      'cc0',
      'cc-by',
      'cc-by-sa',
      'cc-by-2.0',
      'cc-by-sa-2.0',
      'cc-by-3.0',
      'cc-by-sa-3.0',
      'cc-by-4.0',
      'cc-by-sa-4.0',
      'gfdl',
      'mit',
      'apache'
    ];

    return freeLicenses.some(freeLicense => 
      license.toLowerCase().includes(freeLicense)
    );
  }

  /**
   * Remove duplicates and rank by relevance
   */
  private static deduplicateAndRank(results: ImageSearchResult[], query: string): ImageSearchResult[] {
    // Remove duplicates based on URL
    const uniqueResults = results.filter((result, index, self) => 
      index === self.findIndex(r => r.url === result.url)
    );

    // Sort by relevance (exact matches first, then by source preference)
    const sourcePriority = {
      'Pexels': 1,
      'Unsplash': 2,
      'Pixabay': 3,
      'Wikimedia Commons': 4,
      'NASA': 5
    };

    return uniqueResults.sort((a, b) => {
      // Exact title matches first
      const aExactMatch = a.photographer?.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
      const bExactMatch = b.photographer?.toLowerCase().includes(query.toLowerCase()) ? 1 : 0;
      
      if (aExactMatch !== bExactMatch) {
        return bExactMatch - aExactMatch;
      }

      // Then by source priority
      const aPriority = sourcePriority[a.source as keyof typeof sourcePriority] || 999;
      const bPriority = sourcePriority[b.source as keyof typeof sourcePriority] || 999;
      
      return aPriority - bPriority;
    });
  }

  /**
   * Get a single best image for content
   */
  static async getBestImageForContent(
    title: string,
    content: string,
    type: string
  ): Promise<ImageSearchResult | null> {
    // Extract search terms from title and content
    const searchTerms = this.extractSearchTerms(title, content, type);
    
    for (const term of searchTerms) {
      const results = await this.searchImages({
        query: term,
        perPage: 5,
        orientation: 'landscape'
      });

      if (results.length > 0) {
        return results[0]; // Return the best match
      }
    }

    return null;
  }

  /**
   * Extract relevant search terms from content
   */
  private static extractSearchTerms(title: string, content: string, type: string): string[] {
    const terms: string[] = [];
    
    // Add title words
    const titleWords = title.split(/\s+/).filter(word => word.length > 3);
    terms.push(...titleWords.slice(0, 3));
    
    // Add type-specific terms
    const typeTerms = {
      'article': ['article', 'content', 'information'],
      'video': ['video', 'media', 'content'],
      'pdf': ['document', 'report', 'paper'],
      'post': ['social', 'post', 'content']
    };
    
    terms.push(...(typeTerms[type as keyof typeof typeTerms] || []));
    
    // Add content keywords (simple extraction)
    const contentWords = content.split(/\s+/)
      .filter(word => word.length > 4)
      .filter(word => !/^(the|and|for|are|but|not|you|all|can|had|her|was|one|our|out|day|get|has|him|his|how|its|may|new|now|old|see|two|way|who|boy|did|man|oil|sit|try)$/i.test(word))
      .slice(0, 3);
    
    terms.push(...contentWords);
    
    return [...new Set(terms)]; // Remove duplicates
  }
}
