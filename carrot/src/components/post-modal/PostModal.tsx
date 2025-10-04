"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AudioPlayer from "../AudioPlayer";
import { createPortal } from "react-dom";
import FlagChip from "../flags/FlagChip";
import CommentsDrawer from "./CommentsDrawer";
import VideoPortalMount from "../video/VideoPortalMount";

// Resolve bucket at build time for client fallback path mode
// Use the same logic as firebase.ts to ensure .firebasestorage.app bucket names
const PUBLIC_BUCKET = (() => {
  const bucket = process.env.NEXT_PUBLIC_FIREBASE_BUCKET ||
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.FIREBASE_BUCKET ||
    '';
  
  // If bucket ends with .firebasestorage.app, keep it as-is
  if (bucket.includes('.firebasestorage.app')) {
    return bucket;
  }
  
  // If bucket ends with .appspot.com, convert to .firebasestorage.app
  if (bucket.endsWith('.appspot.com')) {
    return bucket.replace('.appspot.com', '.firebasestorage.app');
  }
  
  // If no bucket specified, construct from project ID
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (projectId) {
    return `${projectId}.firebasestorage.app`;
  }
  
  return bucket;
})();

type PostModalData = {
  id: string;
  content?: string | null;
  createdAt?: string;
  User?: {
    id: string;
    username?: string | null;
    profilePhoto?: string | null;
    profilePhotoPath?: string | null;
    country?: string | null;
  } | null;
  imageUrls?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  audioUrl?: string | null;
  captionVttUrl?: string | null;
  // Visuals
  gradientDirection?: string | null;
  gradientFromColor?: string | null;
  gradientViaColor?: string | null;
  gradientToColor?: string | null;
};

