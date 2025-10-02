import React from 'react';
import FeedObserverClient from './FeedObserverClient';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function getPosts() {
  try {
    const base = process.env.NEXTAUTH_URL || 'https://carrot-app.onrender.com';
    const res = await fetch(`${base}/api/posts`, { cache: 'no-store' });
    if (!res.ok) return [];
    const posts = await res.json();
    return posts as any[];
  } catch {
    return [] as any[];
  }
}

export default async function Page() {
  const posts = await getPosts();
  return (
    <div style={{ padding: 16 }}>
      <h1>Test Feed Observer (public)</h1>
      <p>This page mounts the real preloading pipeline without login to verify offscreen prefetch.</p>
      <FeedObserverClient posts={posts} />
    </div>
  );
}
