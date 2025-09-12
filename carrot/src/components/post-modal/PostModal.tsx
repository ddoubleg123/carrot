"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import AudioPlayer from "../AudioPlayer";
import { createPortal } from "react-dom";
import FlagChip from "../flags/FlagChip";
import CommentsDrawer from "./CommentsDrawer";

type PostModalData = {
  id: string;
  content?: string | null;
  createdAt?: string;
  User?: {
    id: string;
    username?: string | null;
    profilePhoto?: string | null;
    profilePhotoPath?: string | null;
    homeCountry?: string | null;
  } | null;
  imageUrls?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  audioUrl?: string | null;
  captionVttUrl?: string | null;
};

function usePost(id?: string | null) {
  const [data, setData] = useState<PostModalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/posts/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((j) => { if (!cancelled) setData(j); })
      .catch((e) => { if (!cancelled) setError(String(e?.message || e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);
  return { data, loading, error };
}

export default function PostModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, loading } = usePost(id);
  const params = useSearchParams();
  const initialPanel = (params?.get('panel') as ('transcript' | 'translate' | 'comments' | null)) || null;
  const [showComments, setShowComments] = useState(initialPanel === 'comments');
  const [panel, setPanel] = useState<"media" | "transcript" | "translate">(initialPanel === 'transcript' ? 'transcript' : initialPanel === 'translate' ? 'translate' : 'media');
  const [mediaEl, setMediaEl] = useState<HTMLVideoElement | HTMLAudioElement | null>(null);
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

  // Load transcript segments from VTT if available
  useEffect(() => {
    async function loadVtt(url: string) {
      setSegmentsLoading(true);
      setSegmentsError(null);
      try {
        const resp = await fetch(url, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`VTT fetch failed: ${resp.status}`);
        const text = await resp.text();
        const segs = parseWebVtt(text);
        setSegments(segs);
      } catch (e: any) {
        setSegmentsError(String(e?.message || e));
        setSegments([]);
      } finally {
        setSegmentsLoading(false);
      }
    }
    if (data?.captionVttUrl) {
      loadVtt(data.captionVttUrl);
    } else {
      setSegments([]);
      setSegmentsLoading(false);
      setSegmentsError(null);
    }
  }, [data?.captionVttUrl]);

  // Regenerate transcript via existing trigger endpoint, then poll post for updated caption/transcription
  async function regenerateTranscript() {
    if (!data?.id || !data?.audioUrl) return;
    setRegenBusy(true);
    setRegenMsg('Regenerating transcript…');
    try {
      const resp = await fetch('/api/audio/trigger-transcription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: data.id, audioUrl: data.audioUrl })
      });
      if (!resp.ok) throw new Error(`Trigger failed: ${resp.status}`);
      // Poll the post endpoint for updated status/captions for up to ~30s
      const deadline = Date.now() + 30000;
      let lastStatus = 'processing';
      while (Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 1500));
        const pr = await fetch(`/api/posts/${data.id}`, { cache: 'no-store' });
        if (!pr.ok) continue;
        const pj = await pr.json();
        lastStatus = pj?.transcriptionStatus || lastStatus;
        if (pj?.captionVttUrl) {
          setRegenMsg('Transcript ready. Loading…');
          // Trigger VTT reload
          try {
            const text = await (await fetch(pj.captionVttUrl, { cache: 'no-store' })).text();
            setSegments(parseWebVtt(text));
          } catch {}
          break;
        }
        if (lastStatus === 'completed' || lastStatus === 'failed') {
          // Even if no VTT, stop polling
          break;
        }
      }
    } catch (e: any) {
      setRegenMsg(`Failed to regenerate: ${String(e?.message || e)}`);
    } finally {
      setTimeout(() => setRegenMsg(null), 3000);
      setRegenBusy(false);
    }
  }

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
                <img src={avatar} alt="avatar" className="h-full w-full object-cover" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 truncate">{username}</span>
                <FlagChip countryCode={data?.User?.homeCountry || undefined} />
                <span className="text-xs text-gray-500">• {data?.createdAt ? new Date(data.createdAt).toLocaleString() : ""}</span>
              </div>
            </div>
            <button className="px-2 py-1 rounded hover:bg-gray-100" aria-label="Close" onClick={onClose}>✕</button>
          </div>

          {/* Tabs */}
          <div className="px-4 pt-3">
            <div className="flex items-center gap-2 border-b">
              {([
                { k: 'media', label: 'Content' },
                { k: 'transcript', label: 'Transcript' },
                { k: 'translate', label: 'Translate' },
              ] as const).map(t => (
                <button
                  key={t.k}
                  className={["px-3 py-2 text-sm", panel === t.k ? "border-b-2 border-gray-900 text-gray-900" : "text-gray-500 hover:text-gray-800"].join(' ')}
                  onClick={() => setPanel(t.k)}
                >{t.label}</button>
              ))}
              <div className="ml-auto" />
              <button className="px-3 py-2 text-sm text-gray-500 hover:text-gray-800" onClick={() => setShowComments(true)}>Comments</button>
            </div>
          </div>

          {/* Panel bodies */}
          {panel === 'media' && (
            <div className="p-3">
              <div className="rounded-xl overflow-hidden" style={{ background: "linear-gradient(135deg,#F97316,#3B82F6)" }}>
                <div className="w-full h-[360px] flex items-center justify-center">
                  {loading ? (
                    <div className="text-sm text-gray-500">Loading…</div>
                  ) : data?.videoUrl ? (
                    <video
                      controls
                      playsInline
                      poster={data.thumbnailUrl || undefined}
                      className="w-full h-full object-contain bg-black"
                      ref={(el) => setMediaEl(el)}
                    >
                      <source src={data.videoUrl} />
                    </video>
                  ) : (data?.imageUrls ? (
                    (() => {
                      let arr: string[] = [];
                      try { arr = typeof data.imageUrls === 'string' ? JSON.parse(data.imageUrls) : data.imageUrls; } catch {}
                      const src = arr[0];
                      return src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt="media" className="w-full h-full object-contain" />
                      ) : (
                        <div className="text-sm text-gray-500">No media</div>
                      );
                    })()
                  ) : (data?.audioUrl ? (
                    <div className="w-full">
                      <AudioPlayer audioUrl={data.audioUrl} allowBlob={false} onAudioRef={(el) => setMediaEl(el)} />
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">No media</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {panel === 'transcript' && (
            <div className="p-4">
              <div className="rounded-lg border bg-white">
                <div className="p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <button
                      className="px-2 py-1 rounded border text-xs disabled:opacity-50"
                      onClick={regenerateTranscript}
                      disabled={regenBusy || !data?.audioUrl}
                      title={data?.audioUrl ? 'Regenerate transcript using Vosk service' : 'No audio available'}
                    >{regenBusy ? 'Regenerating…' : 'Regenerate transcript'}</button>
                    {regenMsg ? <span className="text-xs text-gray-500">{regenMsg}</span> : null}
                  </div>
                  {!data?.captionVttUrl ? (
                    <div className="text-sm text-gray-600">No transcript available for this post.</div>
                  ) : segmentsLoading ? (
                    <div className="text-sm text-gray-600">Loading transcript…</div>
                  ) : segmentsError ? (
                    <div className="text-sm text-red-600">{segmentsError}</div>
                  ) : segments.length === 0 ? (
                    <div className="text-sm text-gray-600">No cues found in VTT.</div>
                  ) : (
                    <div className="max-h-80 overflow-auto divide-y">
                      {segments.map((s, i) => (
                        <button
                          key={i}
                          className="w-full text-left px-2 py-1.5 text-[13px] hover:bg-gray-50"
                          onClick={() => {
                            if (!mediaEl) return;
                            const t = Math.max(0, s.start / 1000);
                            try { (mediaEl as any).pause?.(); } catch {}
                            try { (mediaEl as any).currentTime = t; } catch {}
                            try { (mediaEl as any).play?.(); } catch {}
                          }}
                        >
                          <span className="text-gray-400 mr-2">[{formatTimeMs(s.start)}]</span>
                          <span>{s.text}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {panel === 'translate' && (
            <div className="p-4">
              <div className="rounded-lg border bg-white">
                <div className="p-3 text-sm text-gray-700 space-y-3">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500">Target language</label>
                    <select className="border rounded px-2 py-1 text-sm" value={lang} onChange={(e) => setLang(e.target.value)}>
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="pt">Portuguese</option>
                      <option value="zh">Chinese</option>
                      <option value="ja">Japanese</option>
                    </select>
                    <button
                      className="ml-2 px-2 py-1 rounded border text-xs"
                      disabled={!segments.length || translateLoading}
                      onClick={async () => {
                        setTranslateError(null);
                        setTranslated(null);
                        setTranslateLoading(true);
                        try {
                          const text = segments.map(s => s.text).join(' ');
                          const res = await fetch('/api/translate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ text, targetLanguage: lang })
                          });
                          const j = await res.json();
                          if (!res.ok || j?.success === false) throw new Error(j?.error || 'Translation failed');
                          setTranslated(j.translation || j.translatedText || '');
                        } catch (e: any) {
                          setTranslateError(String(e?.message || e));
                        } finally {
                          setTranslateLoading(false);
                        }
                      }}
                    >{translateLoading ? 'Translating…' : 'Translate'}</button>
                  </div>
                  {translateError ? <div className="text-sm text-red-600">{translateError}</div> : null}
                  {translated ? (
                    <div className="text-[13px] leading-6 whitespace-pre-wrap">{translated}</div>
                  ) : (
                    <div className="text-xs text-gray-500">Choose a language and translate the transcript.</div>
                  )}
                </div>
              </div>
            </div>
          )}

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

