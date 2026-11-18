'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Minimize2, X } from 'lucide-react';
import { transcribeLocalFile } from '@/lib/asr/transcribeLocalFile';
import ClipPlayer from './ClipPlayer';
import RichComposer from './RichComposer';

type Sender = 'me' | 'them';
type MediaKind = 'image' | 'video' | 'audio' | 'gif';

type Attachment = {
  kind: MediaKind;
  url?: string;
  blobId?: string;
  mime?: string;
};

type ChatMessage = {
  id: string;
  from: Sender;
  text: string;
  at: number;
  attachment?: Attachment;
  transcript?: string;
  transcriptState?: 'pending' | 'ready' | 'silent' | 'failed';
};

type Chat = {
  id: string;
  name: string;
  handle: string;
  color: string;
  presence: string;
  unread: number;
  messages: ChatMessage[];
};

const STORAGE_KEY = 'carrot-messenger-v1';

const SEED: Chat[] = [
  {
    id: 'maya',
    name: 'Maya Chen',
    handle: 'maya',
    color: '#ea580c',
    presence: 'online',
    unread: 2,
    messages: [
      { id: 'm1', from: 'them', text: 'Did the patch notes go out?', at: hoursAgo(5) },
      { id: 'm2', from: 'me', text: 'Not yet. I am checking the feed first.', at: hoursAgo(4.5) },
      { id: 'm3', from: 'them', text: 'Send them when you can. People are asking in the thread.', at: hoursAgo(0.4) },
      { id: 'm4', from: 'them', text: 'Also, the hero image on the Bulls patch is still the old one.', at: hoursAgo(0.2) },
    ],
  },
  {
    id: 'jordan',
    name: 'Jordan Hale',
    handle: 'jordan',
    color: '#0f766e',
    presence: 'last seen 1h ago',
    unread: 0,
    messages: [
      { id: 'j1', from: 'them', text: 'Want to look at the citation audit after lunch?', at: hoursAgo(26) },
      { id: 'j2', from: 'me', text: 'Yes. I will pull the latest run.', at: hoursAgo(25) },
      { id: 'j3', from: 'them', text: 'Perfect. I left notes on the ones that never saved.', at: hoursAgo(24) },
    ],
  },
  {
    id: 'sam',
    name: 'Sam Ortiz',
    handle: 'sam',
    color: '#1d4ed8',
    presence: 'last seen yesterday',
    unread: 0,
    messages: [
      { id: 's1', from: 'me', text: 'The local app is up on port 3005.', at: hoursAgo(30) },
      { id: 's2', from: 'them', text: 'I will open it from the gotcarrot profile.', at: hoursAgo(28) },
    ],
  },
];

