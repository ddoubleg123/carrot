import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function fetchPost(id: string) {
  const base = process.env.NEXTAUTH_URL || 'http://localhost:3005';
  const res = await fetch(`${base}/api/posts/${id}`, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to fetch post: ${res.status}`);
  return res.json();
}

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const post = await fetchPost(id);
  if (!post) notFound();

  const mediaUrl: string | null = post.videoUrl || post.audioUrl || null;
  const thumb: string | null = post.thumbnailUrl || null;

  // If media is a Firebase URL, proxy it via /api/img so tokens/headers are handled
  const proxiedMedia = mediaUrl ? `/api/img?url=${encodeURIComponent(mediaUrl)}` : null;
  const proxiedThumb = thumb ? `/api/img?url=${encodeURIComponent(thumb)}` : null;

  return (
    <main style={{maxWidth: 720, margin: '2rem auto', padding: '0 1rem'}}>
      <p><Link href="/home">← Back</Link></p>
      <h1 style={{fontSize: '1.25rem', marginBottom: '0.5rem'}}>Post {id}</h1>
      <section style={{marginBottom: '1rem'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          {post?.User?.image ? (
            // External avatar: add loading/decoding hints
            <img
              src={post.User.image}
              alt={post.User?.username ? `${post.User.username}'s avatar` : 'User avatar'}
              width={48}
              height={48}
              loading="lazy"
              decoding="async"
              style={{borderRadius: 24}}
            />
          ) : null}
          <div>
            <div style={{fontWeight: 600}}>{post?.User?.username || post?.User?.name || 'User'}</div>
            <div style={{fontSize: 12, color: '#666'}}>{new Date(post.createdAt).toLocaleString()}</div>
          </div>
        </div>
      </section>

      {post.content ? (
        <p style={{whiteSpace: 'pre-wrap'}}>{post.content}</p>
      ) : null}

      {proxiedMedia ? (
        <div style={{marginTop: '1rem'}}>
          {/* Prefer video if present */}
          <div style={{ width: '100%', aspectRatio: '16 / 9', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
            <video
              src={proxiedMedia}
              controls
              preload="metadata"
              poster={proxiedThumb || undefined}
              style={{width: '100%', height: '100%', objectFit: 'contain'}}
            />
          </div>
        </div>
      ) : proxiedThumb ? (
        <div style={{marginTop: '1rem'}}>
          <img src={proxiedThumb} alt={post?.content ? `${String(post.content).slice(0,60)} (thumbnail)` : 'Post thumbnail'} width={1280} height={720} loading="lazy" decoding="async" style={{maxWidth: '100%', height: 'auto', borderRadius: 8}} />
        </div>
      ) : null}

      {post.imageUrls ? (
        <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: '1rem'}}>
          {(() => {
            try {
              const arr = Array.isArray(post.imageUrls) ? post.imageUrls : JSON.parse(post.imageUrls || '[]');
              return arr.map((u: string, idx: number) => (
                <img
                  key={idx}
                  src={`/api/img?url=${encodeURIComponent(u)}`}
                  alt={post?.content ? `${String(post.content).slice(0, 40)} (image ${idx+1})` : `Post image ${idx+1}`}
                  width={640}
                  height={360}
                  loading="lazy"
                  decoding="async"
                  style={{maxWidth: '48%', height: 'auto', borderRadius: 8}}
                />
              ));
            } catch {
              return null;
            }
          })()}
        </div>
      ) : null}
    </main>
  );
}
