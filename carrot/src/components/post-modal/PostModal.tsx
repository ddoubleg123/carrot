"use client";
import React, { useEffect, useMemo, useState } from "react";
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
  const [showComments, setShowComments] = useState(false);
  const username = data?.User?.username ? (data.User.username.startsWith("@") ? data.User.username : `@${data.User.username}`) : "@user";
  const avatar = useMemo(() => {
    const p = data?.User;
    if (!p) return "/avatar-placeholder.svg";
    if (p.profilePhotoPath) return `/api/img?path=${encodeURIComponent(p.profilePhotoPath)}`;
    if (p.profilePhoto && /^https?:\/\//i.test(p.profilePhoto)) return `/api/img?url=${encodeURIComponent(p.profilePhoto)}`;
    return "/avatar-placeholder.svg";
  }, [data?.User]);

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

          {/* Media */}
          <div className="p-3">
            <div className="rounded-xl overflow-hidden" style={{ background: "linear-gradient(135deg,#F97316,#3B82F6)" }}>
              <div className="w-full h-[360px] flex items-center justify-center">
                {loading ? (
                  <div className="text-sm text-gray-500">Loading…</div>
                ) : data?.videoUrl ? (
                  <video controls playsInline poster={data.thumbnailUrl || undefined} className="w-full h-full object-contain bg-black">
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
                ) : (
                  <div className="text-sm text-gray-500">No media</div>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-4 pb-4">
            <div className="flex items-center gap-4">
              <button className="px-3 py-2 rounded bg-orange-50 text-orange-700 border border-orange-200">🥕 Support</button>
              <button className="px-3 py-2 rounded bg-blue-50 text-blue-700 border border-blue-200">📣 Boost</button>
              <button className="px-3 py-2 rounded bg-gray-50 text-gray-700 border border-gray-200" onClick={() => setShowComments(true)}>💬 Comment</button>
              <button className="ml-auto px-3 py-2 rounded bg-gray-50 text-gray-700 border border-gray-200">↗ Share</button>
            </div>
          </div>
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
