"use client";

import React, { useEffect, useRef, useState } from "react";
import FeedMediaManager, { VideoHandle } from "./FeedMediaManager";

export type HlsFeedPlayerProps = {
  assetId: string;
  hlsMasterUrl?: string | null; // Cloudflare Stream or CDN HLS master
  posterUrl?: string | null;
  captionVttUrl?: string | null;
  autoPlay?: boolean;
  muted?: boolean;
  onQoE?: (e: { type: string; value?: any }) => void;
  onError?: (e: Error) => void;
  className?: string;
  onVideoRef?: (el: HTMLVideoElement | null) => void;
};

// Lightweight HLS player for feed tiles.
// - Uses native HLS on Safari.
// - Attempts to dynamically import hls.js for non-Safari; if unavailable, falls back to native/video tag (progressive URLs).
// - Keeps teardown simple to free the decoder quickly.
export default function HlsFeedPlayer({
  assetId,
  hlsMasterUrl,
  posterUrl,
  captionVttUrl,
  autoPlay = false,
  muted = true,
  onQoE,
  onError,
  className = "",
  onVideoRef,
}: HlsFeedPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const setVideoRef = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    try { onVideoRef?.(el); } catch {}
  };
  const [ready, setReady] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const firstFrameSentRef = useRef<boolean>(false);
  const [shouldWarm, setShouldWarm] = useState(false);
  const hlsRef = useRef<any>(null);
  const myHandleRef = useRef<VideoHandle | null>(null);
  const stateRef = useRef<'idle' | 'warm' | 'active'>('idle');
  const lastDroppedRef = useRef<number>(0);

  // Read preferences from localStorage (reduced motion, captions default, network profile)
  const getReducedMotion = () => {
    try { return localStorage.getItem('carrot_reduced_motion') === '1'; } catch { return false; }
  };
  const getAutoplayDefault = () => {
    try {
      const v = localStorage.getItem('carrot_autoplay_default');
      if (v === 'off') return false;
      if (v === 'on') return true;
      return true; // default on
    } catch { return true; }
  };
  const getCaptionsDefault = () => {
    try { return (localStorage.getItem('carrot_captions_default') || 'off') === 'on'; } catch { return false; }
  };
  const getStartLevelPref = (): number => {
    try {
      const raw = localStorage.getItem('carrot_net_profile');
      if (!raw) return 0;
      const obj = JSON.parse(raw);
      const lvl = typeof obj?.startLevelPreferred === 'number' ? obj.startLevelPreferred : 0;
      return Math.max(0, Math.min(1, lvl));
    } catch { return 0; }
  };
  const setStartLevelPref = (lvl: number) => {
    try {
      const obj = { startLevelPreferred: Math.max(0, Math.min(1, Math.floor(lvl))) };
      localStorage.setItem('carrot_net_profile', JSON.stringify(obj));
    } catch {}
  };

  // Rolling 7-day profile helpers
  type NetProfile = {
    updatedAt: number; // ms epoch
    ttl: number; // ms
    avgDownlinkMbps: number; // ewma
    startupP95msApprox: number; // ewma approximation
    rebufferMs: number; // accumulated stall
    watchMs: number; // accumulated watch time
    plays: number; // count of plays sampled
    lastStartLevel: number; // 0|1
  };
  const NET_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  const NP_KEY = 'carrot_net_profile_ext_v1';
  const loadNetProfile = (): NetProfile | null => {
    try {
      const raw = localStorage.getItem(NP_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw) as NetProfile;
      if (!obj || typeof obj.updatedAt !== 'number') return null;
      if (Date.now() - obj.updatedAt > (obj.ttl || NET_TTL)) return null;
      return obj;
    } catch { return null; }
  };
  const saveNetProfile = (np: NetProfile) => {
    try { localStorage.setItem(NP_KEY, JSON.stringify(np)); } catch {}
  };
  const ewma = (prev: number, next: number, alpha = 0.2) => (prev === 0 ? next : (alpha * next + (1 - alpha) * prev));
  const updateNetProfile = (startupMs?: number, startLevel?: number, deltaRebufferMs?: number, deltaWatchMs?: number) => {
    try {
      const conn: any = (navigator as any)?.connection || (navigator as any)?.mozConnection || (navigator as any)?.webkitConnection;
      const down = typeof conn?.downlink === 'number' ? conn.downlink : 0;
      const prev = loadNetProfile() || { updatedAt: 0, ttl: NET_TTL, avgDownlinkMbps: 0, startupP95msApprox: 0, rebufferMs: 0, watchMs: 0, plays: 0, lastStartLevel: 0 };
      const next: NetProfile = {
        updatedAt: Date.now(),
        ttl: NET_TTL,
        avgDownlinkMbps: ewma(prev.avgDownlinkMbps, down || prev.avgDownlinkMbps || 0),
        startupP95msApprox: startupMs ? Math.round(ewma(prev.startupP95msApprox, startupMs)) : prev.startupP95msApprox,
        rebufferMs: Math.max(0, (prev.rebufferMs || 0) + (deltaRebufferMs || 0)),
        watchMs: Math.max(0, (prev.watchMs || 0) + (deltaWatchMs || 0)),
        plays: (prev.plays || 0) + (startupMs ? 1 : 0),
        lastStartLevel: typeof startLevel === 'number' ? startLevel : prev.lastStartLevel,
      };
      saveNetProfile(next);
    } catch {}
  };

  const sendRum = (evt: { type: string; value?: any }) => {
    try {
      onQoE?.(evt);
      const payload = JSON.stringify({ assetId, ...evt });
      if (navigator?.sendBeacon) {
        const blob = new Blob([payload], { type: 'application/json' });
        navigator.sendBeacon('/api/rum', blob);
      } else {
        fetch('/api/rum', { method: 'POST', body: payload, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {});
      }
    } catch {}
  };

  // Helper to detect native HLS support (Safari)
  const canUseNativeHls = () => {
    try {
      const v = document.createElement("video") as any;
      return Boolean(v.canPlayType && v.canPlayType("application/vnd.apple.mpegurl"));
    } catch {
      return false;
    }
  };

  useEffect(() => {
    let destroyed = false;
    const video = videoRef.current;
    if (!video) return;
    let stallStart: number | null = null;
    let lastWatchTick = performance.now();

    // Basic attributes for feed UX
    video.playsInline = true;
    video.muted = muted;
    video.preload = "none";
    video.crossOrigin = "anonymous";

    async function attach() {
      if (!hlsMasterUrl) { setReady(true); return; }

      if (canUseNativeHls()) {
        try {
          const el = videoRef.current; if (!el) return;
          // Tiny jitter to avoid bursty loads when many tiles enter view simultaneously
          try { await new Promise(r => setTimeout(r, Math.floor(Math.random() * 80))); } catch {}
          el.src = hlsMasterUrl;
          setReady(true);
          const honorAutoPlay = autoPlay && !getReducedMotion() && getAutoplayDefault();
          if (honorAutoPlay) {
            await el.play().catch(() => {});
          }
          // rVFC-based first frame timing for native path
          const onFrame = () => {
            if (!firstFrameSentRef.current) {
              firstFrameSentRef.current = true;
              const start = startedAtRef.current || performance.now();
              const ms = performance.now() - start;
              sendRum({ type: 'first_frame_ms', value: ms });
              if (ms <= 200) setStartLevelPref(1); else if (ms > 400) setStartLevelPref(0);
              try { updateNetProfile(ms, getStartLevelPref()); } catch {}
            }
            el.requestVideoFrameCallback?.(() => {});
          };
          try { el.requestVideoFrameCallback?.(onFrame); } catch {}
        } catch (e: any) {
          onError?.(e);
          sendRum({ type: 'error', value: { message: e?.message || 'native hls error' } });
        }
        return;
      }

      // Try dynamic import of hls.js (now installed)
      let Hls: any = null;
      try {
        const mod: any = await import('hls.js');
        Hls = mod?.default || mod;
      } catch {
        console.warn("hls.js import failed; falling back to native video element");
      }

      if (!Hls || !Hls.isSupported?.()) {
        // Fallback: try direct assignment (works for progressive URLs)
        try {
          const el2 = videoRef.current; if (!el2) return;
          try { await new Promise(r => setTimeout(r, Math.floor(Math.random() * 80))); } catch {}
          el2.src = hlsMasterUrl;
          setReady(true);
          const honorAutoPlay = autoPlay && !getReducedMotion();
          if (honorAutoPlay) {
            await el2.play().catch(() => {});
          }
        } catch (e: any) {
          onError?.(e);
          sendRum({ type: 'error', value: { message: e?.message || 'fallback attach error' } });
        }
        return;
      }

      const hls = new Hls({
        lowLatencyMode: false,
        startLevel: getStartLevelPref(),
        capLevelOnFPSDrop: true,
        maxBufferLength: 10,
        backBufferLength: 10,
      });
      hlsRef.current = hls;

      const el = videoRef.current; if (!el) return;
      hls.attachMedia(el);
      hls.on(Hls.Events.MEDIA_ATTACHED, async () => {
        try {
          // Jitter before starting load to smooth multi-tile attach
          await new Promise(r => setTimeout(r, Math.floor(Math.random() * 80)));
          hls.loadSource(hlsMasterUrl);
        } catch {}
      });
      hls.on(Hls.Events.MANIFEST_PARSED, async () => {
        // Resolution-aware start: choose the largest level not exceeding container size
        try {
          const rect = videoRef.current?.getBoundingClientRect();
          const cw = Math.max(1, Math.floor(rect?.width || 320));
          const ch = Math.max(1, Math.floor(rect?.height || 180));
          const levels = (hls as any)?.levels || [];
          if (levels.length > 0) {
            let bestIdx = 0;
            let bestW = 0;
            for (let i = 0; i < levels.length; i++) {
              const L = levels[i];
              const w = L?.width || 0;
              const h = L?.height || 0;
              if (w <= cw + 8 && h <= ch + 8 && w >= bestW) { bestW = w; bestIdx = i; }
            }
            if (bestW === 0) {
              // fallback: lowest bandwidth index
              bestIdx = levels.reduce((m: number, _l: any, i: number) => i < m ? i : m, 0);
            }
            try { (hls as any).currentLevel = bestIdx; } catch {}
            try { (hls as any).autoLevelCapping = bestIdx; } catch {}
          }
        } catch {}
        setReady(true);
        const honorAutoPlay = autoPlay && !getReducedMotion() && getAutoplayDefault();
        if (honorAutoPlay) {
          try { await el.play(); } catch {}
        }
        // If this tile is in Warm state, pull some data then park
        if (shouldWarm) {
          try {
            (hls as any).startLoad?.();
            setTimeout(() => { try { (hls as any).stopLoad?.(); } catch {} }, 800);
          } catch {}
        }
      });
      // RUM hook for first frame heuristic
      const onFrame = () => {
        if (!firstFrameSentRef.current) {
          firstFrameSentRef.current = true;
          const start = startedAtRef.current || performance.now();
          const ms = performance.now() - start;
          onQoE?.({ type: 'first_frame_ms', value: ms });
          if (ms <= 200) setStartLevelPref(1); else if (ms > 400) setStartLevelPref(0);
          try { updateNetProfile(ms, getStartLevelPref()); } catch {}
        }
        el.requestVideoFrameCallback?.(() => {});
      };
      try { el.requestVideoFrameCallback?.(onFrame); } catch {}
      hls.on(Hls.Events.ERROR, (_evt: any, data: any) => {
        console.warn("HLS error", data);
        if (data?.fatal) {
          try { hls.destroy(); } catch {}
          const err = new Error(data?.details || "HLS fatal error");
          onError?.(err);
          sendRum({ type: 'error', value: { message: err.message, details: data?.details } });
        }
      });

      // Teardown
      return () => {
        try {
          hls.stopLoad();
          hls.detachMedia();
          hls.destroy();
        } catch {}
      };
    }

    startedAtRef.current = performance.now();
    // Stall/waiting tracking
    const onWaiting = () => { stallStart = performance.now(); };
    const onPlaying = () => {
      if (stallStart != null) {
        const delta = performance.now() - stallStart;
        try { updateNetProfile(undefined, undefined, delta, 0); } catch {}
        try { sendRum({ type: 'rebuffer_ms', value: Math.round(delta) }); } catch {}
        try { sendRum({ type: 'rebuffer_count', value: 1 }); } catch {}
        stallStart = null;
      }
    };
    const onTimeUpdate = () => {
      const now = performance.now();
      const dt = now - lastWatchTick;
      lastWatchTick = now;
      if (!video.paused && !video.seeking) {
        try { updateNetProfile(undefined, undefined, 0, dt); } catch {}
      }
    };
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('timeupdate', onTimeUpdate);

    const cleanup: any = attach();

    return () => {
      destroyed = true;
      const el2 = videoRef.current;
      try { el2?.pause(); } catch {}
      try { el2?.removeAttribute("src"); el2?.load(); } catch {}
      try {
        video.removeEventListener('waiting', onWaiting);
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('timeupdate', onTimeUpdate);
      } catch {}
      if (typeof cleanup === "function") cleanup();
      try { onVideoRef?.(null); } catch {}
    };
  }, [assetId, hlsMasterUrl, autoPlay, muted]);

  // Register handle with FeedMediaManager so Warm/Active can be controlled
  useEffect(() => {
    const el = (videoRef.current as unknown as Element) || undefined;
    if (!el) return;
    const handle: VideoHandle = {
      id: assetId,
      el,
      play: async () => {
        const from = stateRef.current;
        try { hlsRef.current?.startLoad?.(); } catch {}
        try { await videoRef.current?.play(); } catch {}
        if (from !== 'active') {
          try { sendRum({ type: 'state_transition', value: { from, to: 'active' } }); } catch {}
          stateRef.current = 'active';
        }
      },
      pause: () => { try { videoRef.current?.pause(); } catch {} },
      setPaused: () => {
        try { 
          videoRef.current?.pause(); 
          hlsRef.current?.stopLoad?.();
        } catch {}
      },
      release: () => {
        const from = stateRef.current;
        try {
          if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.removeAttribute('src');
            videoRef.current.load();
          }
          try { hlsRef.current?.stopLoad?.(); } catch {}
          try { hlsRef.current?.destroy?.(); hlsRef.current = null; } catch {}
        } catch {}
        if (from !== 'idle') {
          try { sendRum({ type: 'state_transition', value: { from, to: 'idle' } }); } catch {}
          stateRef.current = 'idle';
        }
      }
    };
    FeedMediaManager.inst.registerHandle(el, handle);
    myHandleRef.current = handle;
    return () => { FeedMediaManager.inst.unregisterHandle(el); };
  }, [assetId, hlsMasterUrl]);

  // Sample dropped frames periodically for RUM
  useEffect(() => {
    const v = videoRef.current as any;
    if (!v) return;
    let timer: any = null;
    const sample = () => {
      try {
        const q = typeof v.getVideoPlaybackQuality === 'function' ? v.getVideoPlaybackQuality() : null;
        const dropped = q && typeof q.droppedVideoFrames === 'number' ? q.droppedVideoFrames : 0;
        if (dropped > lastDroppedRef.current) {
          const delta = dropped - lastDroppedRef.current;
          lastDroppedRef.current = dropped;
          try { sendRum({ type: 'dropped_frames', value: delta }); } catch {}
        }
      } catch {}
      timer = setTimeout(sample, 2000);
    };
    timer = setTimeout(sample, 2000);
    return () => { try { clearTimeout(timer); } catch {} };
  }, [assetId]);

  // Ensure only one video plays at a time; pause when scrolled away
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onPlay = () => {
      const h = myHandleRef.current || (el ? FeedMediaManager.inst.getHandleByElement(el as any) : undefined);
      if (h) FeedMediaManager.inst.setActive(h);
    };
    el.addEventListener('play', onPlay);

    const io = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const visible = entry.intersectionRatio >= 0.5;
      if (!visible) {
        try { el.pause(); } catch {}
      }
    }, { threshold: [0, 0.5, 1] });
    io.observe(el);
    return () => {
      try { el.removeEventListener('play', onPlay); } catch {}
      try { io.disconnect(); } catch {}
    };
  }, [assetId]);

  return (
    <div className={`relative w-full ${className}`}>
      <video
        ref={setVideoRef}
        poster={posterUrl ?? undefined}
        playsInline
        muted={muted}
        controls
        className="w-full rounded-xl bg-black"
      >
        {captionVttUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <track
            kind="subtitles"
            src={captionVttUrl}
            srcLang="en"
            label="English"
            default={getCaptionsDefault()}
          />
        ) : null}
      </video>
      {!ready && (
        <div className="absolute inset-0 grid place-items-center text-white/80 text-sm">
          Loading…
        </div>
      )}
    </div>
  );
}
