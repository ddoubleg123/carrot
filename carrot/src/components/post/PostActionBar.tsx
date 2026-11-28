"use client";

import React, { useMemo, useState } from "react";
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  BookmarkCheck,
  Languages,
  FileText,
  EyeOff
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
  initiallyStuck?: boolean;
  onStick?: (stuck: boolean) => void;
};

function PostActionBar(props: PostActionBarProps) {
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
    initiallyStuck,
    onStick,
  } = props;

  const [liked, setLiked] = useState<boolean>(!!initiallyLiked);
  const [stuck, setStuck] = useState<boolean>(!!initiallyStuck);
  const [saved, setSaved] = useState<boolean>(!!initiallySaved);
  const [serverLikes, setServerLikes] = useState<number | null>(null);
  const likeCount = useMemo(() => {
    if (typeof serverLikes === 'number') return serverLikes;
    return (stats.likes ?? 0) + (liked && !initiallyLiked ? 1 : (!liked && initiallyLiked ? -1 : 0));
  }, [serverLikes, stats.likes, liked, initiallyLiked]);

  const handleLike = () => {
    const next = !liked;
    setLiked(next);
    if (next) {
      setStuck(false);
      try { onStick && onStick(false); } catch {}
    }
    try { onLike && onLike(next); } catch {}
    // Fire-and-forget persistence. A carrot replaces a stick.
    try {
      fetch(`/api/posts/${postId}/like`, { method: 'POST' })
        .then(async (res) => {
          if (!res.ok) return;
          const data = await res.json().catch(() => null);
          if (typeof data?.likes === 'number') setServerLikes(data.likes);
        })
        .catch(() => void 0);
    } catch {}
  };

  const handleStick = () => {
    const next = !stuck;
    setStuck(next);
    if (next) setLiked(false);
    try { onStick && onStick(next); } catch {}
    try {
      fetch(`/api/posts/${postId}/stick`, { method: 'POST' })
        .then(async (res) => {
          if (!res.ok) return;
          const data = await res.json().catch(() => null);
          if (typeof data?.likes === 'number') setServerLikes(data.likes);
          if (typeof data?.stuck === 'boolean') {
            setStuck(data.stuck);
            try { onStick && onStick(data.stuck); } catch {}
          }
        })
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
        fetch(`/api/posts/${postId}/share`, { method: 'POST' }).catch(() => {});
        return;
      }
    } catch {
      return;
    }
    try { onShareExternal && onShareExternal(url); } catch {}
    try {
      await navigator.clipboard.writeText(url);
      fetch(`/api/posts/${postId}/share`, { method: 'POST' }).catch(() => {});
    } catch {}
  };

  const iconBtn = "inline-flex h-10 w-10 items-center justify-center rounded-full text-[#78716C] transition hover:bg-[#F4F1EC] hover:text-[#1C1917]";

  return (
    <div
      className="flex w-full flex-row flex-wrap items-center justify-center gap-1 border-t border-[#F0EEE9] bg-[#FFFcf8] px-2 py-2 sm:w-[92px] sm:flex-none sm:flex-col sm:self-stretch sm:justify-center sm:border-l sm:border-t-0 sm:py-3"
      data-card-actions
    >
      <button
        className={[iconBtn, liked ? "bg-[#FFF1E6] text-orange-600" : ""].join(" ")}
        onClick={handleLike}
        aria-label={liked ? "Remove carrot" : "Carrot"}
        title={liked ? "Remove carrot" : "Carrot"}
      >
        <Heart className={liked ? "fill-orange-500 text-orange-500" : ""} size={18} />
      </button>
      <span className="-mt-1 mb-1 text-xs text-[#78716C]">{likeCount}</span>

      <button
        className={iconBtn}
        onClick={() => { try { onComment && onComment(); } catch {} }}
        aria-label="Comment"
        title="Comment"
      >
        <MessageCircle size={18} />
      </button>
      <span className="-mt-1 mb-1 text-xs text-[#78716C]">{stats.comments ?? 0}</span>

      <button
        className={iconBtn}
        onClick={handleShare}
        onContextMenu={(e) => { e.preventDefault(); try { onShareInApp && onShareInApp(); } catch {} }}
        aria-label="Share"
        title="Share"
      >
        <Share2 size={18} />
      </button>

      <button
        className={[iconBtn, saved ? "bg-[#F4F1EC] text-[#1C1917]" : ""].join(" ")}
        onClick={handleSave}
        aria-label={saved ? "Unsave" : "Save"}
        title={saved ? "Unsave" : "Save"}
      >
        {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
      </button>

      {canTranscribe ? (
        <button
          className={iconBtn}
          onClick={() => { try { onTranscribe && onTranscribe(); } catch {} }}
          aria-label="Transcript"
          title="Transcript"
        >
          <FileText size={18} />
        </button>
      ) : null}
      <button
        className={iconBtn}
        onClick={() => { try { onTranslate && onTranslate(); } catch {} }}
        aria-label="Translate"
        title="Translate"
      >
        <Languages size={18} />
      </button>

      <div className="mx-1 hidden h-px w-7 bg-[#E7E5E4] sm:my-2 sm:block" />
      <button
        id={`stick-${postId}`}
        className={[
          "flex w-[76px] flex-col items-center gap-1 rounded-xl px-1 py-2 transition",
          stuck ? "bg-[#1C1917] text-white" : "text-[#78716C] hover:bg-[#F4F1EC] hover:text-[#1C1917]",
        ].join(" ")}
        onClick={handleStick}
        aria-label={stuck ? "Undo not interested" : "Not interested"}
        title={stuck ? "Undo not interested" : "Not interested"}
      >
        <EyeOff size={18} />
        <span className="text-center text-[11px] font-semibold leading-tight">Not interested</span>
      </button>
    </div>
  );
}

export default React.memo(PostActionBar);
