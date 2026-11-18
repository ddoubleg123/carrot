'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Person = {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  profilePhoto: string | null;
};

type PostHit = {
  id: string;
  content: string;
  createdAt: string;
  author: Person | null;
};

type PatchHit = {
  id: string;
  handle: string;
  title: string;
  tagline: string | null;
};

type SearchResponse = {
  people: Person[];
  posts: PostHit[];
  patches: PatchHit[];
  recent?: boolean;
  error?: string;
};

function avatar(person: Person | null) {
  return person?.profilePhoto || person?.image || '';
}

function initials(person: Person | null) {
  const source = person?.name || person?.username || '?';
  return source.slice(0, 1).toUpperCase();
}

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [author, setAuthor] = useState<Person | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const handle = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (author?.username) params.set('author', author.username);
      try {
        const res = await fetch(`/api/search?${params.toString()}`, { cache: 'no-store' });
        const json = (await res.json()) as SearchResponse;
        if (!res.ok) setError(json.error || 'Search failed');
        setData(json);
      } catch {
        setError('Search failed. Try again.');
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => window.clearTimeout(handle);
  }, [q, author]);

  const people = data?.people || [];
  const posts = data?.posts || [];
  const patches = data?.patches || [];
  const showRecent = !q.trim() && !author && !!data?.recent;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm font-medium text-orange-600">Discover</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">Search</h1>
        <p className="mt-1 text-sm text-gray-500">Find people, posts, and patches.</p>
      </header>

      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
        <label className="flex items-center gap-3 px-2">
          <svg className="h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
            <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Carrot"
            className="h-12 w-full bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-400"
            aria-label="Search Carrot"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} className="rounded-full px-2 text-sm text-gray-500 hover:bg-gray-100">
              Clear
            </button>
          )}
        </label>
        {author && (
          <div className="mt-2 flex items-center gap-2 px-2">
            <span className="rounded-full bg-orange-50 px-3 py-1 text-sm text-orange-700">
              Posts by {author.name || author.username}
            </span>
            <button type="button" onClick={() => setAuthor(null)} className="text-sm text-gray-500 hover:text-gray-800">
              Remove
            </button>
          </div>
        )}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {loading && <p className="text-sm text-gray-500">Looking…</p>}

      {!loading && showRecent && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Recent patches</h2>
          <PatchList patches={patches} />
        </section>
      )}

      {!loading && !showRecent && people.length === 0 && posts.length === 0 && patches.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <p className="text-base font-medium text-gray-900">No matches</p>
          <p className="mt-1 text-sm text-gray-500">Try a name, a word from a post, or a patch title.</p>
        </div>
      )}

      {people.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">People</h2>
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            {people.map((person) => (
              <li key={person.id}>
                <button
                  type="button"
                  onClick={() => setAuthor(person)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-orange-50"
                >
                  <Avatar person={person} />
                  <span>
                    <span className="block font-medium text-gray-900">{person.name || person.username || 'Member'}</span>
                    {person.username && <span className="block text-sm text-gray-500">@{person.username}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {posts.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Posts</h2>
          <ul className="space-y-3">
            {posts.map((post) => (
              <li key={post.id}>
                <Link href={`/post/${post.id}`} className="block rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-orange-200 hover:shadow">
                  <div className="flex items-center gap-3">
                    <Avatar person={post.author} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{post.author?.name || post.author?.username || 'Member'}</p>
                      <p className="text-xs text-gray-500">{new Date(post.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-gray-800">{post.content || 'Post'}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {patches.length > 0 && !showRecent && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Patches</h2>
          <PatchList patches={patches} />
        </section>
      )}
    </div>
  );
}

function Avatar({ person }: { person: Person | null }) {
  const src = avatar(person);
  if (src) {
    return <img src={src} alt="" className="h-10 w-10 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-orange-700">
      {initials(person)}
    </span>
  );
}

function PatchList({ patches }: { patches: PatchHit[] }) {
  if (patches.length === 0) {
    return <p className="text-sm text-gray-500">No patches yet.</p>;
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {patches.map((patch) => (
        <li key={patch.id}>
          <Link href={`/patch/${patch.handle}`} className="block h-full rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-orange-200 hover:shadow">
            <p className="font-medium text-gray-900">{patch.title}</p>
            <p className="mt-1 text-sm text-gray-500">@{patch.handle}</p>
            {patch.tagline && <p className="mt-2 text-sm text-gray-600">{patch.tagline}</p>}
          </Link>
        </li>
      ))}
    </ul>
  );
}
