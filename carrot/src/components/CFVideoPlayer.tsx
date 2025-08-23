"use client";
import React, { useEffect, useRef, useState } from "react";

// Types for the Cloudflare <stream> web component
declare global {
  namespace JSX {
    interface IntrinsicElements {
      stream: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src: string;
        controls?: boolean;
        autoplay?: boolean;
        muted?: boolean;
        loop?: boolean;
        playsinline?: boolean;
        poster?: string;
      };
    }
  }
  interface Window {
    __cfStreamSDKLoaded?: boolean;
  }
}

function useCloudflareStreamSDK() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.__cfStreamSDKLoaded) return;

    const id = "cf-stream-sdk";
    if (document.getElementById(id)) {
      window.__cfStreamSDKLoaded = true;
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = "https://embed.videodelivery.net/embed/sdk.latest.js";
    script.async = true;
    script.onload = () => {
      window.__cfStreamSDKLoaded = true;
    };
    document.head.appendChild(script);

    return () => {
      // keep script cached; do not remove
    };
  }, []);
}

export default function CFVideoPlayer({
  uid,
  autoPlay = true,
  muted = true,
  loop = true,
  poster,
  controls = true,
  trackSrc,
  trackLabel = "English",
  trackLang = "en",
  playbackUrlHls,
}: {
  uid?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  poster?: string;
  controls?: boolean;
  trackSrc?: string; // optional VTT captions URL
  trackLabel?: string;
  trackLang?: string;
  playbackUrlHls?: string;
}) {
  useCloudflareStreamSDK();
  const ref = useRef<HTMLElement | null>(null);
  // Start in fallback mode unless SDK is already loaded
  const [fallback, setFallback] = useState<boolean>(
    typeof window === 'undefined' ? true : !Boolean((window as any).__cfStreamSDKLoaded)
  );

  // Derive uid from playback URL if not provided
  const effectiveUid = React.useMemo(() => {
    if (uid) return uid;
    if (!playbackUrlHls) return undefined;
    try {
      const u = new URL(playbackUrlHls);
      // Expect formats like: https://videodelivery.net/<uid>/manifest/video.m3u8
      const parts = u.pathname.split('/').filter(Boolean);
      // parts = [uid, 'manifest', 'video.m3u8']
      if (parts.length >= 1) return parts[0];
    } catch {}
    return undefined;
  }, [uid, playbackUrlHls]);

  useEffect(() => {
    // iOS autoplay reliability
    if (ref.current) {
      // @ts-ignore - set attributes on custom element
      ref.current.setAttribute("playsinline", "");
    }
    try { console.debug('[CFVideoPlayer] mount uid=', effectiveUid, 'hls=', playbackUrlHls); } catch {}
  }, []);

  // Switch to <stream> as soon as SDK is ready and element upgrades
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkReady = () => {
      try {
        const loaded = Boolean((window as any).__cfStreamSDKLoaded);
        if (!loaded) {
          setFallback(true);
          return;
        }
        // Give the custom element a tick to upgrade
        requestAnimationFrame(() => {
          const el = ref.current as any;
          const upgraded = el && typeof (el as any).play === 'function';
          setFallback(!upgraded);
        });
      } catch {
        setFallback(true);
      }
    };

    // Initial check and a short retry window
    checkReady();
    const t1 = setTimeout(checkReady, 300);
    const t2 = setTimeout(checkReady, 1000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [effectiveUid]);

  return (
    <div style={{ width: "100%", display: "block" }}>
      {/* Maintain a stable 16:9 box so the custom element always has height */}
      <div style={{ position: "relative", width: "100%", paddingTop: '56.25%' }}>
        {(!effectiveUid) ? (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#00000010' }}>
            {(() => { try { console.debug('[CFVideoPlayer] Missing effectiveUid; uid=', uid, 'hls=', playbackUrlHls); } catch {} return null; })()}
            {poster ? (
              <img src={poster} alt="Video thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
            ) : (
              <span style={{ color: '#555', fontSize: 12 }}>Video unavailable</span>
            )}
          </div>
        ) : fallback ? (
          <iframe
            title="Cloudflare Stream"
            src={effectiveUid ? `https://iframe.videodelivery.net/${effectiveUid}` : undefined}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', border: 0, borderRadius: 12 }}
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <>
            {/* eslint-disable-next-line react/no-unknown-property */}
            {/* @ts-ignore custom element */}
            <stream
              ref={ref as any}
              src={effectiveUid as any}
              controls={controls as any}
              muted={muted as any}
              autoplay={autoPlay as any}
              loop={loop as any}
              playsinline
              poster={poster}
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", display: "block", borderRadius: 12 }}
            >
              {trackSrc ? (
                <track kind="captions" srcLang={trackLang} label={trackLabel} default src={trackSrc} />
              ) : null}
            </stream>
          </>
        )}
      </div>
    </div>
  );
}
