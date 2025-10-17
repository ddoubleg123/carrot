/**
 * Wikimedia Commons API integration for finding relevant images
 * Based on: https://commons.wikimedia.org/wiki/Commons:API
 */

interface ImageInfo {
  size: number;
  width: number;
  height: number;
  thumburl?: string;
  url: string;
  descriptionurl: string;
  descriptionshorturl: string;
}

interface WikimediaSearchResult {
  pageid: number;
  ns: number;
  title: string;
  index: number;
  imagerepository: string;
  imageinfo: ImageInfo[];
}

interface WikimediaSearchResponse {
  query: {
    pages: Record<string, WikimediaSearchResult>;
  };
}

export async function searchWikimediaCommons(query: string, limit: number = 5): Promise<WikimediaSearchResult[]> {
  try {
    console.log('[Wikimedia] Searching for:', query);
    
    // Clean up the query - remove special characters that might break the search
    const cleanQuery = query.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Search Wikimedia Commons using their API
    const searchUrl = new URL('https://commons.wikimedia.org/w/api.php');
    searchUrl.searchParams.set('action', 'query');
    searchUrl.searchParams.set('format', 'json');
    searchUrl.searchParams.set('generator', 'search');
    searchUrl.searchParams.set('gsrsearch', cleanQuery);
    searchUrl.searchParams.set('gsrlimit', limit.toString());
    searchUrl.searchParams.set('gsrnamespace', '6'); // File namespace
    searchUrl.searchParams.set('prop', 'imageinfo');
    searchUrl.searchParams.set('iiprop', 'url|size|mime|extmetadata');
    searchUrl.searchParams.set('iiurlwidth', '1280');
    searchUrl.searchParams.set('iiurlheight', '720');
    
    console.log('[Wikimedia] API URL:', searchUrl.toString());
    
    const response = await fetch(searchUrl.toString(), {
      headers: {
        'User-Agent': 'CarrotApp/1.0 (https://carrot-app.onrender.com)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Wikimedia API error: ${response.status} ${response.statusText}`);
    }
    
    const data: WikimediaSearchResponse = await response.json();
    console.log('[Wikimedia] API Response:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
    
    if (!data.query || !data.query.pages) {
      console.warn('[Wikimedia] No results found in API response');
      return [];
    }
    
    const results = Object.values(data.query.pages).filter(page => {
      if (!page.imageinfo || page.imageinfo.length === 0) {
        console.log('[Wikimedia] Skipping page without imageinfo:', page.title);
        return false;
      }
      
      const imageInfo = page.imageinfo[0];
      if (!imageInfo.url) {
        console.log('[Wikimedia] Skipping page without image URL:', page.title);
        return false;
      }
      
      // Check if it's actually an image file (not PDF, SVG, etc.)
      const fileName = page.title.toLowerCase();
      const isImageFile = fileName.match(/\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/);
      
      if (!isImageFile) {
        console.log('[Wikimedia] Skipping non-image file:', page.title);
        return false;
      }
      
      // Check if it's a reasonable image size
      const width = imageInfo.width || 0;
      const height = imageInfo.height || 0;
      
      if (width < 400 || height < 300) {
        console.log('[Wikimedia] Skipping small image:', page.title, `${width}x${height}`);
        return false;
      }
      
      console.log('[Wikimedia] ✅ Valid image found:', page.title, `${width}x${height}`, imageInfo.url.substring(0, 50) + '...');
      return true;
    });
    
    console.log(`[Wikimedia] Found ${results.length} relevant images out of ${Object.keys(data.query.pages).length} total`);
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
  
  // Basketball specific - prioritize player names and specific terms
  if (content.includes('derrick rose') || content.includes('bulls') || content.includes('basketball')) {
    // Try very specific searches first
    if (content.includes('derrick rose')) {
      keyTerms.push('Derrick Rose Chicago Bulls', 'Derrick Rose NBA', 'Derrick Rose basketball', 'Rose Bulls jersey');
    } else {
      keyTerms.push('Chicago Bulls', 'Bulls basketball', 'NBA Bulls', 'United Center');
    }
  }
  
  // Sports specific
  if (content.includes('sports') || content.includes('athletic') || content.includes('team')) {
    keyTerms.push('sports', 'athletics', 'team', 'stadium');
  }
  
  // Politics specific - prioritize person photos
  if (content.includes('politics') || content.includes('government') || content.includes('congress')) {
    // Check for specific political figures
    if (content.includes('netanyahu') || content.includes('bibi')) {
      keyTerms.push('Benjamin Netanyahu', 'Netanyahu portrait', 'Netanyahu photo', 'Israeli Prime Minister Netanyahu', 'Benjamin Netanyahu official photo');
    } else if (content.includes('trump')) {
      keyTerms.push('Donald Trump', 'Trump portrait', 'Trump photo', 'President Trump');
    } else if (content.includes('biden')) {
      keyTerms.push('Joe Biden', 'Biden portrait', 'Biden photo', 'President Biden');
    } else {
      keyTerms.push('politics', 'government', 'Capitol Hill', 'Washington DC');
    }
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
  console.log('[Wikimedia] Starting image search for:', { title: title.substring(0, 50), summary: summary.substring(0, 100) });
  
  // Try multiple search strategies - prioritize specific person searches
  const searchQueries = [
    generateWikimediaQuery(title, summary),
    // Political figures specific searches
    ...(title.toLowerCase().includes('netanyahu') || title.toLowerCase().includes('bibi') ? [
      'Benjamin Netanyahu',
      'Netanyahu portrait',
      'Netanyahu photo',
      'Israeli Prime Minister Netanyahu',
      'Netanyahu official photo',
      'Benjamin Netanyahu official',
      'Netanyahu headshot',
      'Netanyahu speaking',
      'Netanyahu press conference',
      'Prime Minister Netanyahu',
      'Benjamin Netanyahu 2023',
      'Benjamin Netanyahu 2024'
    ] : []),
    ...(title.toLowerCase().includes('trump') ? [
      'Donald Trump',
      'Trump portrait', 
      'Trump photo',
      'President Trump'
    ] : []),
    ...(title.toLowerCase().includes('biden') ? [
      'Joe Biden',
      'Biden portrait',
      'Biden photo', 
      'President Biden'
    ] : []),
    // Derrick Rose specific searches
    ...(title.toLowerCase().includes('derrick rose') || title.toLowerCase().includes('rose') ? [
      'Derrick Rose Chicago Bulls',
      'Derrick Rose NBA',
      'Derrick Rose basketball',
      'Rose Bulls jersey',
      'Chicago Bulls basketball',
      'Bulls NBA championship',
      'United Center basketball'
    ] : []),
    // Generic fallbacks
    'basketball NBA',
    'NBA basketball court',
    'basketball sports',
    'sports athletics',
    'politics government',
    'political leader'
  ];
  
  for (const query of searchQueries) {
    console.log('[Wikimedia] Trying query:', query);
    const results = await searchWikimediaCommons(query, 5);
    
    if (results.length > 0) {
      console.log(`[Wikimedia] Found ${results.length} results for query: ${query}`);
      
              // Find the best image based on quality and relevance
              // Prioritize person photos over maps, charts, and other content
              const bestImage = results.find(result => {
                const imageInfo = result.imageinfo[0];
                const fileName = result.title.toLowerCase();
                
                // Reject maps, charts, graffiti, and non-person content
                const isMapOrChart = fileName.includes('map') || fileName.includes('chart') || 
                                   fileName.includes('graph') || fileName.includes('diagram') ||
                                   fileName.includes('arrest') || fileName.includes('warrant') ||
                                   fileName.includes('graffiti') || fileName.includes('lampost') ||
                                   fileName.includes('lamp') || fileName.includes('post') ||
                                   fileName.includes('protest') || fileName.includes('demonstration');
                
                if (isMapOrChart) return false;
                
                // Prefer person photos (portraits, official photos, etc.)
                const isPersonPhoto = fileName.includes('portrait') || fileName.includes('photo') || 
                                    fileName.includes('official') || fileName.includes('headshot') ||
                                    fileName.includes('player') || fileName.includes('rose') || 
                                    fileName.includes('bulls') || fileName.includes('netanyahu') ||
                                    fileName.includes('trump') || fileName.includes('biden') ||
                                    fileName.includes('championship') || fileName.includes('game') || 
                                    fileName.includes('action') || fileName.includes('speaking') ||
                                    fileName.includes('press') || fileName.includes('interview');
                
                const isGoodSize = imageInfo.width >= 800 && imageInfo.height >= 600;
                
                return isPersonPhoto && isGoodSize;
              }) || results.find(result => {
                const imageInfo = result.imageinfo[0];
                const fileName = result.title.toLowerCase();
                
                // Skip maps/charts even in fallback
                const isMapOrChart = fileName.includes('map') || fileName.includes('chart') || 
                                   fileName.includes('graph') || fileName.includes('diagram');
                
                if (isMapOrChart) return false;
                
                return imageInfo.width >= 800 && imageInfo.height >= 600;
              }) || results[0];
      
      if (bestImage?.imageinfo?.[0]?.url) {
        const imageUrl = bestImage.imageinfo[0].url;
        console.log('[Wikimedia] ✅ Selected image:', imageUrl.substring(0, 50) + '...');
        return imageUrl;
      }
    }
  }
  
  console.log('[Wikimedia] No suitable images found after trying all queries');
  return null;
}
