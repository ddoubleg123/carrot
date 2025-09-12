"use client";
import React, { useEffect, useRef, useState } from "react";
import CommentItem, { Comment } from "./CommentItem";

export default function CommentsDrawer({ postId, onClose }: { postId: string; onClose: () => void }) {
  const [sort, setSort] = useState<'top' | 'newest'>('top');
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/comments?postId=${encodeURIComponent(postId)}&sort=${sort}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject(await r.text().catch(() => 'Error'))))
      .then((j) => {
        if (cancelled) return;
        const items = Array.isArray(j) ? j : (Array.isArray(j?.items) ? j.items : []);
        setComments(items);
        setNextCursor(typeof j?.nextCursor === 'string' ? j.nextCursor : undefined);
      })
      .catch((e) => { if (!cancelled) setError(String(e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [postId, sort]);

  const canPost = text.trim().length > 0 && text.trim().length <= 500;

  async function submit() {
    if (!canPost) return;
    const body = { postId, content: text.trim() };
    const r = await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (r.ok) {
      setText('');
      const created = await r.json().catch(() => null);
      if (created?.id) setComments((prev) => [created, ...prev]); else setSort((s) => s);
      scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      try { setError((await r.json())?.error || 'Failed to post comment'); } catch { setError('Failed to post comment'); }
    }
  }

  async function loadMore() {
    if (!nextCursor || loading) return;
    setLoading(true);
    setError(null);
    const r = await fetch(`/api/comments?postId=${encodeURIComponent(postId)}&sort=${sort}&cursor=${encodeURIComponent(nextCursor)}`);
    if (!r.ok) {
      setLoading(false);
      try { setError((await r.json())?.error || 'Failed to load more'); } catch { setError('Failed to load more'); }
      return;
    }
    const j = await r.json().catch(() => ({} as any));
    const items: Comment[] = Array.isArray(j?.items) ? j.items : [];
    setComments((prev) => [...prev, ...items]);
    setNextCursor(typeof j?.nextCursor === 'string' ? j.nextCursor : undefined);
    setLoading(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60]">
      <div className="absolute inset-0 -z-10" onClick={onClose} />
      <div className="mx-auto w-full max-w-[720px]">
        <div className="rounded-t-2xl border border-gray-200 shadow-xl bg-white overflow-hidden">
          <div className="px-4 pt-2 pb-3 border-b bg-white/95 backdrop-blur sticky top-0">
            <div className="mx-auto h-1 w-10 rounded-full bg-gray-300" />
            <div className="mt-2 flex items-center gap-3">
              <button className={`px-2 py-1 rounded text-sm ${sort==='top' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setSort('top')}>Top</button>
              <button className={`px-2 py-1 rounded text-sm ${sort==='newest' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`} onClick={() => setSort('newest')}>Newest</button>
              <button className="ml-auto text-sm text-gray-500" onClick={onClose} aria-label="Close">Close</button>
            </div>
          </div>

          <div ref={scrollRef} className="max-h-[50vh] overflow-auto px-4">
            {error ? (<div className="py-2 text-center text-xs text-red-600">{error}</div>) : null}
            {loading ? (
              <div className="py-6 text-center text-sm text-gray-500">Loading comments…</div>
            ) : comments.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-500">Be the first to comment</div>
            ) : (
              <div className="divide-y">
                {comments.map((c) => (
                  <CommentItem key={c.id} c={c} />
                ))}
                {nextCursor ? (
                  <div className="py-4 text-center">
                    <button className="px-3 py-2 rounded border border-gray-300 text-sm" onClick={loadMore} disabled={loading}>
                      {loading ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="p-3 border-t bg-white sticky bottom-0">
            <div className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write a comment…"
                className="flex-1 min-h-[44px] max-h-[120px] resize-y rounded-lg border border-gray-300 p-2 text-[14px]"
              />
              <button className="px-3 py-2 rounded bg-gray-900 text-white disabled:opacity-50" disabled={!canPost} onClick={submit}>Post</button>
            </div>
            <div className="text-[11px] text-gray-500 mt-1">Max 500 chars</div>
          </div>
        </div>
      </div>
    </div>
  );
}