function usePost(id?: string | null) {
  const [data, setData] = useState<PostModalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/posts/${id}`, { signal: ac.signal, keepalive: false, cache: 'no-cache' })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((j) => { if (!ac.signal.aborted) setData(j); })
      .catch((e) => { if (!ac.signal.aborted) setError(String(e?.message || e)); })
      .finally(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => { ac.abort(); };
  }, [id]);
  return { data, loading, error };
}

export default function PostModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, loading } = usePost(id);
  const params = useSearchParams();
  const initialPanel = (params?.get('panel') as ('comments' | null)) || null;
  const [showComments, setShowComments] = useState(initialPanel === 'comments');
  const [mediaEl, setMediaEl] = useState<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [adopted, setAdopted] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  type Seg = { start: number; end?: number; text: string };
  const [segments, setSegments] = useState<Seg[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [segmentsError, setSegmentsError] = useState<string | null>(null);
  const [lang, setLang] = useState('en');
  const [translated, setTranslated] = useState<string | null>(null);
  const [translateLoading, setTranslateLoading] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [regenBusy, setRegenBusy] = useState(false);
  const [regenMsg, setRegenMsg] = useState<string | null>(null);
  const username = data?.User?.username ? (data.User.username.startsWith("@") ? data.User.username : `@${data.User.username}`) : "@user";
  const avatar = useMemo(() => {
    const p = data?.User;
    if (!p) return "/avatar-placeholder.svg";
    if (p.profilePhotoPath) return `/api/img?path=${encodeURIComponent(p.profilePhotoPath)}`;
    if (p.profilePhoto && /^https?:\/\//i.test(p.profilePhoto)) return `/api/img?url=${encodeURIComponent(p.profilePhoto)}`;
    return "/avatar-placeholder.svg";
  }, [data?.User]);

  // Transcript removed from modal per design; handled elsewhere if needed

  // Regenerate transcript via existing trigger endpoint, then poll post for updated caption/transcription
  // Transcript regeneration removed from modal

  // Render media body without nested ternaries (fallback when DOM-transfer is not used)
  function renderMediaFallback() {
    if (loading) return <div className="text-sm text-gray-500">Loading…</div>;
    if (data?.videoUrl) {
      const url = data.videoUrl;
      
      // If URL is already proxied through /api/video, use it directly
      if (url.startsWith('/api/video')) {
        const poster = data.thumbnailUrl ? (() => {
          if (data.thumbnailUrl.startsWith('/api/img')) return data.thumbnailUrl;
          const isAlreadyEncoded = /%25[0-9A-Fa-f]{2}/.test(data.thumbnailUrl);
          return `/api/img?url=${isAlreadyEncoded ? data.thumbnailUrl : encodeURIComponent(data.thumbnailUrl)}`;
        })() : undefined;
        return (
          <video
            controls
            playsInline
            poster={poster}
            className="w-full h-full object-contain bg-black"
            ref={(el) => setMediaEl(el)}
            onError={(e) => {
              console.error('[PostModal] Video loading error:', e);
              // Try to reload the video after a short delay
              setTimeout(() => {
                if (el) {
                  el.load();
                }
              }, 1000);
            }}
            onLoadStart={() => console.log('[PostModal] Video loading started')}
            onCanPlay={() => console.log('[PostModal] Video can play')}
          >
            <source src={url} />
          </video>
        );
      }
      
      const needsProxy = url.includes('firebasestorage.googleapis.com') || url.includes('storage.googleapis.com') || url.includes('firebasestorage.app');
      // Prefer durable path-mode when server sent bucket+path
      if ((data as any)?.videoBucket && (data as any)?.videoPath) {
        const b = String((data as any).videoBucket);
        const p = String((data as any).videoPath);
        const poster = data.thumbnailUrl ? (() => {
          if (data.thumbnailUrl.startsWith('/api/img')) return data.thumbnailUrl;
          const isAlreadyEncoded = /%25[0-9A-Fa-f]{2}/.test(data.thumbnailUrl);
          return `/api/img?url=${isAlreadyEncoded ? data.thumbnailUrl : encodeURIComponent(data.thumbnailUrl)}`;
        })() : undefined;
        return (
          <video
            controls
            playsInline
            poster={poster}
            className="w-full h-full object-contain bg-black"
            ref={(el) => setMediaEl(el)}
            onError={(e) => {
              console.error('[PostModal] Video loading error (path mode):', e);
              // Try to reload the video after a short delay
              setTimeout(() => {
                if (el) {
                  el.load();
                }
              }, 1000);
            }}
            onLoadStart={() => console.log('[PostModal] Video loading started (path mode)')}
            onCanPlay={() => console.log('[PostModal] Video can play (path mode)')}
          >
            <source src={`/api/video?path=${encodeURIComponent(p)}&bucket=${encodeURIComponent(b)}`} />
          </video>
        );
      }
      // Prefer path-mode extraction like feed player to avoid expired tokens
      let resolved = url;
      try {
        const u = new URL(url);
        const host = u.hostname;
        let bucket: string | undefined; let path: string | undefined;
        // firebasestorage.googleapis.com/v0/b/<bucket>/o/<ENCODED_PATH>
        const m1 = u.pathname.match(/\/v0\/b\/([^/]+)\/o\/(.+)$/);
        if (host === 'firebasestorage.googleapis.com' && m1) {
          bucket = decodeURIComponent(m1[1]);
          path = decodeURIComponent(m1[2]);
        }
        // storage.googleapis.com/<bucket>/<path>
        if (!path) {
          const m2 = u.pathname.match(/^\/([^/]+)\/(.+)$/);
          if (host === 'storage.googleapis.com' && m2) {
            bucket = decodeURIComponent(m2[1]);
            path = decodeURIComponent(m2[2]);
          }
        }
        // <project>.firebasestorage.app/o/<ENCODED_PATH>
        if (!path) {
          const m4 = u.pathname.match(/^\/o\/([^?]+)$/);
          if (host.endsWith('.firebasestorage.app') && m4) {
            bucket = PUBLIC_BUCKET || undefined;
            path = decodeURIComponent(m4[1]);
          }
        }
        if (path) {
          const finalBucket = (bucket || PUBLIC_BUCKET || '').trim();
          if (finalBucket) {
            resolved = `/api/video?path=${encodeURIComponent(path)}&bucket=${encodeURIComponent(finalBucket)}`;
          }
        }
        // Fallback to url-mode via proxy if we couldn't extract safely
        if (!resolved.startsWith('/api/video')) {
          let u2 = url;
          if (needsProxy && u2.includes('firebasestorage.googleapis.com') && !u2.includes('alt=media')) {
            u2 = `${u2}${u2.includes('?') ? '&' : '?'}alt=media`;
          }
          resolved = needsProxy ? `/api/video?url=${encodeURIComponent(u2)}` : url;
        }
      } catch {
        let u2 = url;
        if (needsProxy && u2.includes('firebasestorage.googleapis.com') && !u2.includes('alt=media')) {
          u2 = `${u2}${u2.includes('?') ? '&' : '?'}alt=media`;
        }
        resolved = needsProxy ? `/api/video?url=${encodeURIComponent(u2)}` : url;
      }
      // Proxy poster image to avoid CORS
      const poster = data.thumbnailUrl ? (() => {
        if (data.thumbnailUrl.startsWith('/api/img')) return data.thumbnailUrl;
        const isAlreadyEncoded = /%25[0-9A-Fa-f]{2}/.test(data.thumbnailUrl);
        return `/api/img?url=${isAlreadyEncoded ? data.thumbnailUrl : encodeURIComponent(data.thumbnailUrl)}`;
      })() : undefined;
      return (
        <video
          controls
          playsInline
          poster={poster}
          className="w-full h-full object-contain bg-black"
          ref={(el) => setMediaEl(el)}
          onError={(e) => {
            console.error('[PostModal] Video loading error (resolved):', e);
            // Try to reload the video after a short delay
            setTimeout(() => {
              if (el) {
                el.load();
              }
            }, 1000);
          }}
          onLoadStart={() => console.log('[PostModal] Video loading started (resolved)')}
          onCanPlay={() => console.log('[PostModal] Video can play (resolved)')}
        >
          <source src={resolved} />
        </video>
      );
    }
    if (data?.imageUrls) {
      let arr: string[] = [];
      try { arr = typeof data.imageUrls === 'string' ? JSON.parse(data.imageUrls) : data.imageUrls; } catch {}
      const src = arr[0];
      return src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/img?url=${encodeURIComponent(src)}`}
          alt={data?.content ? `${data.content.slice(0, 60)} (image)` : 'Post image'}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-contain"
        />
      ) : (
        <div className="flex items-center justify-center h-64 text-sm text-gray-500">
          <div className="text-center">
            <div className="text-lg mb-2">📷</div>
            <div>No media available</div>
            <div className="text-xs text-gray-400 mt-1">This post doesn't contain any media</div>
          </div>
        </div>
      );
    }
    if (data?.audioUrl) {
      return (
        <div className="w-full">
          <AudioPlayer audioUrl={data.audioUrl} allowBlob={false} onAudioRef={(el) => setMediaEl(el)} />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-500">
        <div className="text-center">
          <div className="text-lg mb-2">📷</div>
          <div>No media available</div>
          <div className="text-xs text-gray-400 mt-1">This post doesn't contain any media</div>
        </div>
      </div>
    );
  }

  // Watch for DOM-transfer adoption into the portal; if a <video> appears, hide the fallback
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const sel = `[data-video-portal-for="${id}"] video`;
    const update = () => {
      try { setAdopted(Boolean(document.querySelector(sel))); } catch {}
    };
    update();
    const onReady = (e: any) => { if (e?.detail?.postId === id) setTimeout(update, 10); };
    const onDismiss = (e: any) => { if (e?.detail?.postId === id) setTimeout(update, 10); };
    window.addEventListener('carrot-video-portal-ready', onReady as any);
    window.addEventListener('carrot-video-portal-dismiss', onDismiss as any);
    const t = setInterval(update, 300); // brief polling while modal is open
    return () => { window.removeEventListener('carrot-video-portal-ready', onReady as any); window.removeEventListener('carrot-video-portal-dismiss', onDismiss as any); clearInterval(t); };
  }, [id]);

  // Small fade-in to smooth the handoff/hydration
  useEffect(() => {
    let raf = 0;
    raf = requestAnimationFrame(() => setFadeIn(true));
    return () => { cancelAnimationFrame(raf); setFadeIn(false); };
  }, []);

  const body = (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[720px] w-full max-w-full">
        <div className="rounded-2xl shadow-xl overflow-hidden bg-white">
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b bg-white/95 backdrop-blur">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full overflow-hidden bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={avatar}
                  alt={username ? `${username}'s avatar` : 'User avatar'}
                  loading="lazy"
                  decoding="async"
                  width={36}
                  height={36}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 truncate">{username}</span>
                <FlagChip countryCode={data?.User?.country || undefined} />
                <span className="text-xs text-gray-500">• {data?.createdAt ? new Date(data.createdAt).toLocaleString() : ""}</span>
              </div>
            </div>
            <button className="px-2 py-1 rounded hover:bg-gray-100" aria-label="Close" onClick={onClose}>✕</button>
          </div>

          {/* Simple toolbar: Content and Comments */}
          <div className="px-4 pt-3">
            <div className="flex items-center gap-2 border-b">
              <span className="px-3 py-2 text-sm border-b-2 border-gray-900 text-gray-900">Content</span>
              <div className="ml-auto" />
              <button className="px-3 py-2 text-sm text-gray-500 hover:text-gray-800" onClick={() => setShowComments(true)}>Comments</button>
            </div>
          </div>

          {/* Panel bodies */}
          <div className="p-3">
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${data?.gradientFromColor || '#0f172a'}, ${data?.gradientViaColor || data?.gradientFromColor || '#1f2937'}, ${data?.gradientToColor || '#0f172a'})`
              }}
            >
              <div className="w-full transition-opacity duration-150" style={{ aspectRatio: '16 / 9', opacity: fadeIn ? 1 : 0.01 }}>
                {/* Primary: DOM transfer mount */}
                <VideoPortalMount postId={id} className="w-full h-full" />
                {/* Fallback: render a separate element only if we have not adopted the feed element */}
                {!adopted && (
                  <div className="w-full h-full flex items-center justify-center">{renderMediaFallback()}</div>
                )}
              </div>
            </div>
            {data?.content ? (
              <div className="mt-3 text-[15px] text-gray-900 whitespace-pre-wrap break-words">{data.content}</div>
            ) : null}
          </div>
          {/* Transcript/Translate removed per design */}

          {/* Footer actions (kept minimal; main actions live on cards) */}
          <div className="px-4 pb-4 text-xs text-gray-500">Tip: Use the action bar in the feed to like, share, save, or open transcript/translate directly.</div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return (
    <>
      {createPortal(body, document.body)}
      {showComments && createPortal(
        <CommentsDrawer postId={id} onClose={() => setShowComments(false)} />,
        document.body
      )}
    </>
  );
}

function formatTimeMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${ss.toString().padStart(2,'0')}`;
}

