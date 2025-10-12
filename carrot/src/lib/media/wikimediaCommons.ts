/**
 * Wikimedia Commons API integration for finding relevant images
 * Based on: https://commons.wikimedia.org/wiki/Commons:API
 */

interface WikimediaSearchResult {
  pageid: number;
  ns: number;
  title: string;
  url: string;
  descriptionurl: string;
  descriptionshorturl: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  original?: {
    source: string;
    width: number;
    height: number;
  };
}

interface WikimediaSearchResponse {
  query: {
    pages: Record<string, WikimediaSearchResult>;
  };
}

export async function searchWikimediaCommons(query: string, limit: number = 5): Promise<WikimediaSearchResult[]> {
  try {
    console.log('[Wikimedia] Searching for:', query);
    
    // Search Wikimedia Commons using their API
    const searchUrl = new URL('https://commons.wikimedia.org/w/api.php');
    searchUrl.searchParams.set('action', 'query');
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('generator', 'search');
    searchUrl.searchParams.set('gsrsearch', query);
    searchUrl.searchParams.set('gsrlimit', limit.toString());
    searchUrl.searchParams.set('gsrnamespace', '6'); // File namespace
    searchUrl.searchParams.set('prop', 'imageinfo');
    searchUrl.searchParams.set('iiprop', 'url|size|mime');
    searchUrl.searchParams.set('iiurlwidth', '1280');
    searchUrl.searchParams.set('iiurlheight', '720');
    
    const response = await fetch(searchUrl.toString());
    
    if (!response.ok) {
      throw new Error(`Wikimedia API error: ${response.status}`);
    }
    
    const data: WikimediaSearchResponse = await response.json();
    
    if (!data.query || !data.query.pages) {
      console.warn('[Wikimedia] No results found');
      return [];
    }
    
    const results = Object.values(data.query.pages).filter(page => 
      page.original && 
      page.original.source &&
      page.original.width >= 800 && // Minimum quality
      page.original.height >= 600
    );
    
    console.log(`[Wikimedia] Found ${results.length} relevant images`);
    return results;
    
  } catch (error) {
    console.error('[Wikimedia] Search failed:', error);
    return [];
  }
}

export function generateWikimediaQuery(title: string, summary: string): string {
  const content = `${title} ${summary}`.toLowerCase();
  
  // Extract key terms for search
  const keyTerms: string[] = [];
  
  // Basketball specific
  if (content.includes('derrick rose') || content.includes('bulls') || content.includes('basketball')) {
    keyTerms.push('Derrick Rose', 'Chicago Bulls', 'basketball', 'NBA', 'United Center');
  }
  
  // Sports specific
  if (content.includes('sports') || content.includes('athletic') || content.includes('team')) {
    keyTerms.push('sports', 'athletics', 'team', 'stadium');
  }
  
  // Politics specific
  if (content.includes('politics') || content.includes('government') || content.includes('congress')) {
    keyTerms.push('politics', 'government', 'Capitol Hill', 'Washington DC');
  }
  
  // Technology specific
  if (content.includes('technology') || content.includes('tech') || content.includes('software')) {
    keyTerms.push('technology', 'computer', 'software', 'digital');
  }
  
  // News specific
  if (content.includes('news') || content.includes('journalism') || content.includes('report')) {
    keyTerms.push('news', 'journalism', 'newspaper', 'media');
  }
  
  // Fallback: extract meaningful words
  if (keyTerms.length === 0) {
    const words = content.split(/\s+/).filter(word => 
      word.length > 4 && 
      !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'were', 'will', 'said', 'could', 'would', 'comprehensive', 'look', 'including', 'about'].includes(word)
    );
    keyTerms.push(...words.slice(0, 3));
  }
  
  return keyTerms.join(' ');
}

export async function findBestWikimediaImage(title: string, summary: string): Promise<string | null> {
  const query = generateWikimediaQuery(title, summary);
  const results = await searchWikimediaCommons(query, 10);
  
  if (results.length === 0) {
    return null;
  }
  
  // Find the best image based on quality and relevance
  const bestImage = results.find(result => 
    result.original &&
    result.original.width >= 1280 &&
    result.original.height >= 720
  ) || results[0];
  
  return bestImage?.original?.source || null;
}
