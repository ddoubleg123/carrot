"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import AudioPlayer from "../../components/AudioPlayer";
import AudioHero from "../../components/audio/AudioHero";
import PlainCanvasDebug from "../../components/audio/PlainCanvasDebug";
import { createAnalyserFromMedia, resetSharedAudioContext, ensureSharedContextRunning, createAnalyserFromOscillator } from "../../components/audio/AudioAnalyser";
import CardVisualizer from "../../components/audio/CardVisualizer";

export default function AudioLabPage() {
  const [src, setSrc] = useState<string>("/api/tone?f=440&d=6");
  // IMPORTANT: avoid reading localStorage during SSR to prevent hydration mismatch
  const [style, setStyle] = useState<string>('liquid');
  const [diag, setDiag] = useState<boolean>(() => (process.env.NEXT_PUBLIC_AUDIO_DIAG === '1'));
  const [isPlaying, setIsPlaying] = useState(false);
  const [rms, setRms] = useState(0);
  const [fftMax, setFftMax] = useState(0);
  const [useOsc, setUseOsc] = useState(false);
  const [ctxState, setCtxState] = useState<string>('');
  const [sampleOnce, setSampleOnce] = useState<number | null>(null);
  const [plain, setPlain] = useState<boolean>(() => (
    (typeof window === 'undefined' ? false : new URLSearchParams(window.location.search).get('plain') === '1') ||
    (process.env.NEXT_PUBLIC_AUDIO_PLAIN === '1')
  ));
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<ReturnType<typeof createAnalyserFromMedia> | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    // Hydrate style from localStorage AFTER mount to avoid SSR/client mismatch
    try {
      const saved = localStorage.getItem('carrot_audio_field_style');
      if (saved && (saved === 'arc' || saved === 'radial' || saved === 'liquid')) {
        setStyle(saved);
      }
      // Force animations on inside the lab to rule out reduced-motion
      localStorage.setItem('carrot_audio_anim_force','1');
      // Try to resume shared context on mount
      ensureSharedContextRunning();
      // poll shared ctx state for display
      const id = setInterval(() => {
        try { setCtxState((window as any).__carrotAudioCtx?.state || ''); } catch {}
      }, 500);
      // Auto-enable oscillator mode on lab open so visuals should animate immediately
      setUseOsc(true);
      // Fetch real avatar URL for canvas rendering
      fetch('/api/me/avatar').then(async (r) => {
        try {
          const j = await r.json().catch(() => null);
          if (j?.ok) setAvatarUrl(j.avatar || null);
        } catch {}
      }).catch(()=>{});
      return () => clearInterval(id);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('carrot_audio_field_style', style); } catch {}
  }, [style]);

  // diagnostics loop
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      if (analyserRef.current) {
        try {
          const v = analyserRef.current.getRms();
          setRms(v);
          const A = analyserRef.current.getSpectrum();
          let m = 0; for (let i = 0; i < A.length; i++) m = Math.max(m, A[i]);
          setFftMax(m);
        } catch {}
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Respond to oscillator toggle
  useEffect(() => {
    try {
      if (useOsc) {
        // Stop feeding from <audio>, use oscillator-driven analyser
        analyserRef.current?.destroy?.();
        ensureSharedContextRunning();
        let a = createAnalyserFromOscillator({ frequency: 440, gain: 0.2 });
        if (!a) {
          // Fallback synthetic analyser so visuals always move in lab
          console.log('[AudioLab] Oscillator analyser creation returned null; using synthetic fallback');
          const start = performance.now();
          const spec = new Float32Array(512);
          a = {
            getRms: () => {
              const t = (performance.now() - start) / 1000;
              return 0.4 + 0.35 * Math.abs(Math.sin(t * Math.PI));
            },
            getSpectrum: () => {
              for (let i = 0; i < spec.length; i++) spec[i] = Math.random() * 0.6;
              return spec;
            },
            destroy: () => {}
          } as any;
        }
        analyserRef.current = a as any;
        // Pause audio element if playing
        try { audioElRef.current?.pause?.(); } catch {}
        setIsPlaying(true);
      } else {
        // If we have an audio element, reattach analyser from media
        const el = audioElRef.current;
        if (el) {
          analyserRef.current?.destroy?.();
          ensureSharedContextRunning();
          const a = createAnalyserFromMedia(el);
          analyserRef.current = a;
        } else {
          analyserRef.current?.destroy?.();
          analyserRef.current = null;
        }
      }
    } catch {}
  }, [useOsc]);

  // Keepalive: if useOsc is on but analyser is missing, create it
  useEffect(() => {
    if (!useOsc) return;
    if (analyserRef.current) return;
    try {
      ensureSharedContextRunning();
      let a = createAnalyserFromOscillator({ frequency: 440, gain: 0.2 });
      if (!a) {
        console.log('[AudioLab] keepalive: analyser null; using synthetic fallback');
        const start = performance.now();
        const spec = new Float32Array(512);
        a = {
          getRms: () => {
            const t = (performance.now() - start) / 1000;
            return 0.4 + 0.35 * Math.abs(Math.sin(t * Math.PI));
          },
          getSpectrum: () => {
            for (let i = 0; i < spec.length; i++) spec[i] = Math.random() * 0.6;
            return spec;
          },
          destroy: () => {}
        } as any;
      }
      analyserRef.current = a as any;
      setIsPlaying(true);
      console.log('[AudioLab] analyser attached');
    } catch {}
  }, [useOsc]);

  const attach = (el: HTMLAudioElement | null) => {
    audioElRef.current = el;
    try {
      if (!el) { analyserRef.current?.destroy?.(); analyserRef.current = null; return; }
      if (useOsc) { return; } // when in oscillator mode, do not rewire to media
      if ((el as any).dataset?.analyserAttached !== '1') {
        analyserRef.current?.destroy?.();
        ensureSharedContextRunning();
        const a = createAnalyserFromMedia(el);
        analyserRef.current = a;
        try { (el as any).dataset.analyserAttached = '1'; } catch {}
      }
    } catch {}
  };

  const resetAudio = async () => {
    await resetSharedAudioContext();
    analyserRef.current = null;
    if (audioElRef.current) {
      try { delete (audioElRef.current as any).dataset?.analyserAttached; } catch {}
    }
  };

  // Expose debug handles
  useEffect(() => {
    (window as any).__lab = {
      setUseOsc,
      ensureSharedContextRunning,
      spawnOsc: () => {
        try {
          analyserRef.current?.destroy?.();
          let a = createAnalyserFromOscillator({ frequency: 440, gain: 0.2 });
          if (!a) {
            console.log('[AudioLab] spawnOsc: analyser null; using synthetic fallback');
            const start = performance.now();
            const spec = new Float32Array(512);
            a = {
              getRms: () => {
                const t = (performance.now() - start) / 1000;
                return 0.4 + 0.35 * Math.abs(Math.sin(t * Math.PI));
              },
              getSpectrum: () => {
                for (let i = 0; i < spec.length; i++) spec[i] = Math.random() * 0.6;
                return spec;
              },
              destroy: () => {}
            } as any;
          }
          analyserRef.current = a as any;
          setUseOsc(true);
          setIsPlaying(true);
        } catch {}
      },
    };
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Audio Lab</h1>
      <p className="text-sm text-gray-600">Pick a source, play, and see live analyser values. Toggle styles (arc/radial/liquid). Use Reset if audio pipeline ever stalls in dev.</p>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Source</label>
        <div className="flex gap-2 flex-wrap">
          <button className="px-3 py-1 rounded bg-gray-100" onClick={() => setSrc('/api/tone?f=440&d=6')}>Tone 440</button>
          <button className="px-3 py-1 rounded bg-gray-100" onClick={() => setSrc('/api/tone?f=880&d=6')}>Tone 880</button>
          <button className="px-3 py-1 rounded bg-gray-100" onClick={() => setSrc('/api/proxy-audio?url=' + encodeURIComponent('https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'))}>Proxy MP3</button>
        </div>
        <input className="w-full border rounded px-2 py-1" placeholder="Custom URL (e.g., /api/audio?url=...)" value={src} onChange={(e) => setSrc(e.target.value)} />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Diagnostics mode</label>
        <div className="flex items-center gap-3 text-sm">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={useOsc} onChange={(e) => setUseOsc(e.target.checked)} />
            <span>Use oscillator (bypass &lt;audio&gt;)</span>
          </label>
          <button className="px-3 py-1 rounded bg-gray-100" onClick={() => (window as any).__lab?.spawnOsc?.()}>Spawn Oscillator Visual</button>
          <label className="inline-flex items-center gap-2 ml-4">
            <input type="checkbox" checked={plain} onChange={(e) => setPlain(e.target.checked)} />
            <span>Plain Canvas Debug</span>
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Field style</label>
        <div className="flex gap-2">
          {['arc','radial','liquid'].map(s => (
            <button key={s} className={`px-3 py-1 rounded ${style===s?'bg-orange-500 text-white':'bg-gray-100'}`} onClick={() => setStyle(s)}>{s}</button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Diagnostics</label>
        <div className="flex items-center gap-3 text-sm">
          <span>RMS: {rms.toFixed(3)}</span>
          <span>FFT max: {fftMax.toFixed(3)}</span>
          <button className="px-3 py-1 rounded bg-gray-100" onClick={resetAudio}>Reset Audio</button>
          <button className="px-3 py-1 rounded bg-gray-100" onClick={() => ensureSharedContextRunning()}>Kick Context</button>
          <span className="opacity-70">Ctx: {ctxState || 'n/a'}</span>
          <span className="opacity-70">Attached: {analyserRef.current ? 'yes' : 'no'}</span>
          <button className="px-3 py-1 rounded bg-gray-100" onClick={() => { try { const v = analyserRef.current?.getRms?.() ?? 0; setSampleOnce(v); } catch { setSampleOnce(-1); } }}>Sample once</button>
          {sampleOnce !== null && <span className="opacity-70">RMS once: {sampleOnce.toFixed(3)}</span>}
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden">
        {/* Plain debug overlay (fixed, above all) */}
        <PlainCanvasDebug analyser={analyserRef.current as any} visible={plain} />
        <div className="relative h-56" style={{ background: 'linear-gradient(135deg,#FF6A00,#0A5AFF)', minWidth: '100%' }}>
          {/* Single-canvas visualizer to avoid layering/whitespace issues */}
          <CardVisualizer analyser={analyserRef.current as any} style={style as any} intensity={0.95} avatarSrc={avatarUrl} />
        </div>
        <div className="p-4 bg-white/95">
          <AudioPlayer audioUrl={src} onPlayStateChange={setIsPlaying} onAudioRef={attach} showWaveform={false} />
        </div>
      </div>
    </div>
  );
}
