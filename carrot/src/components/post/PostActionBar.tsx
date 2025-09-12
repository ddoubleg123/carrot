"use client";

import React, { useMemo, useState } from "react";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  BookmarkCheck,
  Languages,
  FileText
} from "lucide-react";

export type PostActionBarProps = {
  postId: string;
  stats: { likes?: number; comments?: number; reposts?: number; views?: number };
  canTranscribe?: boolean;
  onLike?: (liked: boolean) => void;
  onComment?: () => void;
  onShareInApp?: () => void;
  onShareExternal?: (url: string) => void;
  onSaveToggle?: (saved: boolean) => void;
  onTranscribe?: () => void;
  onTranslate?: () => void;
  permalink?: string; // full URL for share/copy
  initiallySaved?: boolean;
  initiallyLiked?: boolean;
};

export default function PostActionBar(props: PostActionBarProps) {
  const {
    postId,
    stats,
    canTranscribe,
    onLike,
    onComment,
    onShareInApp,
    onShareExternal,
    onSaveToggle,
    onTranscribe,
    onTranslate,
    permalink,
    initiallySaved,
    initiallyLiked,
  } = props;

  const [liked, setLiked] = useState<boolean>(!!initiallyLiked);
  const [saved, setSaved] = useState<boolean>(!!initiallySaved);
  const likeCount = useMemo(() => (stats.likes ?? 0) + (liked && !initiallyLiked ? 1 : (!liked && initiallyLiked ? -1 : 0)), [stats.likes, liked, initiallyLiked]);

  const handleLike = () => {
    const next = !liked;
    setLiked(next);
    try { onLike && onLike(next); } catch {}
    // Fire-and-forget persistence
    try {
      fetch(`/api/posts/${postId}/like`, { method: 'POST' })
        .then(() => void 0)
        .catch(() => void 0);
    } catch {}
  };

  const handleSave = () => {
    const next = !saved;
    setSaved(next);
    try { onSaveToggle && onSaveToggle(next); } catch {}
    // Fire-and-forget persistence
    try {
      fetch(`/api/posts/${postId}/save`, { method: 'POST' })
        .then(() => void 0)
        .catch(() => void 0);
    } catch {}
  };

  const handleShare = async () => {
    const url = permalink || (typeof window !== 'undefined' ? `${window.location.origin}/post/${postId}` : `https://gotcarrot.com/post/${postId}`);
    // Try native Web Share API first
    try {
      if (typeof navigator !== 'undefined' && (navigator as any).share) {
        await (navigator as any).share({ title: 'Check out this post on Carrot', url });
        return;
      }
    } catch {}
    try { onShareExternal && onShareExternal(url); } catch {}
    try {
      await navigator.clipboard.writeText(url);
      // Optionally, show a toast via caller
    } catch {}
  };

  return (
    <div className="mt-3 flex items-center justify-between w-full">
      {/* Left cluster: primary actions */}
      <div className="flex items-center gap-2">
        {/* Like */}
        <button
          className={[
            "h-9 w-9 inline-flex items-center justify-center rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition",
            liked ? "text-orange-600 border-orange-200 bg-orange-50" : "text-gray-700",
          ].join(" ")}
          onClick={handleLike}
          aria-label={liked ? "Unlike" : "Like"}
          title={liked ? "Unlike" : "Like"}
        >
          <Heart className={liked ? "fill-orange-500 text-orange-500" : ""} size={18} />
        </button>
        <span className="min-w-[1.5ch] text-sm text-gray-700 ml-1 mr-2">{likeCount}</span>

        {/* Comment */}
        <button
          className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition"
          onClick={() => { try { onComment && onComment(); } catch {} }}
          aria-label="Comment"
          title="Comment"
        >
          <MessageCircle size={18} />
        </button>
        <span className="min-w-[1.5ch] text-sm text-gray-700 ml-1 mr-2">{(stats.comments ?? 0)}</span>

        {/* Share */}
        <button
          className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition"
          onClick={handleShare}
          onContextMenu={(e) => { e.preventDefault(); try { onShareInApp && onShareInApp(); } catch {} }}
          aria-label="Share"
          title="Share"
        >
          <Share2 size={18} />
        </button>

        {/* Save */}
        <button
          className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition"
          onClick={handleSave}
          aria-label={saved ? "Unsave" : "Save"}
          title={saved ? "Unsave" : "Save"}
        >
          {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
        </button>
      </div>

      {/* Right cluster: transcript/translate - icon only to keep symmetry */}
      <div className="flex items-center gap-2">
        {canTranscribe ? (
          <button
            className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition"
            onClick={() => { try { onTranscribe && onTranscribe(); } catch {} }}
            aria-label="Transcript"
            title="Transcript"
          >
            <FileText size={18} />
          </button>
        ) : null}
        <button
          className="h-9 w-9 inline-flex items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition"
          onClick={() => { try { onTranslate && onTranslate(); } catch {} }}
          aria-label="Translate"
          title="Translate"
        >
          <Languages size={18} />
        </button>
      </div>
    </div>
  );
}