function hoursAgo(hours: number) {
  return Date.now() - hours * 60 * 60 * 1000;
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatListTime(ts: number) {
  const date = new Date(ts);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatBubbleTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function dayLabel(ts: number) {
  const date = new Date(ts);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function lastMessage(chat: Chat) {
  return chat.messages[chat.messages.length - 1];
}

function messageText(value: unknown): string {
  if (typeof value === 'string') return value;
  // A voice send used to store the whole {text, attachment} payload in text.
  if (value && typeof value === 'object' && 'text' in value) {
    const nested = (value as { text?: unknown }).text;
    return typeof nested === 'string' ? nested : '';
  }
  return '';
}

function playableAttachment(attachment?: Attachment): Attachment | undefined {
  if (!attachment?.kind) return undefined;
  if (attachment.kind === 'gif') return attachment.url ? attachment : undefined;
  return attachment.url || attachment.blobId ? attachment : undefined;
}

function normalizeMessage(message: ChatMessage): ChatMessage {
  const rawText = message.text as unknown;
  const nested =
    rawText && typeof rawText === 'object'
      ? (rawText as { attachment?: Attachment }).attachment
      : undefined;
  const transcriptState = ['pending', 'ready', 'silent', 'failed'].includes(message.transcriptState || '')
    ? message.transcriptState
    : undefined;
  return {
    ...message,
    text: messageText(rawText),
    attachment: playableAttachment(message.attachment) ?? playableAttachment(nested),
    transcript: typeof message.transcript === 'string' ? message.transcript : undefined,
    transcriptState,
  };
}

function normalizeChats(saved: Chat[]) {
  return saved.map((chat) => ({
    ...chat,
    messages: Array.isArray(chat.messages) ? chat.messages.map(normalizeMessage) : [],
  }));
}

function previewText(message?: ChatMessage) {
  if (!message) return '';
  const text = messageText(message.text) || (message.transcriptState === 'ready' ? message.transcript || '' : '');
  const label =
    message.attachment?.kind === 'gif'
      ? 'GIF'
      : message.attachment?.kind === 'image'
        ? 'Photo'
        : message.attachment?.kind === 'video'
          ? 'Video'
          : message.attachment?.kind === 'audio'
            ? 'Audio'
            : '';
  if (label && text) return `${label} · ${text}`;
  return label || text;
}

function openMediaDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('carrot-messenger-media', 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('files')) {
        request.result.createObjectStore('files');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putBlob(id: string, blob: Blob) {
  const db = await openMediaDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getBlob(id: string) {
  const db = await openMediaDb();
  return new Promise<Blob | undefined>((resolve, reject) => {
    const tx = db.transaction('files', 'readonly');
    const request = tx.objectStore('files').get(id);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error);
  });
}

export default function Messenger() {
  const [ready, setReady] = useState(false);
  const [timesReady, setTimesReady] = useState(false);
  const [chats, setChats] = useState<Chat[]>(SEED);
  const [activeId, setActiveId] = useState<string>(SEED[0].id);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
  const [expandedPhoto, setExpandedPhoto] = useState<{ src: string; alt: string } | null>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const knownBlobs = useRef<Set<string>>(new Set());
  const transcriptAttempts = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Chat[];
        if (Array.isArray(saved) && saved.length > 0) {
          const chats = normalizeChats(saved);
          setChats(chats);
          setActiveId(chats[0].id);
        }
      }
    } catch {
      // Keep the seeded inbox if storage is unreadable.
    }
    setTimesReady(true);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeChats(chats)));
  }, [chats, ready]);

  useEffect(() => {
    setExpandedPhoto(null);
  }, [activeId]);

  useEffect(() => {
    if (!expandedPhoto) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpandedPhoto(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expandedPhoto]);

  const active = chats.find((chat) => chat.id === activeId) ?? chats[0];

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = [...chats].sort((a, b) => {
      const aAt = lastMessage(a)?.at ?? 0;
      const bAt = lastMessage(b)?.at ?? 0;
      return bAt - aAt;
    });
    if (!needle) return list;
    return list.filter((chat) => {
        const preview = previewText(lastMessage(chat));
      return (
        chat.name.toLowerCase().includes(needle) ||
        chat.handle.toLowerCase().includes(needle) ||
        preview.toLowerCase().includes(needle)
      );
    });
  }, [chats, query]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ block: 'end' });
  }, [active?.id, active?.messages.length]);

  useEffect(() => {
    if (!ready) return;
    setChats((current) => {
      const chat = current.find((item) => item.id === activeId);
      if (!chat || chat.unread === 0) return current;
      return current.map((item) => (item.id === activeId ? { ...item, unread: 0 } : item));
    });
  }, [ready, activeId]);

  function openChat(id: string) {
    setActiveId(id);
    setChats((current) => current.map((chat) => (chat.id === id ? { ...chat, unread: 0 } : chat)));
    setCreating(false);
  }

  useEffect(() => {
    if (!ready) return;
    const ids = chats.flatMap((chat) =>
      chat.messages.map((message) => message.attachment?.blobId).filter((id): id is string => Boolean(id))
    );
    const missing = ids.filter((id) => !knownBlobs.current.has(id));
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const id of missing) {
        const blob = await getBlob(id).catch(() => undefined);
        if (!blob || cancelled) continue;
        knownBlobs.current.add(id);
        next[id] = URL.createObjectURL(blob);
      }
      if (!cancelled && Object.keys(next).length > 0) {
        setBlobUrls((current) => ({ ...current, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, chats]);

  useEffect(() => {
    if (!ready) return;
    for (const chat of chats) {
      for (const message of chat.messages) {
        const kind = message.attachment?.kind;
        if (kind !== 'audio' && kind !== 'video') continue;
        if (message.transcriptState === 'ready' || message.transcriptState === 'silent' || message.transcriptState === 'failed') continue;
        if (transcriptAttempts.current.has(message.id)) continue;
        const src = message.attachment?.url || (message.attachment?.blobId ? blobUrls[message.attachment.blobId] : undefined);
        if (!src) continue;
        transcriptAttempts.current.add(message.id);
        void fetch(src)
          .then((response) => response.blob())
          .then((blob) => transcribeMessage(chat.id, message.id, blob, `${kind}.webm`))
          .catch(() => {
            transcriptAttempts.current.delete(message.id);
          });
      }
    }
  }, [ready, chats, blobUrls]);

  function pushMessage(chatId: string, message: ChatMessage) {
    setChats((current) => {
      const next = current.map((chat) =>
        chat.id === chatId ? { ...chat, messages: [...chat.messages, message] } : chat
      );
      return next.sort((a, b) => (lastMessage(b)?.at ?? 0) - (lastMessage(a)?.at ?? 0));
    });
  }

  function patchMessage(chatId: string, messageId: string, patch: Partial<ChatMessage>) {
    setChats((current) =>
      current.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: chat.messages.map((message) => (message.id === messageId ? { ...message, ...patch } : message)),
            }
          : chat
      )
    );
  }

  async function transcribeMessage(chatId: string, messageId: string, file: Blob, filename: string) {
    try {
      const result = await transcribeLocalFile(file, filename);
      patchMessage(chatId, messageId, {
        transcript: result.text,
        transcriptState: result.silent || !result.text ? 'silent' : 'ready',
      });
    } catch {
      patchMessage(chatId, messageId, { transcriptState: 'failed' });
    }
  }

  async function deliver(payload: { text: string; attachment?: { kind: MediaKind; file?: File; url?: string; mime?: string } }) {
    if (!active) return;
    const text = messageText(payload?.text);
    const attachment = payload?.attachment;
    const id = `local-${Date.now()}`;
    let stored: Attachment | undefined;
    if (attachment?.kind === 'gif' && attachment.url) {
      stored = { kind: 'gif', url: attachment.url };
    } else if (attachment?.file) {
      await putBlob(id, attachment.file);
      knownBlobs.current.add(id);
      const previewUrl = URL.createObjectURL(attachment.file);
      setBlobUrls((current) => ({ ...current, [id]: previewUrl }));
      stored = { kind: attachment.kind, blobId: id, mime: attachment.file.type || attachment.mime };
    }
    if (!text && !stored) return;
    const chatId = active.id;
    const spoken = Boolean(attachment?.file && (stored?.kind === 'audio' || stored?.kind === 'video'));
    pushMessage(chatId, {
      id,
      from: 'me',
      text,
      at: Date.now(),
      attachment: stored,
      transcriptState: spoken ? 'pending' : undefined,
    });
    if (spoken && attachment?.file) {
      transcriptAttempts.current.add(id);
      void transcribeMessage(chatId, id, attachment.file, attachment.file.name || `${stored?.kind}.webm`);
    }
  }

  function startChat() {
    const name = newName.trim();
    if (!name) return;
    const id = `chat-${Date.now()}`;
    const chat: Chat = {
      id,
      name,
      handle: name.toLowerCase().replace(/[^a-z0-9]+/g, ''),
      color: '#c2410c',
      presence: 'online',
      unread: 0,
      messages: [],
    };
    setChats((current) => [chat, ...current]);
    setActiveId(id);
    setNewName('');
    setCreating(false);
    setQuery('');
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 bg-white">
      <aside className="flex h-full min-h-0 w-full max-w-[360px] flex-col border-r border-gray-200">
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
          <button
            type="button"
            onClick={() => setCreating((open) => !open)}
            className="rounded-full bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600"
          >
            New chat
          </button>
        </div>

        <div className="px-4 pb-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="w-full rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm outline-none focus:border-orange-400"
          />
        </div>

        {creating && (
          <form
            className="mx-4 mb-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              startChat();
            }}
          >
            <input
              autoFocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Name"
              className="min-w-0 flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm outline-none focus:border-orange-400"
            />
            <button type="submit" className="rounded-full bg-gray-900 px-3 text-sm text-white">
              Start
            </button>
          </form>
        )}

        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-gray-500">No chats match that search.</p>
          )}
          {visible.map((chat) => {
            const preview = lastMessage(chat);
            const selected = chat.id === active?.id;
            return (
              <button
                key={chat.id}
                type="button"
                onClick={() => openChat(chat.id)}
                className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 ${selected ? 'bg-orange-50' : ''}`}
              >
                <Avatar name={chat.name} color={chat.color} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate font-medium text-gray-900">{chat.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-gray-400" suppressHydrationWarning>
                      {preview && timesReady ? formatListTime(preview.at) : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className={`truncate text-sm ${chat.unread ? 'font-medium text-gray-800' : 'text-gray-500'}`}>
                      {preview ? `${preview.from === 'me' ? 'You: ' : ''}${previewText(preview)}` : 'No messages yet'}
                    </p>
                    {chat.unread > 0 && (
                      <span className="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-orange-500 px-1.5 text-xs font-medium text-white">
                        {chat.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {active ? (
          <>
            <header className="flex items-center gap-3 border-b border-gray-200 px-5 py-3">
              <Avatar name={active.name} color={active.color} />
              <div>
                <h2 className="font-semibold text-gray-900">{active.name}</h2>
                <p className="text-xs text-gray-500">{active.presence}</p>
              </div>
            </header>

            <div className="flex-1 space-y-2 overflow-y-auto bg-[#f7f7f8] px-5 py-4">
              {active.messages.length === 0 && (
                <p className="pt-16 text-center text-sm text-gray-500">Say hello to {active.name}.</p>
              )}
              {active.messages.map((message, index) => {
                const previous = active.messages[index - 1];
                const showDay = !previous || dayLabel(previous.at) !== dayLabel(message.at);
                const mine = message.from === 'me';
                return (
                  <div key={message.id}>
                    {showDay && (
                      <div className="my-3 text-center text-xs font-medium text-gray-400" suppressHydrationWarning>
                        {timesReady ? dayLabel(message.at) : ''}
                      </div>
                    )}
                    <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm ${
                          mine ? 'rounded-br-md bg-orange-500 text-white' : 'rounded-bl-md bg-white text-gray-900 shadow-sm'
                        }`}
                      >
                        <MessageMedia
                          message={message}
                          blobUrls={blobUrls}
                          mine={mine}
                          onExpand={setExpandedPhoto}
                        />
                        {messageText(message.text) ? (
                          <p className="whitespace-pre-wrap break-words">{messageText(message.text)}</p>
                        ) : null}
                        <p className={`mt-1 text-[11px] ${mine ? 'text-orange-100' : 'text-gray-400'}`} suppressHydrationWarning>
                          {timesReady ? formatBubbleTime(message.at) : ''}
                          {mine ? ' · Sent' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={threadEndRef} />
            </div>

            <RichComposer onSend={deliver} />
            {expandedPhoto && (
              <div className="absolute inset-y-0 right-0 z-20 flex w-[90%] flex-col border-l bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b bg-white px-4 py-3">
                  <h3 className="text-sm font-semibold text-gray-900">{expandedPhoto.alt}</h3>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setExpandedPhoto(null)}
                      className="inline-flex items-center gap-1 rounded-full border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      aria-label="Show more of the chat"
                    >
                      <Minimize2 size={14} />
                      Show chat
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedPhoto(null)}
                      className="grid h-8 w-8 place-items-center rounded-full text-gray-600 hover:bg-gray-100"
                      aria-label="Close photo"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 items-center justify-center bg-black">
                  <img
                    src={expandedPhoto.src}
                    alt={expandedPhoto.alt}
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-sm text-gray-500">Pick a chat to start.</div>
        )}
      </section>
    </div>
  );
}

