'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Mic, Smile, Square, X } from 'lucide-react';
import GifPicker from '@/app/(app)/dashboard/components/GifPicker';
import type { MediaKind } from './commentCodec';

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

export type OutgoingAttachment = {
  kind: MediaKind;
  file?: File;
  url?: string;
  mime?: string;
};

type PendingFile = {
  kind: 'image' | 'video' | 'audio';
  file: File;
  previewUrl: string;
};

const MEDIA_LIMIT = 25 * 1024 * 1024;

function pickRecorderMime() {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
}

export default function RichComposer({
  onSend,
  disabled = false,
  placeholder = 'Message',
  submitLabel = 'Send',
  variant = 'chat',
  focusToken = 0,
}: {
  onSend: (message: { text: string; attachment?: OutgoingAttachment }) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
  submitLabel?: string;
  variant?: 'chat' | 'reply';
  focusToken?: number;
}) {
  const [draft, setDraft] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGif, setShowGif] = useState(false);
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [sending, setSending] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const mediaRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (focusToken) composerRef.current?.focus();
  }, [focusToken]);

  useEffect(() => {
    if (!showEmoji) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowEmoji(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showEmoji]);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  function releasePending(current: PendingFile | null) {
    if (current) URL.revokeObjectURL(current.previewUrl);
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function submit(attachment?: OutgoingAttachment) {
    const text = draft.trim();
    if ((!text && !attachment) || sending || disabled) return;
    setSending(true);
    setNotice(null);
    try {
      await onSend({ text, attachment });
      setDraft('');
      setShowEmoji(false);
      setPending((current) => {
        releasePending(current);
        return null;
      });
      composerRef.current?.focus();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : (reply ? 'Could not post that reply.' : 'Could not send that.'));
    } finally {
      setSending(false);
    }
  }

  function chooseFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MEDIA_LIMIT) {
      setNotice('Keep photos, videos, and voice messages under 25 MB.');
      return;
    }
    const kind: PendingFile['kind'] = file.type.startsWith('video/')
      ? 'video'
      : file.type.startsWith('audio/')
        ? 'audio'
        : 'image';
    setNotice(null);
    setPending((current) => {
      releasePending(current);
      return { kind, file, previewUrl: URL.createObjectURL(file) };
    });
  }

  async function startRecording() {
    if (recording || disabled) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setNotice('This browser cannot record from the microphone.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickRecorderMime();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mime || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        const extension = type.includes('mp4') ? 'm4a' : 'webm';
        const file = new File([blob], `voice-${Date.now()}.${extension}`, { type });
        stopStream();
        setRecording(false);
        chooseFile(file);
      };
      recorderRef.current = recorder;
      recorder.start();
      setElapsed(0);
      setRecording(true);
      setNotice(null);
      setShowEmoji(false);
      setShowGif(false);
    } catch {
      stopStream();
      setRecording(false);
      setNotice('Allow microphone access to record a voice message.');
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      setRecording(false);
      stopStream();
      return;
    }
    recorder.stop();
  }

  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const reply = variant === 'reply';
  const notePlaceholder = pending?.kind === 'audio' ? 'Add a note (optional)' : placeholder;

  function clearPending() {
    setPending((current) => {
      releasePending(current);
      return null;
    });
  }

  return (
    <form
      className="shrink-0 border-t border-gray-200 bg-white px-4 py-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (recording) stopRecording();
        else void submit(pending ? { kind: pending.kind, file: pending.file, mime: pending.file.type } : undefined);
      }}
    >
      {notice && <p className="mb-2 text-xs text-red-600">{notice}</p>}
      {recording && (
        <div className="mb-2 flex items-center gap-2 text-sm text-red-600">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          Recording {clock}
          <button type="button" onClick={stopRecording} className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-500 px-3 py-1 text-xs font-medium text-white">
            <Square className="h-3 w-3 fill-current" />
            Stop
          </button>
        </div>
      )}
      {pending && !recording && pending.kind === 'audio' && (
        <div className="mb-3 rounded-2xl border border-orange-200 bg-orange-50 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">Voice message</span>
            <button
              type="button"
              aria-label="Remove voice message"
              onClick={clearPending}
              className="ml-auto rounded-full p-1 text-gray-500 hover:bg-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <audio src={pending.previewUrl} controls className="h-10 w-full" />
          {reply && <p className="mt-2 text-xs text-gray-600">Add a note below if you want, then reply.</p>}
        </div>
      )}
      {pending && !recording && pending.kind !== 'audio' && (
        <div className="mb-2 flex items-center gap-2">
          {pending.kind === 'image' ? (
            <img src={pending.previewUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
          ) : (
            <video src={pending.previewUrl} className="h-16 w-16 rounded-lg object-cover" />
          )}
          <span className="text-xs text-gray-500">
            {pending.kind === 'image' ? 'Photo ready' : 'Video ready'}
          </span>
          <button
            type="button"
            aria-label="Remove attachment"
            onClick={clearPending}
            className="ml-auto rounded-full p-1 text-gray-500 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {showEmoji && (
        <div className="mb-2 overflow-hidden rounded-2xl border border-gray-200">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <span className="text-xs font-medium text-gray-600">Emoji</span>
            <button
              type="button"
              onClick={() => setShowEmoji(false)}
              className="text-xs font-medium text-gray-600 hover:text-gray-900"
              aria-label="Close emoji picker"
            >
              Close
            </button>
          </div>
          <EmojiPicker
            emojiStyle="native"
            width="100%"
            height={280}
            lazyLoadEmojis={false}
            previewConfig={{ showPreview: false }}
            onEmojiClick={(emoji: { emoji: string }) => {
              setDraft((current) => current + emoji.emoji);
              setShowEmoji(false);
              composerRef.current?.focus();
            }}
          />
        </div>
      )}
      <div className="flex w-full flex-col gap-2">
        <textarea
          ref={composerRef}
          value={draft}
          rows={4}
          placeholder={notePlaceholder}
          disabled={disabled || sending}
          onChange={(event) => setDraft(event.target.value)}
          className="min-h-24 w-full resize-y rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-relaxed outline-none focus:border-orange-400"
        />
        <div className="flex w-full items-end gap-2">
          <div className="flex gap-1 pb-1">
            <ComposerIcon label="Emoji" onClick={() => { setShowEmoji((open) => !open); setShowGif(false); }}>
              <Smile className="h-5 w-5" />
            </ComposerIcon>
            <ComposerIcon label="GIF" onClick={() => { setShowGif(true); setShowEmoji(false); }}>
              <GifMark />
            </ComposerIcon>
            <ComposerIcon label="Photo or video" onClick={() => mediaRef.current?.click()}>
              <ImageIcon className="h-5 w-5" />
            </ComposerIcon>
            <ComposerIcon
              label={recording ? 'Stop recording' : 'Record voice message'}
              onClick={() => (recording ? stopRecording() : void startRecording())}
            >
              <Mic className={`h-5 w-5 ${recording ? 'text-red-500' : ''}`} />
            </ComposerIcon>
          </div>
          <input
            ref={mediaRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(event) => {
              chooseFile(event.target.files?.[0]);
              event.target.value = '';
            }}
          />
          <button
            type="submit"
            disabled={disabled || sending || recording || (!draft.trim() && !pending)}
            className="ml-auto h-11 rounded-full bg-orange-500 px-4 text-sm font-medium text-white enabled:hover:bg-orange-600 disabled:opacity-40"
          >
            {sending ? (reply ? 'Posting…' : 'Sending…') : submitLabel}
          </button>
        </div>
      </div>
      <GifPicker
        isOpen={showGif}
        onClose={() => setShowGif(false)}
        onSelectGif={(url) => {
          setShowGif(false);
          void submit({ kind: 'gif', url });
        }}
      />
    </form>
  );
}

function GifMark() {
  return (
    <span className="grid h-5 min-w-7 place-items-center rounded border-[1.5px] border-current px-0.5 text-[9px] font-bold leading-none tracking-tight">
      GIF
    </span>
  );
}

function ComposerIcon({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-full text-gray-600 hover:bg-orange-50 hover:text-orange-600"
    >
      {children}
    </button>
  );
}
