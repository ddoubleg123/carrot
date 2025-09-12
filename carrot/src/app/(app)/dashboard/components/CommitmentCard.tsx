"use client";

import React, { useMemo, useState, forwardRef, useRef, useEffect } from "react";
import { ChatBubbleOvalLeftIcon as ChatBubbleLeftIcon, ShareIcon, EllipsisHorizontalIcon } from "@heroicons/react/24/outline";
import AudioPlayerCard from "../../../../components/AudioPlayerCard";
import AudioHero from "../../../../components/audio/AudioHero";
import { createAnalyserFromMedia } from "../../../../components/audio/AudioAnalyser";
import CFVideoPlayer from "../../../../components/CFVideoPlayer";
import HlsFeedPlayer from "../../../../components/video/HlsFeedPlayer";
import VideoPlayer from "./VideoPlayer";
import EditPostModal from "../../../../components/EditPostModal";
import FlagChip from "../../../../components/flags/FlagChip";
import { useModalRoute } from "../../../../hooks/useModalRoute";
import PostActionBar from "../../../../components/post/PostActionBar";
import ShareSheet from "../../../../components/share/ShareSheet";

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
    author,
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

  // Local content and edit state (kept minimal to avoid bloating the card)
  const [content, setContent] = useState<string>(props.content || "");
  const [editedAt, setEditedAt] = useState<string | null | undefined>(props.editedAt);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const analyserRef = useRef<ReturnType<typeof createAnalyserFromMedia> | null>(null);
  const { openPostModal } = useModalRoute();

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

  return (
    <div
      ref={ref}
      data-commitment-id={id}
      data-hls-master={cfPlaybackUrlHls || undefined}
      className={['bg-transparent', className].filter(Boolean).join(' ')}
      {...dataAttrs}
      {...filterRootDivProps(rest as Record<string, any>)}
      style={undefined}
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
              <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-100">
                {author?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={author.avatar} alt={author?.username || "user"} className="h-full w-full object-cover" />
                ) : null}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-gray-900 truncate">
                  {author?.username ? (author.username.startsWith("@") ? author.username : `@${author.username}`) : "@user"}
                </span>
                {props.homeCountry ? (<FlagChip countryCode={props.homeCountry} />) : null}
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
        {gifUrl ? (
          <div className="mt-3 cursor-pointer" onClick={() => openPostModal(id)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={gifUrl} alt="gif" className="w-full rounded-xl" />
          </div>
        ) : imageUrls && imageUrls.length > 0 ? (
          <div className="mt-3 grid grid-cols-2 gap-2 cursor-pointer" onClick={() => openPostModal(id)}>
            {imageUrls.slice(0, 4).map((u, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={u} alt={`img-${i}`} className="w-full h-48 object-cover rounded-xl" />
            ))}
          </div>
        ) : null}

        {/* Video */}
        {(cfUid || cfPlaybackUrlHls || videoUrl) && (
          <div className="mt-3 relative">
            {(() => {
              const useHls = process.env.NEXT_PUBLIC_FEED_HLS === '1' && !!cfPlaybackUrlHls;
              if (useHls) {
                return (
                  <HlsFeedPlayer
                    assetId={id}
                    hlsMasterUrl={cfPlaybackUrlHls || undefined}
                    posterUrl={thumbnailUrl || undefined}
                    captionVttUrl={captionVttUrl || undefined}
                    autoPlay
                    muted
                    className="rounded-xl overflow-hidden"
                  />
                );
              }
              if (cfUid || cfPlaybackUrlHls) {
                return (
                  <CFVideoPlayer
                    uid={cfUid || undefined}
                    playbackUrlHls={cfPlaybackUrlHls || undefined}
                    poster={thumbnailUrl || undefined}
                    autoPlay
                    muted
                    loop
                    controls
                    trackSrc={captionVttUrl || undefined}
                  />
                );
              }
              return (
                <VideoPlayer
                  videoUrl={videoUrl || ""}
                  thumbnailUrl={thumbnailUrl || undefined}
                  postId={id}
                  initialTranscription={audioTranscription || undefined}
                  transcriptionStatus={transcriptionStatus || undefined}
                  uploadStatus={uploadStatus || null}
                  uploadProgress={uploadProgress || 0}
                />
              );
            })()}
            {/* Click overlay: leave bottom ~48px for native controls */}
            <button
              type="button"
              className="absolute inset-x-0 top-0 bottom-12 z-10 cursor-pointer bg-transparent"
              aria-label="Open post"
              title="Open post"
              onClick={() => openPostModal(id)}
            />
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

        {/* Actions */}
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
    </div>
  );
});

export default CommitmentCard;