function Avatar({ name, color }: { name: string; color: string }) {
  return (
    <div
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-semibold text-white"
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

function MessageMedia({
  message,
  blobUrls,
  mine,
  onExpand,
}: {
  message: ChatMessage;
  blobUrls: Record<string, string>;
  mine: boolean;
  onExpand: (photo: { src: string; alt: string }) => void;
}) {
  const attachment = message.attachment;
  if (!attachment) return null;
  const src = attachment.url || (attachment.blobId ? blobUrls[attachment.blobId] : undefined);
  if (!src) {
    return <p className="mb-1 text-xs opacity-70">Loading {attachment.kind}…</p>;
  }
  if (attachment.kind === 'audio' || attachment.kind === 'video') {
    return (
      <ClipPlayer
        src={src}
        kind={attachment.kind}
        mine={mine}
        transcript={message.transcript}
        transcriptState={message.transcriptState}
      />
    );
  }
  const alt = attachment.kind === 'gif' ? 'GIF' : 'Photo';
  return (
    <button
      type="button"
      onClick={() => onExpand({ src, alt })}
      className="mb-1 block w-full cursor-zoom-in"
      aria-label={alt === 'GIF' ? 'Expand GIF' : 'Expand photo'}
    >
      <img
        src={src}
        alt={alt}
        className="max-h-64 w-full rounded-xl object-cover"
      />
    </button>
  );
}