function parseVttTimestamp(ts: string): number {
  // Format: hh:mm:ss.mmm (hours optional in many files but we will support)
  const m = ts.trim().match(/(?:(\d{1,2}):)?(\d{2}):(\d{2})[\.,](\d{3})/);
  if (!m) return 0;
  const h = parseInt(m[1] || '0', 10);
  const min = parseInt(m[2] || '0', 10);
  const sec = parseInt(m[3] || '0', 10);
  const ms = parseInt(m[4] || '0', 10);
  return ((h * 3600 + min * 60 + sec) * 1000) + ms;
}

function parseWebVtt(text: string): { start: number; end?: number; text: string }[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const out: { start: number; end?: number; text: string }[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    i++;
    if (!line) continue;
    // Skip header or cue identifiers
    if (/^WEBVTT/i.test(line)) continue;
    // Timestamp line typically contains -->
    if (line.includes('-->')) {
      const [a, b] = line.split('-->').map(s => s.trim());
      const start = parseVttTimestamp(a);
      const end = b ? parseVttTimestamp(b.split(' ')[0]) : undefined;
      // Gather subsequent text lines until blank
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        buf.push(lines[i]);
        i++;
      }
      const cueText = buf.join(' ').replace(/<[^>]+>/g, '').trim();
      if (cueText) out.push({ start, end, text: cueText });
    }
  }
  return out;
}
