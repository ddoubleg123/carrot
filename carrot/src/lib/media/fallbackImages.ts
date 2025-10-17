/**
 * Fallback image sources when AI generation fails
 * Tries multiple sources in priority order
 */

import { DISCOVERY_CONFIG } from '@/config/discovery';

export interface FallbackImageResult {
  success: boolean;
  imageUrl?: string;
  source?: 'wikimedia' | 'og-image' | 'placeholder';
  error?: string;
}

/**
 * Try to get a fallback image for content
 */
export async function tryFallbackImage(item: {
  title: string;
  content?: string;
  sourceUrl?: string;
}): Promise<FallbackImageResult> {
  
  if (!DISCOVERY_CONFIG.FEATURES.ENABLE_FALLBACKS) {
    return { success: false, error: 'Fallbacks disabled' };
  }
  
  // Try each fallback source in order
  for (const source of DISCOVERY_CONFIG.FALLBACK_SOURCES) {
    try {
      switch (source) {
        case 'wikimedia':
          const wikimediaResult = await tryWikimediaImage(item.title);
          if (wikimediaResult.success) return wikimediaResult;
          break;
          
        case 'og-image':
          if (item.sourceUrl) {
            const ogResult = await tryOpenGraphImage(item.sourceUrl);
            if (ogResult.success) return ogResult;
          }
          break;
          
        case 'placeholder':
          return createPlaceholderImage(item.title);
      }
    } catch (error) {
      console.log(`[FallbackImage] ${source} failed:`, error);
      continue;
    }
  }
  
  return { success: false, error: 'All fallback sources failed' };
}

/**
 * Try to find an image on Wikimedia Commons
 */
async function tryWikimediaImage(title: string): Promise<FallbackImageResult> {
  try {
    // Extract key terms from title for search
    const searchTerms = extractSearchTerms(title);
    
    // Search Wikimedia Commons API
    const response = await fetch(
      `https://commons.wikimedia.org/w/api.php?` +
      `action=query&format=json&list=search&srsearch=${encodeURIComponent(searchTerms)}&srnamespace=6&srlimit=1`
    );
    
    const data = await response.json();
    
    if (data.query?.search?.[0]) {
      const imageTitle = data.query.search[0].title;
      
      // Get image URL
      const imageResponse = await fetch(
        `https://commons.wikimedia.org/w/api.php?` +
        `action=query&format=json&titles=${encodeURIComponent(imageTitle)}&prop=imageinfo&iiprop=url`
      );
      
      const imageData = await imageResponse.json();
      const pages = imageData.query?.pages;
      const page = pages ? Object.values(pages)[0] as any : null;
      
      if (page?.imageinfo?.[0]?.url) {
        return {
          success: true,
          imageUrl: page.imageinfo[0].url,
          source: 'wikimedia'
        };
      }
    }
    
    return { success: false, error: 'No Wikimedia image found' };
    
  } catch (error) {
    return { success: false, error: `Wikimedia error: ${error.message}` };
  }
}

/**
 * Try to extract Open Graph image from source URL
 */
async function tryOpenGraphImage(sourceUrl: string): Promise<FallbackImageResult> {
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CarrotBot/1.0)'
      }
    });
    
    const html = await response.text();
    
    // Extract og:image meta tag
    const ogImageMatch = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i);
    
    if (ogImageMatch && ogImageMatch[1]) {
      const imageUrl = ogImageMatch[1];
      
      // Validate it's a real image URL
      if (imageUrl.startsWith('http') && /\.(jpg|jpeg|png|webp|gif)$/i.test(imageUrl)) {
        return {
          success: true,
          imageUrl,
          source: 'og-image'
        };
      }
    }
    
    return { success: false, error: 'No Open Graph image found' };
    
  } catch (error) {
    return { success: false, error: `OG image error: ${error.message}` };
  }
}

/**
 * Create a placeholder SVG image
 */
function createPlaceholderImage(title: string): FallbackImageResult {
  const svg = `
    <svg width="1280" height="720" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#FF6A00;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#FF8C3A;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)"/>
      <g transform="translate(640,360)">
        <text x="0" y="-20" text-anchor="middle" fill="white" 
              font-family="Arial, sans-serif" font-size="36" font-weight="bold">
          ${escapeXml(title.substring(0, 60))}
        </text>
        <text x="0" y="20" text-anchor="middle" fill="white" 
              font-family="Arial, sans-serif" font-size="20" opacity="0.8">
          Carrot Patch
        </text>
      </g>
    </svg>
  `;
  
  const base64 = Buffer.from(svg).toString('base64');
  return {
    success: true,
    imageUrl: `data:image/svg+xml;base64,${base64}`,
    source: 'placeholder'
  };
}

/**
 * Extract search terms from title for Wikimedia search
 */
function extractSearchTerms(title: string): string {
  // Remove common words and keep important terms
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];
  const words = title.toLowerCase().split(/\s+/);
  const filtered = words.filter(word => !stopWords.includes(word) && word.length > 2);
  return filtered.slice(0, 3).join(' ');
}

/**
 * Escape XML special characters for SVG
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

