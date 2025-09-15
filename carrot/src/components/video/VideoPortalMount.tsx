"use client";

import React, { useEffect, useRef } from 'react';

/**
 * VideoPortalMount
 *
 * Renders a stable DOM container the feed can adopt its existing <video> element into,
 * enabling seamless playback continuity without rebuffer when opening a post modal.
 *
 * Events:
 *  - On mount:  window.dispatchEvent(new CustomEvent('carrot-video-portal-ready', { detail: { postId } }))
 *  - On unmount: window.dispatchEvent(new CustomEvent('carrot-video-portal-dismiss', { detail: { postId } }))
 */
export default function VideoPortalMount({ postId, className }: { postId: string; className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent('carrot-video-portal-ready', { detail: { postId } }));
    } catch {}
    return () => {
      try {
        window.dispatchEvent(new CustomEvent('carrot-video-portal-dismiss', { detail: { postId } }));
      } catch {}
    };
  }, [postId]);

  return (
    <div
      ref={ref}
      data-video-portal-for={postId}
      className={className || ''}
      style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9' }}
    />
  );
}
