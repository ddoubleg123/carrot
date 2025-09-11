// src/components/audio/AudioAnalyser.ts
// Lightweight Web Audio analyser wrapper with EMA smoothing and robust, singleton AudioContext/MediaElementSource management

export type SmoothedAnalyser = {
  getRms: () => number; // 0..1
  getSpectrum: () => Float32Array; // normalized magnitudes 0..1
  destroy: () => void;
};

// Keep a single shared AudioContext across the entire app (and across HMR) to avoid device/renderer errors
declare global {
  // eslint-disable-next-line no-var
  var __carrotAudioCtx: AudioContext | null | undefined;
  // eslint-disable-next-line no-var
  var __carrotSrcMap: WeakMap<HTMLMediaElement, MediaElementAudioSourceNode> | undefined;
  // eslint-disable-next-line no-var
  var __carrotDestSet: WeakSet<HTMLMediaElement> | undefined;
}

// Dev helper: close and reset the shared context (use sparingly; mainly for /audio-lab)
export async function resetSharedAudioContext() {
  try {
    const ctx = globalThis.__carrotAudioCtx;
    if (ctx) {
      try { await (ctx as any).close?.(); } catch {}
    }
  } catch {}
  try { globalThis.__carrotAudioCtx = null; } catch {}
  try { globalThis.__carrotSrcMap = new WeakMap(); } catch {}
  try { globalThis.__carrotDestSet = new WeakSet(); } catch {}
}

function getSharedContext(): AudioContext | null {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    if (!Ctx) return null;
    if (!globalThis.__carrotAudioCtx) {
      globalThis.__carrotAudioCtx = new Ctx();
    }
    return globalThis.__carrotAudioCtx!;
  } catch { return null; }
}

function getSourceFor(el: HTMLMediaElement, ctx: AudioContext): MediaElementAudioSourceNode | null {
  try {
    if (!globalThis.__carrotSrcMap) globalThis.__carrotSrcMap = new WeakMap();
    if (!globalThis.__carrotDestSet) globalThis.__carrotDestSet = new WeakSet();
    const existing = globalThis.__carrotSrcMap.get(el);
    if (existing) return existing;
    const src = ctx.createMediaElementSource(el);
    globalThis.__carrotSrcMap.set(el, src);
    return src;
  } catch { return null; }
}

export async function ensureSharedContextRunning() {
  try {
    const ctx = getSharedContext();
    if (ctx && ctx.state === 'suspended') {
      try { await (ctx as any).resume?.(); } catch {}
    }
  } catch {}
}

export function createAnalyserFromMedia(el: HTMLMediaElement, opts?: { fftSize?: number; ema?: number }): SmoothedAnalyser | null {
  try {
    const ctx = getSharedContext();
    if (!ctx) return null;
    const src = getSourceFor(el, ctx);
    if (!src) return null;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = Math.min(32768, Math.max(256, opts?.fftSize ?? 2048));
    analyser.smoothingTimeConstant = 0.8;
    try { analyser.minDecibels = -90; analyser.maxDecibels = -10; } catch {}

    // Route to analyser (for visuals) AND directly to destination so audio remains audible
    // Important: connecting a MediaElementSource overrides default routing; we must connect to destination.
    try { src.connect(analyser); } catch {}
    try {
      if (!globalThis.__carrotDestSet!.has(el)) {
        src.connect(ctx.destination);
        globalThis.__carrotDestSet!.add(el);
      }
    } catch {}

    // Resume context on first user-initiated play (required by some browsers)
    const onPlay = () => {
      if (ctx.state === 'suspended') {
        try { (ctx as any).resume?.(); } catch {}
      }
    };
    try { el.addEventListener('play', onPlay, { once: true } as any); } catch {}

    const timeData = new Uint8Array(analyser.fftSize);
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const normSpectrum = new Float32Array(analyser.frequencyBinCount);
    let smooth = 0;
    const alpha = Math.min(0.99, Math.max(0.01, opts?.ema ?? 0.15));

    // Optional diagnostics (throttled) controlled by NEXT_PUBLIC_AUDIO_DIAG=1
    let lastDiag = 0;
    const diag = () => {
      if ((process.env.NEXT_PUBLIC_AUDIO_DIAG || '') !== '1') return;
      const now = Date.now();
      if (now - lastDiag < 500) return; // throttle
      lastDiag = now;
      try {
        const state = ctx.state;
        // log the last smoothed value (avoid recursive getRms call)
        const rms = Math.min(1, Math.max(0, smooth));
        // Use console.log to avoid noisy error channels
        console.log('[AudioDiag]', { state, rms: Number(rms.toFixed(3)) });
      } catch {}
    };

    function getRms() {
      analyser.getByteTimeDomainData(timeData);
      let sum = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = (timeData[i] - 128) / 128; // -1..1
        sum += v * v;
      }
      const rms = Math.sqrt(sum / timeData.length); // 0..1
      smooth = smooth * (1 - alpha) + rms * alpha;
      diag();
      return Math.min(1, Math.max(0, smooth));
    }

    function getSpectrum() {
      analyser.getByteFrequencyData(freqData);
      for (let i = 0; i < freqData.length; i++) normSpectrum[i] = freqData[i] / 255;
      return normSpectrum;
    }

    function destroy() {
      try { analyser.disconnect(); } catch {}
      // Do not close shared context here; it is reused across the app
    }

    return { getRms, getSpectrum, destroy };
  } catch {
    return null;
  }
}

// Diagnostics: oscillator-based analyser (no <audio> element required)
export function createAnalyserFromOscillator(opts?: { frequency?: number; fftSize?: number; ema?: number; gain?: number }): SmoothedAnalyser | null {
  try {
    const ctx = (function() { try { return (window.AudioContext || (window as any).webkitAudioContext) ? getSharedContext() : null; } catch { return null; } })();
    if (!ctx) return null;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = Math.min(2000, Math.max(50, opts?.frequency ?? 440));
    const gain = ctx.createGain();
    gain.gain.value = Math.min(1, Math.max(0, opts?.gain ?? 0.08)); // quiet
    const analyser = ctx.createAnalyser();
    analyser.fftSize = Math.min(32768, Math.max(256, opts?.fftSize ?? 2048));
    analyser.smoothingTimeConstant = 0.8;
    try { analyser.minDecibels = -90; analyser.maxDecibels = -10; } catch {}
    osc.connect(gain);
    gain.connect(analyser);
    gain.connect(ctx.destination);
    osc.start();

    const timeData = new Uint8Array(analyser.fftSize);
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const normSpectrum = new Float32Array(analyser.frequencyBinCount);
    let smooth = 0;
    const alpha = Math.min(0.99, Math.max(0.01, opts?.ema ?? 0.15));

    function getRms() {
      analyser.getByteTimeDomainData(timeData);
      let sum = 0; for (let i = 0; i < timeData.length; i++) { const v = (timeData[i]-128)/128; sum += v*v; }
      const rms = Math.sqrt(sum / timeData.length);
      smooth = smooth * (1 - alpha) + rms * alpha;
      return Math.min(1, Math.max(0, smooth));
    }
    function getSpectrum() {
      analyser.getByteFrequencyData(freqData);
      for (let i = 0; i < freqData.length; i++) normSpectrum[i] = freqData[i] / 255;
      return normSpectrum;
    }
    function destroy() {
      try { osc.stop(); } catch {}
      try { osc.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
      try { analyser.disconnect(); } catch {}
    }
    return { getRms, getSpectrum, destroy };
  } catch { return null; }
}
