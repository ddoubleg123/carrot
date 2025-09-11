// src/components/audio/AudioAnalyser.ts
// Lightweight Web Audio analyser wrapper with EMA smoothing and play/pause helpers

export type SmoothedAnalyser = {
  getRms: () => number; // 0..1
  getSpectrum: () => Float32Array; // normalized magnitudes 0..1
  destroy: () => void;
};

export function createAnalyserFromMedia(el: HTMLMediaElement, opts?: { fftSize?: number; ema?: number }): SmoothedAnalyser | null {
  try {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    const src = ctx.createMediaElementSource(el);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = Math.min(32768, Math.max(256, opts?.fftSize ?? 2048));
    analyser.smoothingTimeConstant = 0.8;

    // Meter node for RMS (time domain)
    const gain = ctx.createGain();
    gain.gain.value = 0; // do not route to speakers from here
    src.connect(analyser);
    src.connect(gain);
    gain.connect(ctx.destination);

    const timeData = new Uint8Array(analyser.fftSize);
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const normSpectrum = new Float32Array(analyser.frequencyBinCount);
    let smooth = 0;
    const alpha = Math.min(0.99, Math.max(0.01, opts?.ema ?? 0.15));

    function getRms() {
      analyser.getByteTimeDomainData(timeData);
      let sum = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = (timeData[i] - 128) / 128; // -1..1
        sum += v * v;
      }
      const rms = Math.sqrt(sum / timeData.length); // 0..1
      smooth = smooth * (1 - alpha) + rms * alpha;
      return Math.min(1, Math.max(0, smooth));
    }

    function getSpectrum() {
      analyser.getByteFrequencyData(freqData);
      for (let i = 0; i < freqData.length; i++) normSpectrum[i] = freqData[i] / 255;
      return normSpectrum;
    }

    function destroy() {
      try { src.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
      try { ctx.close(); } catch {}
    }

    return { getRms, getSpectrum, destroy };
  } catch {
    return null;
  }
}
