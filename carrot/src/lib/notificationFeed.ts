export type NotificationItem = {
  id: string;
  kind: 'comment' | 'like';
  createdAt: string;
  postId: string;
  actor: {
    name: string | null;
    username: string | null;
    image: string | null;
    profilePhoto: string | null;
  };
  text: string;
  post: string;
};

const CACHE_KEY = 'carrot-notifications-v1';
const FRESH_MS = 20_000;

type CacheRow = { at: number; items: NotificationItem[] };

function readRow(): CacheRow | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheRow;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readNotificationCache(): NotificationItem[] | null {
  return readRow()?.items ?? null;
}

function writeNotificationCache(items: NotificationItem[]) {
  try {
    const row: CacheRow = { at: Date.now(), items };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(row));
  } catch {}
}

let inflight: Promise<NotificationItem[] | null> | null = null;

export function prefetchNotifications(): Promise<NotificationItem[] | null> {
  const row = readRow();
  if (row && Date.now() - row.at < FRESH_MS) return Promise.resolve(row.items);
  if (inflight) return inflight;
  inflight = fetch('/api/notifications', { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) return row?.items ?? null;
      const json = await res.json();
      const items = Array.isArray(json.items) ? json.items as NotificationItem[] : [];
      writeNotificationCache(items);
      return items;
    })
    .catch(() => row?.items ?? null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
