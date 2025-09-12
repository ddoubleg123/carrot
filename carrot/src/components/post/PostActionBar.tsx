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
    <div className="mt-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {/* Like */}
        <button
          className={["flex items-center gap-1", liked ? "text-orange-600" : "text-gray-700 hover:text-gray-900"].join(" ")}
          onClick={handleLike}
          aria-label={liked ? "Unlike" : "Like"}
        >
          <Heart className={liked ? "fill-orange-500 text-orange-500" : ""} size={20} />
          <span className="text-sm">{likeCount}</span>
        </button>

        {/* Comment */}
        <button
          className="flex items-center gap-1 text-gray-700 hover:text-gray-900"
          onClick={() => { try { onComment && onComment(); } catch {} }}
          aria-label="Comment"
        >
          <MessageCircle size={20} />
          <span className="text-sm">{(stats.comments ?? 0)}</span>
        </button>

        {/* Share (external by default, internal via long-press/menu if provided) */}
        <div className="relative">
          <button
            className="flex items-center gap-1 text-gray-700 hover:text-gray-900"
            onClick={handleShare}
            onContextMenu={(e) => { e.preventDefault(); try { onShareInApp && onShareInApp(); } catch {} }}
            aria-label="Share"
            title="Share"
          >
            <Share2 size={20} />
            <span className="text-sm">Share</span>
          </button>
        </div>

        {/* Save */}
        <button
          className="flex items-center gap-1 text-gray-700 hover:text-gray-900"
          onClick={handleSave}
          aria-label={saved ? "Unsave" : "Save"}
          title={saved ? "Unsave" : "Save"}
        >
          {saved ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
          <span className="text-sm">{saved ? "Saved" : "Save"}</span>
        </button>
      </div>

      {/* Transcription / Translation cluster */}
      <div className="flex items-center gap-3">
        {canTranscribe ? (
          <button
            className="flex items-center gap-1 text-gray-700 hover:text-gray-900"
            onClick={() => { try { onTranscribe && onTranscribe(); } catch {} }}
            aria-label="Transcript"
            title="Transcript"
          >
            <FileText size={18} />
            <span className="text-sm">Transcript</span>
          </button>
        ) : null}
        <button
          className="flex items-center gap-1 text-gray-700 hover:text-gray-900"
          onClick={() => { try { onTranslate && onTranslate(); } catch {} }}
          aria-label="Translate"
          title="Translate"
        >
          <Languages size={18} />
          <span className="text-sm">Translate</span>
        </button>
      </div>
    </div>
  );
}
