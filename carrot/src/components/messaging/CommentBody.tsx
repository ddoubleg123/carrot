'use client';

import { useState } from 'react';
import { decodeComment } from './commentCodec';
import ClipPlayer from './ClipPlayer';

function TranscriptText({ text }: { text: string }) {
  const turns = text
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split('\n');
      if (/^Speaker \d+$/.test(lines[0].trim())) {
        return { speaker: lines[0].trim(), body: lines.slice(1).join(' ').trim() };
      }
      return { speaker: '', body: block.trim() };
    })
    .filter((turn) => turn.body);

  if (turns.length === 0) return null;
  if (turns.every((turn) => !turn.speaker)) {
    return <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-600">{text}</p>;
  }

  return (
    <div className="mt-2 space-y-3">
      {turns.map((turn, index) => {
        const second = /2$/.test(turn.speaker);
        return (
          <div
            key={`${turn.speaker}-${index}`}
            className={`border-l-2 pl-2 ${second ? 'border-sky-400' : 'border-orange-400'}`}
          >
            <p className={`text-[11px] font-semibold uppercase tracking-wide ${second ? 'text-sky-800' : 'text-orange-800'}`}>
              {turn.speaker}
            </p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-600">{turn.body}</p>
          </div>
        );
      })}
    </div>
  );
}

function TranscriptButton({ src }: { src: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'failed'>('idle');
  const [text, setText] = useState('');

  async function toggle() {
    if (status === 'ready' || status === 'empty' || status === 'failed') {
      setOpen((current) => !current);
      return;
    }
    setOpen(true);
    setStatus('loading');
    try {
      const local = src.startsWith('blob:') || src.startsWith('data:');
      let response: Response;
      if (local) {
        const media = await fetch(src);
        if (!media.ok) throw new Error('Could not read the recording.');
        const blob = await media.blob();
        const body = new FormData();
        body.append('file', blob, blob.type.includes('video') ? 'clip.webm' : 'voice.webm');
        response = await fetch('/api/transcribe/file', { method: 'POST', body });
      } else {
        response = await fetch('/api/transcribe/file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: src }),
        });
      }
      const data = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!response.ok) throw new Error(data.error || 'Transcription failed');
      const heard = typeof data.text === 'string' ? data.text.trim() : '';
      setText(heard);
      setStatus(heard ? 'ready' : 'empty');
    } catch {
      setStatus('failed');
    }
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => void toggle()}
        className="text-xs font-medium text-orange-700 hover:underline"
      >
        {open ? 'Hide transcript' : 'Transcript'}
      </button>
      {open && status === 'loading' ? <p className="mt-1 text-xs text-gray-500">Transcribing…</p> : null}
      {open && status === 'ready' ? (
        <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Transcript</p>
          <TranscriptText text={text} />
        </div>
      ) : null}
      {open && status === 'empty' ? (
        <p className="mt-1 text-xs text-gray-500">Couldn't make out the words in this recording.</p>
      ) : null}
      {open && status === 'failed' ? (
        <p className="mt-1 text-xs text-gray-500">Transcript isn't available right now.</p>
      ) : null}
    </div>
  );
}

export default function CommentBody({ content }: { content: string }) {
  const { text, media } = decodeComment(content);
  const spoken = media?.kind === 'audio' || media?.kind === 'video';
  return (
    <div>
      {media?.kind === 'video' && <ClipPlayer src={media.url} kind="video" />}
      {media?.kind === 'audio' && <ClipPlayer src={media.url} kind="audio" />}
      {(media?.kind === 'image' || media?.kind === 'gif') && (
        <img
          src={media.url}
          alt={media.kind === 'gif' ? 'GIF' : 'Photo'}
          className="mb-1 max-h-64 w-full rounded-xl object-cover"
        />
      )}
      {text ? <p className="mt-1 whitespace-pre-wrap break-words text-sm text-gray-900">{text}</p> : null}
      {spoken && media?.url ? <TranscriptButton src={media.url} /> : null}
    </div>
  );
}
