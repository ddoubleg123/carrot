// Simple local gallery persistence backed by localStorage
// Stores recent media items for reuse in the Composer's Media Gallery tab

export type GalleryItem = {
  id: string; // unique id
  type: 'image' | 'video' | 'gif' | 'audio';
  url: string; // public URL (Firebase, worker, etc.)
  thumbUrl?: string | null; // optional thumbnail URL or data URL
  createdAt: number; // epoch ms
  // v2 fields (optional for backward compatibility)
  title?: string; // user-facing title (rename)
  labels?: string[]; // simple freeform labels
  hidden?: boolean; // hidden from default view
};

const STORAGE_KEY = 'carrot-gallery-v1';
const MAX_ITEMS = 60;

function readAll(): GalleryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    // Basic validation
    return arr
      .filter((x) => x && typeof x.id === 'string' && typeof x.url === 'string')
      .map((x) => ({
        id: x.id,
        type: x.type,
        url: x.url,
        thumbUrl: x.thumbUrl ?? null,
        createdAt: x.createdAt ?? Date.now(),
        title: typeof x.title === 'string' ? x.title : '',
        labels: Array.isArray(x.labels) ? x.labels.filter((l: any) => typeof l === 'string') : [],
        hidden: Boolean(x.hidden),
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function writeAll(items: GalleryItem[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
    try { window.dispatchEvent(new CustomEvent('carrot-gallery-changed')); } catch {}
  } catch {}
}

export function listGallery(): GalleryItem[] {
  return readAll();
}

export function addToGallery(item: Omit<GalleryItem, 'id' | 'createdAt'> & { id?: string; createdAt?: number }) {
  const now = Date.now();
  const id = item.id || `${item.type}-${now}-${Math.random().toString(36).slice(2, 8)}`;
  const next: GalleryItem = {
    id,
    createdAt: item.createdAt || now,
    type: item.type,
    url: item.url,
    thumbUrl: item.thumbUrl ?? null,
    title: item.title || '',
    labels: Array.isArray(item.labels) ? item.labels.slice(0, 20) : [],
    hidden: Boolean(item.hidden),
  };
  const cur = readAll();
  // De-dup by URL
  const filtered = cur.filter((x) => x.url !== next.url);
  writeAll([next, ...filtered].sort((a, b) => b.createdAt - a.createdAt));
  return next;
}

export function removeFromGallery(id: string) {
  const cur = readAll();
  writeAll(cur.filter((x) => x.id !== id));
}

export function clearGallery() {
  writeAll([]);
}

// Lightweight React hook to observe changes
export function useGallery(): GalleryItem[] {
  const [items, setItems] = (require('react') as typeof import('react')).useState<GalleryItem[]>(() => readAll());
  (require('react') as typeof import('react')).useEffect(() => {
    const onChange = () => setItems(readAll());
    try { window.addEventListener('storage', onChange); } catch {}
    try { window.addEventListener('carrot-gallery-changed', onChange as any); } catch {}
    return () => {
      try { window.removeEventListener('storage', onChange); } catch {}
      try { window.removeEventListener('carrot-gallery-changed', onChange as any); } catch {}
    };
  }, []);
  return items;
}

// Mutations
export function updateItem(id: string, patch: Partial<GalleryItem>) {
  const cur = readAll();
  const idx = cur.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  const next = { ...cur[idx], ...patch } as GalleryItem;
  cur[idx] = next;
  writeAll(cur);
  return next;
}

export function renameItem(id: string, title: string) {
  return updateItem(id, { title: title || '' });
}

export function setLabels(id: string, labels: string[]) {
  const cleaned = Array.from(new Set(labels.map((l) => l.trim()).filter(Boolean))).slice(0, 20);
  return updateItem(id, { labels: cleaned });
}

export function hideItem(id: string, hidden: boolean) {
  return updateItem(id, { hidden: Boolean(hidden) });
}

// Search: basic text across title/url/labels; supports #tag for label filter
export function searchGallery(query: string, opts?: { includeHidden?: boolean; type?: GalleryItem['type'] | 'any' }) {
  const q = (query || '').trim().toLowerCase();
  const wantType = opts?.type && opts.type !== 'any' ? opts.type : undefined;
  const includeHidden = Boolean(opts?.includeHidden);
  let labelFilter: string | null = null;
  // simple: if query contains #tag, treat as label filter and remove from text
  const m = q.match(/#(\w[\w-]*)/);
  if (m) {
    labelFilter = m[1];
  }
  const text = q.replace(/#(\w[\w-]*)/g, '').trim();

  return readAll().filter((it) => {
    if (!includeHidden && it.hidden) return false;
    if (wantType && it.type !== wantType) return false;
    if (labelFilter && !(it.labels || []).some((l) => l.toLowerCase() === labelFilter)) return false;
    if (!text) return true;
    const hay = `${it.title || ''} ${it.url} ${(it.labels || []).join(' ')}`.toLowerCase();
    return hay.includes(text);
  });
}
