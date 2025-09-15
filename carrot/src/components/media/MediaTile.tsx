"use client";
import React, { useMemo, useState } from "react";

export type Media = {
  id: string;
  kind: "video" | "image";
  title: string;
  duration?: number;
  thumbPath: string; // path preferred
  posterUrl?: string | null;
  url?: string | null;
  captionVttUrl?: string | null;
  storagePath: string;
  tags: string[];
  hidden?: boolean;
};

export default function MediaTile({ m, onOpen, onRename, onToggleHidden }: {
  m: Media;
  onOpen: (m: Media) => void;
  onRename: (m: Media) => void;
  onToggleHidden: (m: Media) => void;
}) {
  const [menu, setMenu] = useState(false);
  const thumbUrl = useMemo(() => {
    if (m.thumbPath) return `/api/img?path=${encodeURIComponent(m.thumbPath)}`;
    if (m.posterUrl) return `/api/img?url=${encodeURIComponent(m.posterUrl)}`;
    if (m.url) return `/api/img?url=${encodeURIComponent(m.url)}`;
    return "/thumb-placeholder.png";
  }, [m.thumbPath, m.posterUrl, m.url]);
  const label = `${m.kind === 'video' ? 'Video' : 'Image'}${m.duration ? ` · ${fmt(m.duration)}` : ''} · ${m.title || 'Untitled'}`;

  return (
    <div className="relative group" aria-label={label}>
      <button className="block w-full rounded-lg border border-[#E6E8EC] overflow-hidden shadow-sm hover:-translate-y-0.5 transition-transform" onClick={() => onOpen(m)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbUrl}
          alt={m.title || (m.kind === 'video' ? 'Video thumbnail' : 'Image thumbnail')}
          loading="lazy"
          decoding="async"
          className="w-full aspect-video object-cover"
        />
      </button>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="rounded bg-white/90 border border-gray-200 px-2 py-1 text-xs shadow" onClick={() => setMenu((v) => !v)} aria-label="Menu">⋮</button>
        {menu && (
          <div className="mt-1 bg-white border border-gray-200 rounded shadow text-sm overflow-hidden">
            <button className="block w-full text-left px-3 py-2 hover:bg-gray-50" onClick={() => { setMenu(false); onRename(m); }}>Rename</button>
            <button className="block w-full text-left px-3 py-2 hover:bg-gray-50" onClick={() => { setMenu(false); onToggleHidden(m); }}>{m.hidden ? 'Unhide' : 'Hide from gallery'}</button>
          </div>
        )}
      </div>
      <div className="mt-1 text-[13px] text-gray-800 truncate" title={m.title}>{m.title || 'Untitled'}</div>
    </div>
  );
}

function fmt(s?: number) {
  if (!s || s <= 0) return '';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${ss}`;
}
