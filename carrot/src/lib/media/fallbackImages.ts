/**
 * Fallback Image System
 * Handles fallback images when AI generation fails
 */

/**
 * Generate a simple SVG placeholder
 */
export function generateSVGPlaceholder(
  title: string, 
  width: number = 1280, 
  height: number = 720
): string {
  const colors = [
    "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", 
    "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1"
  ];
  
  const color = colors[title.length % colors.length];
  const initials = title.split(' ').map(word => word[0]).join('').toUpperCase().slice(0, 2);
  
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${color}"/>
      <text x="50%" y="50%" text-anchor="middle" dy="0.35em" 
            font-family="Arial, sans-serif" font-size="72" font-weight="bold" 
            fill="white">${initials}</text>
    </svg>
  `)}`;
}

/**
 * Fetch Wikimedia Commons fallback image
 */
export async function fetchWikimediaFallback(query: string): Promise<string | null> {
  try {
    const response = await fetch(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=1&iiprop=url`
    );
    const data = await response.json();
    const pages = data?.query?.pages;
    const first = pages ? Object.values(pages)[0] : null;
    return (first as any)?.imageinfo?.[0]?.url || null;
  } catch (error) {
    console.warn("[fetchWikimediaFallback] Error:", error);
    return null;
  }
}

/**
 * Get Open Graph image from URL
 */
export async function fetchOpenGraphImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    const html = await response.text();
    const ogMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
    return ogMatch ? ogMatch[1] : null;
  } catch (error) {
    console.warn("[fetchOpenGraphImage] Error:", error);
    return null;
  }
}
