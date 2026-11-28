'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { PortraitCard, PortraitGrid } from '@/components/search/PortraitCard';
import { HalfPageAd, useBoardAdSlot } from '@/components/search/HalfPageAd';

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
  image?: string;
  createdAt: string;
  author: Person | null;
};

type PatchHit = {
  id: string;
  handle: string;
  title: string;
  tagline: string | null;
  image?: string;
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

export default function SearchPage() {
  const [q, setQ] = useState('');
  const [author, setAuthor] = useState<Person | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [dataKey, setDataKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    const controller = new AbortController();
    const handle = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      if (q.trim()) params.set('q', q.trim());
      if (author?.username) params.set('author', author.username);
      try {
        const res = await fetch(`/api/search?${params.toString()}`, { cache: 'no-store', signal: controller.signal });
        const json = (await res.json()) as SearchResponse;
        if (id !== requestId.current) return;
        if (!res.ok) setError(json.error || 'Search failed');
        setData(json);
        setDataKey(`${q.trim()}|${author?.username || ''}`);
      } catch (err) {
        if (controller.signal.aborted || id !== requestId.current) return;
        setError(err instanceof Error ? 'Search failed. Try again.' : 'Search failed. Try again.');
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 280);
    return () => {
      window.clearTimeout(handle);
      controller.abort();
    };
  }, [q, author]);

  const ready = dataKey === `${q.trim()}|${author?.username || ''}`;
  const people = ready ? data?.people || [] : [];
  const posts = ready ? data?.posts || [] : [];
  const patches = ready ? data?.patches || [] : [];
  const showRecent = ready && !q.trim() && !author && !!data?.recent;
  const empty = ready && !loading && !showRecent && people.length === 0 && posts.length === 0 && patches.length === 0;
  const boardKey = [
    ...people.map((person) => `person:${person.id}`),
    ...posts.map((post) => `post:${post.id}`),
    ...patches.map((patch) => `patch:${patch.id}`),
  ].join('|');
  const boardCount = people.length + posts.length + patches.length;
  const slot = useBoardAdSlot(boardKey, boardCount);

  return (
    <div className="space-y-8">
      <header className="px-1">
        <h1 className="text-[1.75rem] font-semibold tracking-[-0.03em] text-[#0B0B0F]">Search</h1>
        <p className="mt-2 text-[15px] leading-6 text-[#57534E]">People, posts on your feed, and patches.</p>
      </header>

      <div className="rounded-[18px] border border-[#E6E8EC] bg-white">
        <label className="flex items-center gap-3 px-5 py-4">
          <svg className="h-5 w-5 shrink-0 text-[#A8A29E]" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2" />
            <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Carrot"
            className="min-w-0 flex-1 bg-transparent text-[17px] leading-6 text-[#0B0B0F] outline-none placeholder:text-[#A8A29E]"
            aria-label="Search Carrot"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} className="shrink-0 rounded-full px-3 py-1.5 text-sm text-[#57534E] hover:bg-[#F6F3EE]">
              Clear
            </button>
          )}
        </label>
        {author && (
          <div className="flex items-center gap-3 border-t border-[#E6E8EC] px-5 py-3">
            <span className="rounded-full bg-[#FFF1E8] px-3 py-1 text-sm text-[#C2410C]">
              Posts by {author.name || author.username}
            </span>
            <button type="button" onClick={() => setAuthor(null)} className="text-sm text-[#57534E] hover:text-[#0B0B0F]">
              Remove
            </button>
          </div>
        )}
      </div>

      {error && <p className="rounded-[18px] bg-[#FEF2F2] px-5 py-4 text-sm leading-6 text-[#B91C1C]">{error}</p>}
      {!ready && <SearchSkeleton />}

      {ready && boardCount > 0 && (
        <PortraitGrid>
          {people.map((person, index) => (
            <Fragment key={person.id}>
              {index === slot && <HalfPageAd />}
              <PortraitCard
                image={avatar(person)}
                title={person.name || person.username || 'Member'}
                byline={person.username ? `@${person.username}` : ''}
                onClick={() => setAuthor(person)}
              />
            </Fragment>
          ))}
          {posts.map((post, index) => (
            <Fragment key={post.id}>
              {people.length + index === slot && <HalfPageAd />}
              <PortraitCard
                href={`/post/${post.id}`}
                image={post.image}
                title={post.content || 'Post'}
                byline={post.author?.name || post.author?.username || 'Member'}
                meta={new Date(post.createdAt).toLocaleDateString()}
              />
            </Fragment>
          ))}
          {patches.map((patch, index) => (
            <Fragment key={patch.id}>
              {people.length + posts.length + index === slot && <HalfPageAd />}
              <PortraitCard
                href={`/patch/${patch.handle}`}
                image={patch.image}
                title={patch.title}
                byline={`@${patch.handle}`}
                meta={patch.tagline || ''}
              />
            </Fragment>
          ))}
          {slot === boardCount && <HalfPageAd />}
        </PortraitGrid>
      )}

      {empty && (
        <p className="px-1 text-[15px] leading-6 text-[#57534E]">Nothing for “{q.trim() || 'that'}”.</p>
      )}
    </div>
  );
}

function SearchSkeleton() {
  return (
    <PortraitGrid>
      {[0, 1, 2].map((item) => <div key={item} className="aspect-[1/2] rounded-md bg-[#E7E5E4]" />)}
    </PortraitGrid>
  );
}
