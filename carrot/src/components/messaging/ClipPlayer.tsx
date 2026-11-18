'use client';

import { useEffect, useRef, useState } from 'react';

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const rounded = Math.floor(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

export default function ClipPlayer({
  src,
  kind,
  mine = false,
  transcript,
  transcriptState,
}: {
  src: string;
  kind: 'audio' | 'video';
  mine?: boolean;
  transcript?: string;
  transcriptState?: 'pending' | 'ready' | 'silent' | 'failed';
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setPlaying(false);
    setTime(0);
    setDuration(0);
    setFailed(false);
  }, [src]);

  function rememberDuration(audio: HTMLAudioElement) {
    if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
  }

  const note =
    transcriptState === 'pending'
      ? 'Transcribing…'
      : transcriptState === 'failed'
        ? "Couldn't transcribe this one."
        : transcript || '';

  return (
    <div className="mb-1 w-[260px] max-w-full">
      {kind === 'video' ? (
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          className="max-h-64 w-full rounded-xl bg-black"
        />
      ) : failed ? (
        <p className={`rounded-full px-3 py-2 text-xs ${mine ? 'bg-white/15' : 'bg-gray-100'}`}>
          Couldn't play this recording.
        </p>
      ) : (
        <div className={`flex items-center gap-2 rounded-full px-2 py-1.5 ${mine ? 'bg-white/15' : 'bg-gray-100'}`}>
          <button
            type="button"
            aria-label={playing ? 'Pause voice message' : 'Play voice message'}
            onClick={() => {
              const audio = audioRef.current;
              if (!audio) return;
              if (audio.paused) void audio.play();
              else audio.pause();
            }}
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm ${
              mine ? 'bg-white text-orange-600' : 'bg-orange-500 text-white'
            }`}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(time, duration || 0)}
            aria-label="Voice message position"
            onChange={(event) => {
              const audio = audioRef.current;
              const next = Number(event.target.value);
              if (audio) audio.currentTime = next;
              setTime(next);
            }}
            className={`h-1 min-w-0 flex-1 ${mine ? 'accent-white' : 'accent-orange-500'}`}
          />
          <span className={`w-9 shrink-0 text-right text-[11px] tabular-nums ${mine ? 'text-orange-50' : 'text-gray-500'}`}>
            {formatTime(playing || time > 0 ? time : duration)}
          </span>
          <audio
            ref={audioRef}
            src={src}
            preload="metadata"
            onLoadedMetadata={(event) => rememberDuration(event.currentTarget)}
            onDurationChange={(event) => rememberDuration(event.currentTarget)}
            onTimeUpdate={(event) => {
              rememberDuration(event.currentTarget);
              setTime(event.currentTarget.currentTime);
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onError={() => setFailed(true)}
          />
        </div>
      )}
      {note ? <p className={`mt-1 whitespace-pre-wrap break-words text-xs ${mine ? 'text-orange-50' : 'text-gray-600'}`}>{note}</p> : null}
    </div>
  );
}
