"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Media } from "./MediaTile";

export default function MediaEditorModal({ item, onClose, onInsert }: {
  item: Media;
  onClose: () => void;
  onInsert: (m: Media & { inMs?: number; outMs?: number; aspect?: string }) => void;
}) {
  const [inMs, setInMs] = useState<number>(0);
  const [outMs, setOutMs] = useState<number | undefined>(
    typeof item.duration === 'number' ? Math.floor(item.duration * 1000) : undefined
  );
  const [aspect, setAspect] = useState<string>('16:9');

  // Video element ref for seeking from transcript
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Transcript state
  type Seg = { start: number; end?: number; text: string };
  const [segments, setSegments] = useState<Seg[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [segmentsError, setSegmentsError] = useState<string | null>(null);
  const [genMsg, setGenMsg] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    async function loadVtt(url: string) {
      setSegmentsLoading(true);
      setSegmentsError(null);
      try {
        const resp = await fetch(url, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`VTT fetch failed: ${resp.status}`);
        const text = await resp.text();
        if (aborted) return;
        const parsed = parseVtt(text);
        setSegments(parsed);
      } catch (e: any) {
        if (!aborted) setSegmentsError(e?.message || 'Failed to load transcript');
      } finally {
        if (!aborted) setSegmentsLoading(false);
      }
    }
    if (item.captionVttUrl) {
      void loadVtt(item.captionVttUrl);
    } else {
      setSegments([]);
    }
    return () => { aborted = true; };
  }, [item.captionVttUrl]);

  if (typeof document === 'undefined') return null;

  // Compute sources for preview
  // - For images: use posterUrl or proxy the thumbPath via /api/img
  // - For videos: use the actual video url for <video src>, and use poster image for the poster attribute
  const imageSrc = useMemo(() => {
    return item.posterUrl || (item.thumbPath ? `/api/img?path=${encodeURIComponent(item.thumbPath)}` : undefined);
  }, [item.posterUrl, item.thumbPath]);

  const videoSrc = useMemo(() => {
    return item.kind === 'video' ? (item.url || undefined) : undefined;
  }, [item.kind, item.url]);

  const body = (
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-x-0 top-10 mx-auto w-full max-w-[980px] rounded-2xl overflow-hidden shadow-xl border border-[#E6E8EC] bg-white">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#E6E8EC] flex items-center gap-2">
          <div className="text-sm text-gray-800 truncate">{item.title || 'Untitled'}</div>
          {item.duration ? (<div className="text-xs text-gray-500">• {fmt(item.duration)}</div>) : null}
          <button className="ml-auto text-sm text-gray-500" onClick={onClose}>Close ✕</button>
        </div>
        {/* Content */}
        <div className="grid md:grid-cols-[1fr_320px] gap-4 p-4">
          {/* Preview */}
          <div className="rounded-xl border border-[#E6E8EC] overflow-hidden bg-black/5 aspect-video grid place-items-center">
            {item.kind === 'video' ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                ref={videoRef}
                src={videoSrc}
                poster={imageSrc}
                controls
                className="w-full h-full object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageSrc} alt={item.title || 'media'} className="w-full h-full object-contain" />
            )}
          </div>
          {/* Side panel */}
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-gray-900 mb-1">Clip</div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600">In (ms)</label>
                <input type="number" value={inMs} onChange={(e) => setInMs(Math.max(0, parseInt(e.target.value || '0', 10)))} className="w-28 border rounded px-2 py-1 text-sm" />
                <label className="text-xs text-gray-600">Out (ms)</label>
                <input type="number" value={outMs ?? ''} onChange={(e) => setOutMs(Math.max(0, parseInt(e.target.value || '0', 10)))} className="w-28 border rounded px-2 py-1 text-sm" />
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900 mb-1">Aspect</div>
              <div className="flex flex-wrap gap-2">
                {['1:1','4:5','16:9','9:16'].map((a) => (
                  <button key={a} className={`px-2 py-1 rounded border text-sm ${aspect===a? 'bg-gray-900 text-white' : ''}`} onClick={() => setAspect(a)}>{a}</button>
                ))}
              </div>
            </div>

            {/* Transcript Panel */}
            {item.kind === 'video' && (
              <div>
                <div className="text-sm font-medium text-gray-900 mb-1">Transcript</div>
                {segmentsLoading ? (
                  <div className="text-xs text-gray-500">Loading…</div>
                ) : segmentsError ? (
                  <div className="text-xs text-red-600">{segmentsError}</div>
                ) : segments.length === 0 ? (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-500">No transcript available.</div>
                    <div className="flex items-center gap-2">
                      <button
                        className="px-2 py-1 rounded border text-xs"
                        onClick={async () => {
                          setGenMsg(null);
                          try {
                            const res = await fetch(`/api/media/${item.id}/transcribe`, { method: 'POST' });
                            if (!res.ok) {
                              const t = await res.text();
                              throw new Error(t || 'Failed to request transcription');
                            }
                            setGenMsg('Requested transcript. Check back in a bit.');
                          } catch (e: any) {
                            setGenMsg(String(e?.message || e));
                          }
                        }}
                      >Generate transcript</button>
                      {genMsg ? <span className="text-[11px] text-gray-600">{genMsg}</span> : null}
                    </div>
                  </div>
                ) : (
                  <div className="max-h-48 overflow-auto rounded border border-gray-200 divide-y">
                    {segments.map((s, i) => (
                      <button
                        key={i}
                        className="w-full text-left px-2 py-1.5 text-[12px] hover:bg-gray-50"
                        onClick={() => {
                          const t = Math.max(0, s.start / 1000);
                          try { videoRef.current?.pause(); } catch {}
                          if (videoRef.current) { videoRef.current.currentTime = t; try { void videoRef.current.play(); } catch {} }
                        }}
                        title={`${msFmt(s.start)}${s.end ? `–${msFmt(s.end)}` : ''}`}
                      >
                        <span className="text-gray-500 mr-2">{msFmt(s.start)}</span>
                        <span className="text-gray-800">{s.text}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tags Editor */}
            <TagsEditor assetId={item.id} initial={item.tags} />
            <div className="pt-2 text-right">
              <button className="px-3 py-2 rounded border border-gray-300 text-sm mr-2" onClick={onClose}>Cancel</button>
              <button className="px-3 py-2 rounded bg-gray-900 text-white text-sm mr-2" onClick={() => onInsert({ ...item, inMs, outMs, aspect })}>Insert into post</button>
              <button className="px-3 py-2 rounded bg-blue-600 text-white text-sm" onClick={async () => {
                try {
                  await fetch('/api/media/derive', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, inMs, outMs, aspect }) });
                  alert('Saved as new (processing)');
                } catch { /* ignore */ }
              }}>Save as new</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}

function fmt(s?: number) {
  if (!s || s <= 0) return '';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${ss}`;
}

function msFmt(ms: number) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function parseVtt(text: string): { start: number; end?: number; text: string }[] {
  // Minimal VTT cue parser
  const lines = text.split(/\r?\n/);
  const out: { start: number; end?: number; text: string }[] = [];
  let i = 0;
  function parseTime(ts: string): number {
    const m = ts.trim().match(/(?:(\d+):)?(\d{2}):(\d{2})[\.,]?(\d{0,3})?/);
    if (!m) return 0;
    const h = parseInt(m[1] || '0', 10);
    const mm = parseInt(m[2] || '0', 10);
    const ss = parseInt(m[3] || '0', 10);
    const ms = parseInt((m[4] || '0').padEnd(3, '0'), 10);
    return ((h * 3600 + mm * 60 + ss) * 1000) + ms;
  }
  while (i < lines.length) {
    const l = lines[i].trim();
    i++;
    if (!l) continue;
    // time line
    if (l.includes('-->')) {
      const [a, b] = l.split('-->').map((s) => s.trim());
      const start = parseTime(a);
      const end = b ? parseTime(b.split(' ')[0]) : undefined;
      // text lines until blank
      const buff: string[] = [];
      while (i < lines.length && lines[i].trim() !== '') {
        buff.push(lines[i]);
        i++;
      }
      out.push({ start, end, text: buff.join(' ').trim() });
    }
  }
  return out;
}

function TagsEditor({ assetId, initial }: { assetId: string; initial: string[] }) {
  const [tags, setTags] = useState<string[]>(initial || []);
  const [newTag, setNewTag] = useState('');
  async function add() {
    const name = newTag.trim();
    if (!name) return;
    setNewTag('');
    const resp = await fetch(`/api/media/${assetId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ addTags: [name] }) });
    if (resp.ok) {
      const j = await resp.json();
      setTags(j.tags || []);
    }
  }
  async function remove(name: string) {
    const resp = await fetch(`/api/media/${assetId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ removeTags: [name] }) });
    if (resp.ok) {
      const j = await resp.json();
      setTags(j.tags || []);
    }
  }
  return (
    <div>
      <div className="text-sm font-medium text-gray-900 mb-1">Tags</div>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.length === 0 ? (
          <span className="text-xs text-gray-500">No tags</span>
        ) : (
          tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 text-xs bg-gray-100 border border-gray-200 rounded px-2 py-1">
              {t}
              <button className="text-gray-500 hover:text-gray-800" onClick={() => remove(t)} title="Remove">✕</button>
            </span>
          ))
        )}
      </div>
      <div className="flex items-center gap-2">
        <input value={newTag} onChange={(e) => setNewTag(e.target.value)} placeholder="Add tag" className="flex-1 border rounded px-2 py-1 text-sm" />
        <button className="px-2 py-1 rounded border text-sm" onClick={add}>Add</button>
      </div>
    </div>
  );
}
