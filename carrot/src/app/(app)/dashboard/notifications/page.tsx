'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { prefetchNotifications, readNotificationCache, type NotificationItem } from '@/lib/notificationFeed';

type Item = NotificationItem;

const READ_KEY = 'carrot-notifications-read';

function loadRead(): string[] {
  try {
    const raw = localStorage.getItem(READ_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function NotificationsPage() {
  const [items, setItems] = useState<Item[]>(() => readNotificationCache() || []);
  const [loading, setLoading] = useState(() => readNotificationCache() == null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'comment' | 'like'>('all');
  const [read, setRead] = useState<string[]>([]);

  useEffect(() => {
    setRead(loadRead());
    let cancel = false;
    prefetchNotifications().then((next) => {
      if (cancel) return;
      if (next) setItems(next);
      else if ((readNotificationCache() || []).length === 0) setError('Could not load notifications');
      setLoading(false);
    });
    return () => {
      cancel = true;
    };
  }, []);

  const visible = useMemo(
    () => items.filter((item) => filter === 'all' || item.kind === filter),
    [items, filter]
  );
  const unread = items.filter((item) => !read.includes(item.id)).length;

  const markAll = () => {
    const next = items.map((item) => item.id);
    setRead(next);
    try { localStorage.setItem(READ_KEY, JSON.stringify(next)); } catch {}
  };

  const markOne = (id: string) => {
    if (read.includes(id)) return;
    const next = [...read, id];
    setRead(next);
    try { localStorage.setItem(READ_KEY, JSON.stringify(next)); } catch {}
  };

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-orange-600">Activity</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">Notifications</h1>
          <p className="mt-1 text-sm text-gray-500">
            {unread > 0 ? `${unread} new` : 'You are caught up'}
          </p>
        </div>
        {items.length > 0 && (
          <button type="button" onClick={markAll} className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-orange-200 hover:text-orange-700">
            Mark all read
          </button>
        )}
      </header>

      <div className="flex gap-2">
        {(['all', 'comment', 'like'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              filter === key ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-200'
            }`}
          >
            {key === 'all' ? 'All' : key === 'comment' ? 'Comments' : 'Likes'}
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Loading activity…</p>}

      {!loading && visible.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <p className="text-base font-medium text-gray-900">Nothing here yet</p>
          <p className="mt-1 text-sm text-gray-500">Likes and comments on your posts will show up in this list.</p>
        </div>
      )}

      <ul className="space-y-3">
        {visible.map((item) => {
          const seen = read.includes(item.id);
          const name = item.actor?.name || item.actor?.username || 'Someone';
          const photo = item.actor?.profilePhoto || item.actor?.image;
          return (
            <li key={item.id}>
              <Link
                href={`/post/${item.postId}`}
                onClick={() => markOne(item.id)}
                className={`flex gap-3 rounded-2xl border bg-white p-4 shadow-sm hover:border-orange-200 ${seen ? 'border-gray-200' : 'border-orange-200'}`}
              >
                {photo ? (
                  <img src={photo} alt="" className="h-11 w-11 rounded-full object-cover" />
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-orange-700">
                    {name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-gray-900">
                    <span className="font-semibold">{name}</span>
                    {item.kind === 'like' ? ' liked your post' : ' commented on your post'}
                  </span>
                  {item.text && <span className="mt-1 block text-sm text-gray-700">{item.text}</span>}
                  {item.post && <span className="mt-1 block truncate text-xs text-gray-500">{item.post}</span>}
                  <span className="mt-1 block text-xs text-gray-400">{new Date(item.createdAt).toLocaleString()}</span>
                </span>
                {!seen && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-orange-500" aria-label="Unread" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
