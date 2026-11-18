import { unlinkSync } from 'fs';
import path from 'path';
import { cache, cacheKeys } from './cache';

// Versioned so an older snapshot of placeholder counts is not served.
export const POSTS_SNAPSHOT = path.join(process.cwd(), '.cache', 'home-posts-v3.json');

export function invalidateFeedCache() {
  cache.delete(cacheKeys.posts());
  try { unlinkSync(POSTS_SNAPSHOT); } catch {}
}
