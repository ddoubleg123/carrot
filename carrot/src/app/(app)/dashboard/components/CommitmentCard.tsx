"use client";

import React, { useMemo, useState, forwardRef, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import ImageWithFallback from "../../../../components/ImageWithFallback";
import { ChatBubbleOvalLeftIcon as ChatBubbleLeftIcon, ShareIcon, EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import AudioPlayerCard from "../../../../components/AudioPlayerCard";
import AudioHero from "../../../../components/audio/AudioHero";
import { createAnalyserFromMedia } from "../../../../components/audio/AudioAnalyser";
import dynamic from "next/dynamic";
import EditPostModal from "../../../../components/EditPostModal";
import VideoPlayerManager from "../../../../lib/VideoPlayerManager";
import FlagChip from "../../../../components/flags/FlagChip";
import { useModalRoute } from "../../../../hooks/useModalRoute";
import PostActionBar from "../../../../components/post/PostActionBar";
import ShareSheet from "../../../../components/share/ShareSheet";
import VideoErrorBoundary from "../../../../components/VideoErrorBoundary";

export type VoteType = "carrot" | "stick" | null;

export type Stats = {
  likes: number;
  comments: number;
  reposts: number;
  views: number;
  carrots?: number;
  sticks?: number;
};

type CustomProps = {
  id: string;
  content: string;
  author: {
    name: string;
    username: string;
    avatar?: string | null;
    flag?: string;
    id?: string;
  };
  location: { zip: string; city?: string; state?: string };
  stats: Stats;
  userVote?: VoteType;
  onVote?: (id: string, vote: VoteType) => void;
  onDelete?: (id: string) => void;
  onBlock?: (id: string) => void;
  timestamp?: string;
  imageUrls?: string[];
  gifUrl?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  // Cloudflare Stream
  cfUid?: string | null;
  cfPlaybackUrlHls?: string | null;
  captionVttUrl?: string | null;
  // Audio
  audioUrl?: string | null;
  audioTranscription?: string | null;
  transcriptionStatus?: string | null;
  // Upload state
  uploadStatus?: "uploading" | "uploaded" | "processing" | "ready" | null;
  uploadProgress?: number | null;
  // Ownership
  currentUserId?: string;
  // Edit metadata (optional if fetched from server)
  editedAt?: string | null;
  editCount?: number | null;
  // Extras used by TestDashboardClient and legacy props (optional)
  carrotText?: string;
  stickText?: string;
  videoThumbnail?: string | null;
  videoTranscriptionStatus?: string | null;
  audioDurationSeconds?: number | null;
  emoji?: string | null;
  // Country flag control
  homeCountry?: string | null;
  // Persisted audio visual overrides (optional)
  visualSeed?: string | null;
  visualStyle?: 'liquid' | 'radial' | 'arc' | null;
  // Gradient styling (optional)
  gradientFromColor?: string | null;
  gradientToColor?: string | null;
  gradientViaColor?: string | null;
  gradientDirection?: string | null;
  innerBoxColor?: string | null;
  // New API controls
  asChild?: boolean;
  debugUnknownPropsToConsole?: boolean;
  debugDataPrefix?: string;
  enableDataAttributes?: boolean;
};

export type CommitmentCardProps = CustomProps & React.ComponentPropsWithoutRef<'div'>;

const isDev = process.env.NODE_ENV !== 'production';

const ALLOWED_DIV_KEYS = new Set([
  'id','className','style','role','tabIndex','title','draggable','hidden','dir','lang'
]);

// Skeleton to reserve media area and avoid CLS during client hydration
function MediaSkeleton() {
  return (
    <div className="rounded-xl overflow-hidden bg-white" style={{ aspectRatio: '16 / 9' }} aria-hidden />
  );
}

// Disabled: Only using VideoPlayer (SimpleVideo) for all videos to improve performance
// const CFVideoPlayer = dynamic(() => import('../../../../components/CFVideoPlayer'), {
//   ssr: false,
//   loading: () => <MediaSkeleton />,
// });

// const HlsFeedPlayer = dynamic(() => import('../../../../components/video/HlsFeedPlayer'), {
//   ssr: false,
//   loading: () => <MediaSkeleton />,
// });

const VideoPlayer = dynamic(() => import('./VideoPlayer'), {
  ssr: false,
  loading: () => <MediaSkeleton />,
});

// CRITICAL FIX: Create memoized player OUTSIDE component to prevent remounts
const MemoizedVideoPlayer = React.memo(VideoPlayer, (prevProps, nextProps) => {
  // Only re-render if critical props change
  return (
    prevProps.videoUrl === nextProps.videoUrl &&
    prevProps.postId === nextProps.postId &&
    prevProps.uploadStatus === nextProps.uploadStatus
  );
});

function isDomEventKey(k: string) {
  return /^on[A-Z]/.test(k);
}

function isAriaOrData(k: string) {
  return k.startsWith('aria-') || k.startsWith('data-');
}

const CUSTOM_PROP_KEYS = new Set<keyof CustomProps>([
  'id','content','author','location','stats','userVote','onVote','onDelete','onBlock','timestamp','imageUrls','gifUrl','videoUrl','thumbnailUrl','cfUid','cfPlaybackUrlHls','captionVttUrl','audioUrl','audioTranscription','transcriptionStatus','uploadStatus','uploadProgress','currentUserId','editedAt','editCount','carrotText','stickText','videoThumbnail','videoTranscriptionStatus','audioDurationSeconds','emoji','gradientFromColor','gradientToColor','gradientViaColor','gradientDirection','innerBoxColor','asChild','debugUnknownPropsToConsole','debugDataPrefix','enableDataAttributes'
]);

// Conservative whitelist of DOM event props we allow through to the root element
const ALLOWED_EVENT_KEYS = new Set([
  'onClick','onMouseEnter','onMouseLeave','onMouseDown','onMouseUp','onFocus','onBlur',
  'onKeyDown','onKeyUp','onKeyPress','onScroll','onWheel','onTouchStart','onTouchEnd','onTouchMove'
]);

function filterRootDivProps(rest: Record<string, any>): Record<string, any> {
  const safeRest: Record<string, any> = {};
  try {
    for (const [k, v] of Object.entries(rest)) {
      if (CUSTOM_PROP_KEYS.has(k as keyof CustomProps)) continue; // never forward our custom API
      if (ALLOWED_DIV_KEYS.has(k)) { safeRest[k] = v; continue; }
      if (isAriaOrData(k)) { safeRest[k] = v; continue; }
      if (isDomEventKey(k)) { if (ALLOWED_EVENT_KEYS.has(k)) safeRest[k] = v; continue; }
      // Skip unknown keys by default
    }
  } catch {}
  return safeRest;
}

const CommitmentCard = forwardRef<HTMLDivElement, CommitmentCardProps>(function CommitmentCard(props, ref) {
  const {
    id,
    author: rawAuthor,
    stats,
    timestamp,
    imageUrls = [],
    gifUrl,
    videoUrl,
    thumbnailUrl,
    cfUid,
    cfPlaybackUrlHls,
    captionVttUrl,
    audioUrl,
    audioTranscription,
    transcriptionStatus,
    uploadStatus,
    uploadProgress,
    currentUserId,
    onDelete,
    // new props
    carrotText,
    innerBoxColor,
    debugUnknownPropsToConsole,
    debugDataPrefix = 'cc',
    enableDataAttributes,
    className,
    children,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    asChild,
    ...rest
  } = props;

  // Ensure author is always defined with safe defaults
  const author = rawAuthor || {
    name: '',
    username: 'user',
    avatar: '/avatar-placeholder.svg',
    flag: null,
    id: 'unknown'
  };

  // Local content and edit state (kept minimal to avoid bloating the card)
  const [content, setContent] = useState<string>(props.content || "");
  const [editedAt, setEditedAt] = useState<string | null | undefined>(props.editedAt);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const analyserRef = useRef<ReturnType<typeof createAnalyserFromMedia> | null>(null);
  const { openPostModal } = useModalRoute();
  // Hover UI state and video element handle
  const [hovering, setHovering] = useState(false);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const originalParentRef = useRef<HTMLElement | null>(null);
  const lightboxMountRef = useRef<HTMLDivElement | null>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const attachVideoRef = (el: HTMLVideoElement | null) => {
    videoElRef.current = el;
    try { VideoPlayerManager.inst.adopt(el); } catch {}
    try {
      if (!el) return;
      try { el.setAttribute('data-post-video-id', id); } catch {}
      // Keep local state in sync for button labels
      const onPlay = () => setPlaying(true);
      const onPause = () => setPlaying(false);
      const onVolume = () => setMuted(el.muted);
      el.addEventListener('play', onPlay);
      el.addEventListener('pause', onPause);
      el.addEventListener('volumechange', onVolume);
      // Initialize
      setMuted(el.muted);
      setPlaying(!el.paused);
      // Cleanup when element changes
      const cleanup = () => {
        try {
          el.removeEventListener('play', onPlay);
          el.removeEventListener('pause', onPause);
          el.removeEventListener('volumechange', onVolume);
        } catch {}
      };
      (attachVideoRef as any)._cleanup = cleanup;
    } catch {}
  };
  useEffect(() => {
    return () => { try { (attachVideoRef as any)?._cleanup?.(); } catch {} };
  }, []);

  // Lightweight lightbox which re-parents the existing <video> element so it doesn't re-download
  const [showLightbox, setShowLightbox] = useState(false);
  useEffect(() => {
    try {
      const video = videoElRef.current;
      const lightTarget = lightboxMountRef.current;
      if (!video) return;
      if (!originalParentRef.current) {
        originalParentRef.current = video.parentElement as HTMLElement | null;
      }
      if (showLightbox) {
        if (lightTarget && video.parentElement !== lightTarget) {
          VideoPlayerManager.inst.mount(lightTarget);
          try { video.controls = true; } catch {}
        }
      } else {
        const originalParent = originalParentRef.current;
        if (originalParent && video.parentElement !== originalParent) {
          VideoPlayerManager.inst.unmount(originalParent);
        }
      }
    } catch {}
  }, [showLightbox]);

  // DOM transfer: listen for global portal events and adopt/return the <video> element
  useEffect(() => {
    const adopt = (mount: HTMLElement) => {
      try {
        const v = videoElRef.current; if (!v) return;
        if (!originalParentRef.current) originalParentRef.current = v.parentElement as HTMLElement | null;
        if (v.parentElement !== mount) {
          VideoPlayerManager.inst.mount(mount);
          try { v.controls = true; } catch {}
        }
      } catch {}
    };
    const restore = () => {
      try {
        const v = videoElRef.current; if (!v) return;
        const parent = originalParentRef.current; if (!parent) return;
        if (v.parentElement !== parent) VideoPlayerManager.inst.unmount(parent);
      } catch {}
    };
    const onReady = (e: any) => {
      try {
        const pid = e?.detail?.postId;
        if (pid !== id) return;
        const mount = document.querySelector(`[data-video-portal-for="${id}"]`) as HTMLElement | null;
        if (mount) adopt(mount);
      } catch {}
    };
    const onDismiss = (e: any) => {
      try {
        const pid = e?.detail?.postId;
        if (pid !== id) return;
        restore();
      } catch {}
    };
    window.addEventListener('carrot-video-portal-ready', onReady as any);
    window.addEventListener('carrot-video-portal-dismiss', onDismiss as any);
    return () => {
      window.removeEventListener('carrot-video-portal-ready', onReady as any);
      window.removeEventListener('carrot-video-portal-dismiss', onDismiss as any);
      // Best-effort restore on unmount
      restore();
    };
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowLightbox(false); };
    if (showLightbox) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showLightbox]);

  const isOwnPost = useMemo(() => Boolean(currentUserId && author?.id && currentUserId === author.id), [currentUserId, author?.id]);
  const displayTime = useMemo(() => {
    const d = timestamp ? new Date(timestamp) : new Date();
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  }, [timestamp]);

  // Lightweight debug info for the overflow menu
  const debugInfo = useMemo(() => {
    const audioIsBlob = typeof audioUrl === 'string' && audioUrl.startsWith('blob:');
    const hasVideo = Boolean(cfUid || cfPlaybackUrlHls || videoUrl);
    return {
      id,
      authorId: author?.id || null,
      hasAudio: Boolean(audioUrl),
      audioUrl: audioUrl || null,
      audioIsBlob,
      hasVideo,
      cfUid: cfUid || null,
      cfPlaybackUrlHls: cfPlaybackUrlHls || null,
      videoUrl: videoUrl || null,
      uploadStatus: uploadStatus || null,
      uploadProgress: uploadProgress ?? null,
      transcriptionStatus: transcriptionStatus || null,
      hasAudioTranscription: Boolean(audioTranscription),
      timestamp: timestamp || null,
    };
  }, [id, author?.id, audioUrl, cfUid, cfPlaybackUrlHls, videoUrl, uploadStatus, uploadProgress, transcriptionStatus, audioTranscription, timestamp]);

  // In-app Share sheet state
  const [showShare, setShowShare] = useState(false);

  const copyDebugToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
      setIsMenuOpen(false);
      // Optionally, a subtle alert to confirm
      try { console.log('[CommitmentCard] Debug info copied:', debugInfo); } catch {}
    } catch (e) {
      // Fallback
      alert('Could not copy debug info. Check console for details.');
      try { console.log('[CommitmentCard] Debug info:', debugInfo); } catch {}
    }
  };

  const handleDelete = () => {
    if (!onDelete) return;
    if (confirm('Delete this post? This cannot be undone.')) {
      try { onDelete(id); } catch {}
      setIsMenuOpen(false);
    }
  };

  // Dev-only unknown prop guard
  if (isDev && debugUnknownPropsToConsole) {
    try {
      const suspicious: string[] = [];
      for (const k of Object.keys(props)) {
        if (CUSTOM_PROP_KEYS.has(k as keyof CustomProps)) continue;
        if (isAriaOrData(k) || isDomEventKey(k) || ALLOWED_DIV_KEYS.has(k)) continue;
        // exclude React internals
        if (k === 'key' || k === 'ref') continue;
        suspicious.push(k);
      }
      if (suspicious.length > 0) {
        // eslint-disable-next-line no-console
        console.warn('[CommitmentCard] Unknown props passed', suspicious, 'Hint: convert to data-* or add a documented custom prop');
      }
    } catch {}
  }

  // Optional data attributes (safe, minimal)
  const dataAttrs: Record<string, any> = {};
  if (enableDataAttributes) {
    const prefix = (debugDataPrefix || 'cc').trim();
    const trunc = (v?: string | null, n = 80) => (typeof v === 'string' ? (v.length > n ? v.slice(0, n) : v) : undefined);
    const safeColor = (v?: string | null) => (typeof v === 'string' ? v : undefined);
    if (carrotText) dataAttrs[`data-${prefix}-carrot-text`] = trunc(carrotText);
    if (innerBoxColor) dataAttrs[`data-${prefix}-inner-box-color`] = safeColor(innerBoxColor);
  }

  // Compute gradient background if provided
  const hasGradient = Boolean(props.gradientFromColor && props.gradientToColor);
  const gradientCss = hasGradient
    ? `linear-gradient(135deg, ${props.gradientFromColor}, ${props.gradientViaColor || props.gradientFromColor}, ${props.gradientToColor})`
    : undefined;

  // Detect presence of any video media to avoid rendering images/GIF alongside video
  const hasVideoMedia = Boolean(cfUid || cfPlaybackUrlHls || videoUrl);

  return (
    <div
      ref={ref}
      data-commitment-id={id}
      data-hls-master={cfPlaybackUrlHls || undefined}
      className={['bg-transparent', className].filter(Boolean).join(' ')}
      {...dataAttrs}
      {...filterRootDivProps(rest as Record<string, any>)}
      style={undefined}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div
        className={[
          hasGradient
            ? "rounded-2xl shadow-sm p-4 bg-white border border-white/60"
            : "bg-white border border-white/40 rounded-2xl shadow-sm p-4",
        ].join(' ')}
        data-card-inner
        style={innerBoxColor ? { backgroundColor: innerBoxColor } : undefined}
      >
        {carrotText ? (
          <div className="text-sm font-semibold text-gray-700 mb-1">{carrotText}</div>
        ) : null}
        {/* ... (rest of the code remains the same) */}
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 flex items-center justify-center">
            {audioUrl ? (
              <AudioHero avatarSrc={author?.avatar || null} size={40} analyser={analyserRef.current as any} state={isAudioPlaying ? 'playing' : 'paused'} />
            ) : (
              <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-100 relative">
                {author?.avatar ? (
                  <Image
                    src={author.avatar}
                    alt={author?.username && String(author.username).trim() ? `${String(author.username)}'s avatar` : 'User avatar'}
                    fill
                    sizes="40px"
                    priority={false}
                    loading="lazy"
                    unoptimized
                    style={{ objectFit: 'cover' }}
                    onLoad={() => {
                      console.log('[CommitmentCard] ✓ Avatar loaded successfully:', {
                        postId: id,
                        avatarUrl: author.avatar?.substring(0, 100),
                        isDataUri: author.avatar?.startsWith('data:'),
                        isFirebase: author.avatar?.includes('firebasestorage')
                      });
                    }}
                    onError={(e) => {
                      console.error('[CommitmentCard] ✗ Avatar load ERROR:', {
                        postId: id,
                        avatarUrl: author.avatar?.substring(0, 100),
                        isDataUri: author.avatar?.startsWith('data:'),
                        isProxied: author.avatar?.startsWith('/api/img'),
                        error: e.type
                      });
                      // Fallback to placeholder on error
                      e.currentTarget.src = '/avatar-placeholder.svg';
                    }}
                  />
                ) : (
                  <div className="h-full w-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-500 text-sm font-medium">
                      {author?.username ? author.username.charAt(0).toUpperCase() : '?'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-gray-900 truncate">
                  {author && author.username && String(author.username).trim() ? (String(author.username).startsWith("@") ? String(author.username) : `@${String(author.username)}`) : "@user"}
                </span>
                {(() => {
                  const cc = props.homeCountry || (author as any)?.flag || (author as any)?.country || null;
                  // Debug logging for flag data
                  if (process.env.NODE_ENV !== 'production') {
                    console.log('[CommitmentCard] Flag debug:', {
                      postId: id,
                      homeCountry: props.homeCountry,
                      authorFlag: (author as any)?.flag,
                      authorCountry: (author as any)?.country,
                      finalCountryCode: cc,
                      authorData: author
                    });
                  }
                  // Only show flag chip if we have a valid country code
                  return cc ? <FlagChip countryCode={cc} size={192} /> : null;
                })()}
                <button
                  type="button"
                  className="text-xs text-gray-500 underline-offset-2 hover:underline"
                  onClick={() => openPostModal(id)}
                  aria-label="Open post permalink"
                  title="Open post"
                >
                  • {displayTime}
                </button>
                {editedAt ? (
                  <span className="text-xs text-gray-500" title={new Date(editedAt).toLocaleString()}>• Edited</span>
                ) : null}
              </div>
              <div className="relative">
                <button className="p-1 text-gray-500 hover:text-gray-700" aria-label="More" onClick={() => setIsMenuOpen(v => !v)}>
                  <EllipsisHorizontalIcon className="h-5 w-5" />
                </button>
                {isMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-md border shadow z-10">
                    {isOwnPost ? (
                      <>
                        <button
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                          onClick={() => { setIsMenuOpen(false); setIsEditOpen(true); }}
                        >
                          Edit
                        </button>
                        {onDelete ? (
                          <button
                            className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                            onClick={handleDelete}
                          >
                            Delete
                          </button>
                        ) : null}
                      </>
                    ) : null}

                    {/* Debug section */}
                    <div className="px-3 py-2 border-t text-xs text-gray-700">
                      <div className="font-semibold text-gray-900 mb-1">Debug</div>
                      <div className="truncate" title={debugInfo.id}>ID: {debugInfo.id}</div>
                      {debugInfo.hasAudio ? (
                        <div className="mt-1">
                          <div>Audio: {debugInfo.audioIsBlob ? 'blob URL (not playable after reload)' : 'URL'}</div>
                          {debugInfo.audioIsBlob ? (
                            <div className="text-orange-600">Stale blob detected — needs re-upload/persistent URL</div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="mt-1">Audio: none</div>
                      )}
                      {debugInfo.hasVideo ? (
                        <div className="mt-1">Video: present ({debugInfo.cfUid ? 'Stream UID' : debugInfo.videoUrl ? 'Direct URL' : 'HLS'})</div>
                      ) : (
                        <div className="mt-1">Video: none</div>
                      )}
                      {typeof debugInfo.uploadProgress === 'number' ? (
                        <div className="mt-1">Upload: {debugInfo.uploadStatus || 'n/a'} {Math.round(debugInfo.uploadProgress)}%</div>
                      ) : debugInfo.uploadStatus ? (
                        <div className="mt-1">Upload: {debugInfo.uploadStatus}</div>
                      ) : null}
                      {debugInfo.transcriptionStatus ? (
                        <div className="mt-1">Transcription: {debugInfo.transcriptionStatus}</div>
                      ) : null}
                      <div className="mt-2 flex gap-2">
                        <button
                          className="px-2 py-1 rounded border text-gray-700 hover:bg-gray-50"
                          onClick={copyDebugToClipboard}
                        >
                          Copy debug
                        </button>
                        {debugInfo.audioUrl && !debugInfo.audioIsBlob ? (
                          <a
                            className="px-2 py-1 rounded border text-gray-700 hover:bg-gray-50"
                            href={debugInfo.audioUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            Open audio
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {/* Non-media posts: place content inside the gradient visual to mirror composer */}
        {hasGradient && !gifUrl && (!imageUrls || imageUrls.length === 0) && !videoUrl && !cfUid && !cfPlaybackUrlHls && !audioUrl ? (
          <div className="mt-3 rounded-xl w-full" style={{ background: gradientCss }}>
            <div className="p-4 sm:p-5">
              {content ? (
                <div
                  className="bg-white/90 border border-white/60 rounded-lg p-3 sm:p-4 text-[15px] text-gray-900 whitespace-pre-wrap break-words cursor-pointer"
                  onClick={() => openPostModal(id)}
                >
                  {content}
                </div>
              ) : null}
              {/* Composer parity: place actions over the gradient for non-media posts */}
              <PostActionBar
                postId={id}
                stats={stats}
                canTranscribe={Boolean(audioUrl || cfUid || cfPlaybackUrlHls || videoUrl)}
                permalink={typeof window !== 'undefined' ? `${window.location.origin}/post/${id}` : undefined}
                onComment={() => openPostModal(id, 'comments')}
                onLike={(liked) => {
                  try { console.log('[ActionBar] like toggled', { id, liked }); } catch {}
                }}
                onSaveToggle={(saved) => { try { console.log('[ActionBar] save toggled', { id, saved }); } catch {} }}
                onShareInApp={() => setShowShare(true)}
                onShareExternal={(url) => { try { console.log('[ActionBar] external share', url); } catch {} }}
                onTranscribe={() => { try { console.log('[ActionBar] open transcript/chapters', { id }); openPostModal(id, 'transcript'); } catch {} }}
                onTranslate={() => { try { console.log('[ActionBar] translate requested', { id }); openPostModal(id, 'translate'); } catch {} }}
              />
            </div>
          </div>
        ) : (
          content ? (
            <div
              className="mt-3 text-[15px] text-gray-900 whitespace-pre-wrap break-words cursor-pointer"
              onClick={() => openPostModal(id)}
            >
              {content}
            </div>
          ) : null
        )}

        {/* Children passthrough (optional) */}
        {children ? (
          <div className="mt-2">{children}</div>
        ) : null}

        {/* Images / GIF */}
        {!hasVideoMedia && gifUrl ? (
          <div className="mt-3 cursor-pointer" onClick={() => openPostModal(id)}>
            <div className="w-full rounded-xl overflow-hidden relative" style={{ aspectRatio: '16 / 9' }}>
              <ImageWithFallback
                src={gifUrl}
                alt={content ? `${content.slice(0, 60)} (animated gif)` : 'Animated GIF'}
                fill
                sizes="(max-width: 768px) 100vw, 700px"
                priority={false}
                loading="lazy"
                unoptimized
                style={{ objectFit: 'cover' }}
                maxRetries={3}
              />
            </div>
          </div>
        ) : !hasVideoMedia && imageUrls && imageUrls.length > 0 ? (
          <div className="mt-3">
            {/* Wrap media in gradient even when images exist so color passes over */}
            <div
              className="rounded-xl p-2"
              style={hasGradient ? { background: gradientCss } : undefined}
            >
            {imageUrls.length === 1 ? (
            <div className="cursor-pointer rounded-lg overflow-hidden" onClick={() => openPostModal(id)}>
              <div className="w-full relative" style={{ aspectRatio: '16 / 9' }}>
                <ImageWithFallback
                  src={imageUrls[0]}
                  alt={content ? `${content.slice(0, 60)} (image)` : 'Post image'}
                  fill
                  sizes="(max-width: 768px) 100vw, 700px"
                  priority={false}
                  loading="lazy"
                  unoptimized
                  style={{ objectFit: 'cover' }}
                  maxRetries={3}
                />
              </div>
            </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 cursor-pointer" onClick={() => openPostModal(id)}>
                  {imageUrls.slice(0, 4).map((u, i) => (
                    <div key={i} className="relative w-full h-48 rounded-lg overflow-hidden">
                      <ImageWithFallback
                        src={u}
                        alt={content ? `${content.slice(0, 40)} (image ${i + 1})` : `Post image ${i + 1}`}
                        fill
                        sizes="(max-width: 768px) 50vw, 33vw"
                        priority={false}
                        loading="lazy"
                        unoptimized
                        style={{ objectFit: 'cover' }}
                        maxRetries={3}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Video */}
        {(cfUid || cfPlaybackUrlHls || videoUrl) && (
          <div className="mt-3">
            <div
              className="rounded-xl p-2 relative group"
              style={hasGradient ? { background: gradientCss } : undefined}
              onClick={(e) => {
                // Prevent video clicks from opening PostModal
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              {/* Fullscreen button overlay */}
              <button
                className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white p-2 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  openPostModal(id, 'comments');
                }}
                title="Open in fullscreen"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
              {/* Video rendered by player; original parent is captured dynamically when opening lightbox */}
              {(() => {
                // VALIDATION: Check for valid video URL before rendering player
                const VALID_VIDEO_FORMATS = /\.(mp4|webm|mov|m4v|avi|mkv|ogg|ogv)(\?|$)/i;
                const VALID_VIDEO_MIME_TYPES = /^(video\/|application\/x-mpegURL|application\/vnd\.apple\.mpegurl)/i;
                
                if (!videoUrl) {
                  console.warn('[CommitmentCard] No videoUrl provided for post', { postId: id });
                  return (
                    <div className="flex items-center justify-center bg-gray-100 rounded-xl p-8">
                      <p className="text-gray-500 text-sm">Video unavailable</p>
                    </div>
                  );
                }
                
                // Check if it's a valid format
                const isProxied = videoUrl.startsWith('/api/video');
                const isDataUri = videoUrl.startsWith('data:');
                const hasValidExtension = VALID_VIDEO_FORMATS.test(videoUrl);
                const hasValidMimeType = isDataUri && VALID_VIDEO_MIME_TYPES.test(videoUrl);
                const isFirebase = videoUrl.includes('firebasestorage');
                
                if (!isProxied && !hasValidExtension && !hasValidMimeType && !isFirebase) {
                  console.warn('[CommitmentCard] ⚠️ Invalid video format detected, skipping render:', { 
                    postId: id, 
                    videoUrl: videoUrl.substring(0, 100),
                    isProxied,
                    isDataUri,
                    hasValidExtension,
                    hasValidMimeType,
                    isFirebase
                  });
                  return (
                    <div className="flex items-center justify-center bg-gray-100 rounded-xl p-8">
                      <div className="text-center">
                        <p className="text-gray-500 text-sm mb-1">Invalid video format</p>
                        <p className="text-gray-400 text-xs">Source: {videoUrl.substring(0, 50)}...</p>
                      </div>
                    </div>
                  );
                }
                
                // CRITICAL FIX: Memoized player defined outside component prevents remounts
                console.log('[CommitmentCard] ✓ Valid video URL, rendering SINGLE VideoPlayer (SimpleVideo):', {
                  postId: id,
                  hasVideoUrl: !!videoUrl,
                  videoUrl: videoUrl?.slice(0, 100),
                  isProxied,
                  isFirebase,
                  hasValidExtension,
                  renderTimestamp: Date.now()
                });
                
                return (
                  <VideoErrorBoundary postId={id}>
                    <MemoizedVideoPlayer
                      key={`video-${id}`}
                      videoUrl={videoUrl || ""}
                      thumbnailUrl={thumbnailUrl || undefined}
                      postId={id}
                      initialTranscription={audioTranscription || undefined}
                      transcriptionStatus={transcriptionStatus || undefined}
                      uploadStatus={uploadStatus || null}
                      uploadProgress={uploadProgress || 0}
                      onVideoRef={attachVideoRef}
                      disableNativeControls={false}
                    />
                  </VideoErrorBoundary>
                );
              })()}
            </div>
          </div>
        )}

        {/* Audio */}
        {audioUrl && (
          <div className="mt-3">
            <AudioPlayerCard 
              audioUrl={audioUrl} 
              avatarUrl={author?.avatar || undefined} 
              seed={id || author?.id} 
              visualSeedOverride={props.visualSeed ?? null}
              visualStyleOverride={props.visualStyle ?? null}
              promoJingleUrl="/carrotnom.mp3"
              onAudioRef={(el) => {
                try {
                  // Do not create another MediaElementSource here; let child own analyser
                  if (!el) { setIsAudioPlaying(false); return; }
                  el.addEventListener('play', () => setIsAudioPlaying(true));
                  el.addEventListener('pause', () => setIsAudioPlaying(false));
                  el.addEventListener('ended', () => setIsAudioPlaying(false));
                } catch {}
              }}
            />
          </div>
        )}

        {/* Actions (skip here if non-media gradient already rendered them inside) */}
        {!(hasGradient && !gifUrl && (!imageUrls || imageUrls.length === 0) && !videoUrl && !cfUid && !cfPlaybackUrlHls && !audioUrl) && (
          <PostActionBar
            postId={id}
            stats={stats}
            canTranscribe={Boolean(audioUrl || cfUid || cfPlaybackUrlHls || videoUrl)}
            permalink={typeof window !== 'undefined' ? `${window.location.origin}/post/${id}` : undefined}
            onComment={() => openPostModal(id, 'comments')}
            onLike={(liked) => {
              try {
                // Optimistic UI already handled in child; optionally call API here
                console.log('[ActionBar] like toggled', { id, liked });
              } catch {}
            }}
            onSaveToggle={(saved) => {
              try { console.log('[ActionBar] save toggled', { id, saved }); } catch {}
            }}
            onShareInApp={() => setShowShare(true)}
            onShareExternal={(url) => { try { console.log('[ActionBar] external share', url); } catch {} }}
            onTranscribe={() => {
              try { console.log('[ActionBar] open transcript/chapters', { id }); openPostModal(id, 'transcript'); } catch {}
            }}
            onTranslate={() => {
              try { console.log('[ActionBar] translate requested', { id }); openPostModal(id, 'translate'); } catch {}
            }}
          />
        )}

      </div>

      {/* Edit Modal */}
      <EditPostModal
        postId={id}
        initialContent={content}
        open={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSaved={(nextContent, meta) => {
          setContent(nextContent);
          if (meta?.editedAt) setEditedAt(meta.editedAt);
        }}
      />
      {/* In-app Share sheet */}
      {typeof window !== 'undefined' && (
        <ShareSheet
          open={showShare}
          onClose={() => setShowShare(false)}
          url={`${window.location.origin}/post/${id}`}
          title={content?.slice(0, 80) || 'Check out this post on Carrot'}
        />
      )}
      {/* Lightbox that reuses the same video element (no re-download) */}
      <Lightbox open={showLightbox} onClose={() => setShowLightbox(false)}>
        <div className="relative w-full" style={{ aspectRatio: '16 / 9' }} ref={lightboxMountRef} />
      </Lightbox>
    </div>
  );
});

// Lightbox Portal root appended to document body
function Lightbox({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (typeof window === 'undefined') return null;
  const root = document.getElementById('carrot-lightbox-root') || (() => {
    const el = document.createElement('div');
    el.id = 'carrot-lightbox-root';
    document.body.appendChild(el);
    return el;
  })();
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[1000] bg-black/80 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0" onClick={onClose} aria-hidden />
      <div className="relative z-10 max-w-5xl w-[92vw]">
        {children}
        <button
          className="absolute -top-10 right-0 text-white/80 hover:text-white text-sm"
          onClick={onClose}
          aria-label="Close video"
        >
          Close
        </button>
      </div>
    </div>
  , root);
}

export default React.memo(CommitmentCard);