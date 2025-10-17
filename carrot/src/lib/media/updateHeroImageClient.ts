/**
 * Client-side helper for updating hero images
 * Can be called from admin UI or test pages
 */

export interface UpdateHeroImageOptions {
  id: string;
  hero: string;
  source?: string;
}

/**
 * Update hero image for a discovered content item
 */
export async function updateItemWithHeroImage(options: UpdateHeroImageOptions): Promise<{ success: boolean; error?: string }> {
  const { id, hero, source = 'ai-generated' } = options;

  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
    const endpoint = `${baseUrl}/api/internal/update-hero-image`;
    
    console.log(`[updateHeroImage] Updating hero for ${id} at ${endpoint}`);
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, hero, source }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();
    console.log(`[updateHeroImage] ✅ Successfully updated hero for ${id}`);
    
    return { success: true };

  } catch (err: any) {
    console.error(`[updateHeroImage] ❌ Error updating hero:`, err);
    
    // Fallback: save locally if server fails
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        console.warn(`[updateHeroImage] Fallback: saving to localStorage for ${id}`);
        localStorage.setItem(`hero-${id}`, hero);
        return { success: true, error: 'Saved locally (offline)' };
      } catch (localErr) {
        console.error('[updateHeroImage] localStorage fallback failed:', localErr);
      }
    }
    
    return { 
      success: false, 
      error: err.message || 'Failed to update hero image' 
    };
  }
}

/**
 * Get hero image from localStorage (fallback when offline)
 */
export function getLocalHeroImage(id: string): string | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }
  
  try {
    return localStorage.getItem(`hero-${id}`);
  } catch {
    return null;
  }
}

/**
 * Clear local hero image cache
 */
export function clearLocalHeroCache(id?: string): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  
  try {
    if (id) {
      localStorage.removeItem(`hero-${id}`);
    } else {
      // Clear all hero images
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('hero-')) {
          localStorage.removeItem(key);
        }
      });
    }
  } catch (error) {
    console.error('[clearLocalHeroCache] Error:', error);
  }
}

