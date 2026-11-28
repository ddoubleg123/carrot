'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { OutgoingAttachment } from './RichComposer';

const RichComposer = dynamic(() => import('./RichComposer'), { ssr: false });

type Mode = 'messages' | 'mail';

type Thread = {
  id: string;
  kind: 'dm' | 'email';
  name: string;
  handle: string;
  subject: string | null;
  unread: number;
  preview: string;
  at: number | null;
  mine: boolean;
  bot?: boolean;
};

type Line = {
  id: string;
  from: 'me' | 'them';
  text: string;
  image: string | null;
  at: number;
  state: string;
  reason?: string | null;
  earlier?: string;
};

type Bot = { name: string; username: string; beat: string; avatar: string };

const COLORS = ['#ea580c', '#0f766e', '#1d4ed8', '#7c3aed', '#b45309', '#be123c'];

function colorFor(name: string) {
  let n = 0;
  for (const char of name) n = (n + char.charCodeAt(0)) % COLORS.length;
  return COLORS[n];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() || '').join('') || '?';
}

function sendNote(line: Line) {
  if (line.state !== 'failed') return 'Sent';
  const reason = line.reason || '';
  if (/authentication|cannot send mail/i.test(reason)) return 'Not sent. The Cloudflare token cannot send mail yet.';
  return reason ? `Not sent. ${reason}` : 'Not sent';
}

function formatListTime(at: number) {
  const date = new Date(at);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatBubbleTime(at: number) {
  return new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function dayLabel(at: number) {
  const date = new Date(at);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('That photo could not be read.'));
    reader.readAsDataURL(file);
  });
}

export default function Messenger() {
  const [mode, setMode] = useState<Mode>('messages');
  const [threads, setThreads] = useState<Thread[]>([]);
  const [bots, setBots] = useState<Bot[]>([]);
  const [address, setAddress] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [linesFor, setLinesFor] = useState<string | null>(null);
  const [typing, setTyping] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);
  const [timesReady, setTimesReady] = useState(false);
  const [expandedPhoto, setExpandedPhoto] = useState<{ src: string; alt: string } | null>(null);
  const [composing, setComposing] = useState(false);
  const [mailTo, setMailTo] = useState('');
  const [mailSubject, setMailSubject] = useState('');
  const [mailBody, setMailBody] = useState('');
  const [mailHtml, setMailHtml] = useState('');
  const [mailPhoto, setMailPhoto] = useState<string | null>(null);
  const [sendingMail, setSendingMail] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const lineCount = useRef(0);
  const lastType = useRef(0);
  const listFlight = useRef(false);
  const threadFlight = useRef(0);

  const active = threads.find((thread) => thread.id === activeId) || null;
  const shown = useMemo(() => threads.filter((thread) => thread.kind === (mode === 'mail' ? 'email' : 'dm')), [mode, threads]);
  const messageUnread = threads.reduce((sum, thread) => sum + (thread.kind === 'dm' ? thread.unread : 0), 0);
  const mailUnread = threads.reduce((sum, thread) => sum + (thread.kind === 'email' ? thread.unread : 0), 0);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return shown;
    return shown.filter((thread) =>
      [thread.name, thread.handle, thread.subject, thread.preview].some((part) => part?.toLowerCase().includes(needle)),
    );
  }, [query, shown]);
  const botMatches = useMemo(() => {
    const needle = newName.trim().toLowerCase();
    const pool = needle
      ? bots.filter((bot) => `${bot.name} ${bot.username} ${bot.beat}`.toLowerCase().includes(needle))
      : bots;
    return pool.slice(0, 12);
  }, [bots, newName]);

  const loadList = useCallback(async () => {
    if (listFlight.current) return;
    listFlight.current = true;
    try {
      const response = await fetch('/api/messages', { cache: 'no-store' });
      if (response.status === 401) {
        setSignedOut(true);
        setReady(true);
        return;
      }
      if (!response.ok) {
        setReady(true);
        return;
      }
      const data = await response.json() as { address: string | null; threads: Thread[] };
      setSignedOut(false);
      setAddress(data.address);
      setThreads(data.threads);
      setReady(true);
    } finally {
      listFlight.current = false;
    }
  }, []);

  const loadThread = useCallback(async (id: string) => {
    const ticket = ++threadFlight.current;
    const response = await fetch(`/api/messages/${id}`, { cache: 'no-store' });
    if (ticket !== threadFlight.current) return;
    if (!response.ok) {
      setLinesFor(id);
      return;
    }
    const data = await response.json() as { lines: Line[]; typing: string | null; thread: Thread };
    if (ticket !== threadFlight.current) return;
    setLines(data.lines);
    setLinesFor(id);
    setTyping(data.typing);
    setThreads((current) => current.map((thread) => thread.id === id ? { ...thread, ...data.thread, unread: 0 } : thread));
  }, []);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('carrot-mail-unread', { detail: { messages: messageUnread, mail: mailUnread } }));
  }, [messageUnread, mailUnread]);

  useEffect(() => {
    setTimesReady(true);
    void loadList();
    void fetch('/api/messages/bots', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { bots?: Bot[] } | null) => { if (data?.bots) setBots(data.bots); })
      .catch(() => undefined);
    const timer = window.setInterval(() => { void loadList(); }, 8000);
    return () => window.clearInterval(timer);
  }, [loadList]);

  useEffect(() => {
    if (!activeId) return;
    void loadThread(activeId);
    const timer = window.setInterval(() => { void loadThread(activeId); }, 4000);
    return () => window.clearInterval(timer);
  }, [activeId, loadThread]);

  useEffect(() => {
    if (lines.length === lineCount.current) return;
    lineCount.current = lines.length;
    threadEndRef.current?.scrollIntoView({ block: 'end' });
  }, [lines]);

  function switchMode(next: Mode) {
    setMode(next);
    setActiveId(null);
    setLines([]);
    setCreating(false);
    setComposing(false);
    setQuery('');
    setFormError(null);
    setExpandedPhoto(null);
  }

  async function openWith(username: string) {
    setFormError(null);
    setWaiting(true);
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'dm', to: username }),
      });
      const data = await response.json().catch(() => ({})) as { id?: string; error?: string };
      if (!response.ok || !data.id) {
        setFormError(data.error || 'Could not start that conversation.');
        return;
      }
      setNewName('');
      setCreating(false);
      setActiveId(data.id);
      setLines([]);
      await loadList();
    } finally {
      setWaiting(false);
    }
  }

  async function noteDraft(value: string) {
    if (!activeId || !value.trim()) return;
    const now = Date.now();
    if (now - lastType.current < 2000) return;
    lastType.current = now;
    await fetch(`/api/messages/${activeId}/typing`, { method: 'POST' });
  }

  async function deliver(message: { text: string; attachment?: OutgoingAttachment }) {
    if (!activeId) throw new Error('Pick a conversation first.');
    let image: string | undefined;
    let text = message.text.trim();
    const attachment = message.attachment;
    if (attachment?.kind === 'gif' && attachment.url) text = text || attachment.url;
    else if (attachment?.kind === 'image' && attachment.file) {
      if (attachment.file.size > 380_000) throw new Error('Photos need to be under 400KB.');
      image = await readFile(attachment.file);
    } else if (attachment) {
      throw new Error('Photos and GIFs can be attached. Voice and video stay on this device.');
    }
    setWaiting(Boolean(active?.bot));
    try {
      const response = await fetch(`/api/messages/${activeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, image }),
      });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not send that.');
      await loadThread(activeId);
      await loadList();
    } finally {
      setWaiting(false);
    }
  }

  async function sendMail(event: FormEvent) {
    event.preventDefault();
    if (sendingMail) return;
    setFormError(null);
    if (!mailBody.trim()) {
      setFormError('Write a message first.');
      return;
    }
    setSendingMail(true);
    try {
      const opened = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'email', to: mailTo, subject: mailSubject }),
      });
      const started = await opened.json().catch(() => ({})) as { id?: string; error?: string };
      if (!opened.ok || !started.id) {
        setFormError(started.error || 'Could not start that message.');
        return;
      }
      const sent = await fetch(`/api/messages/${started.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: mailBody, html: mailHtml, image: mailPhoto }),
      });
      const result = await sent.json().catch(() => ({})) as { error?: string };
      if (!sent.ok) {
        setFormError(result.error || 'Could not send that.');
        setActiveId(started.id);
        return;
      }
      setMailTo('');
      setMailSubject('');
      setMailBody('');
      setMailHtml('');
      setMailPhoto(null);
      setComposing(false);
      setActiveId(started.id);
      await loadList();
      await loadThread(started.id);
    } finally {
      setSendingMail(false);
    }
  }

  async function copyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const subtitle = waiting
    ? `${active?.name || 'They'} ${active?.bot ? 'is writing' : 'is typing'}`
    : typing
      ? `${typing} is typing`
      : active?.bot
        ? 'Bot'
        : active?.handle
          ? `@${active.handle}`
          : 'Direct message';

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 bg-white">
      <aside className={`flex h-full min-h-0 w-full flex-col border-r border-gray-200 ${mode === 'mail' ? 'max-w-[420px]' : 'max-w-[360px]'}`}>
        <div className="px-4 pt-4">
          <div className="grid grid-cols-2 rounded-full bg-gray-100 p-1 text-sm">
            <button type="button" onClick={() => switchMode('messages')} className={`flex items-center justify-center gap-1.5 rounded-full py-1.5 font-medium ${mode === 'messages' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              Messages
              <UnreadCount count={messageUnread} />
            </button>
            <button type="button" onClick={() => switchMode('mail')} className={`flex items-center justify-center gap-1.5 rounded-full py-1.5 font-medium ${mode === 'mail' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
              Mail
              <UnreadCount count={mailUnread} />
            </button>
          </div>
        </div>

        {mode === 'messages' ? (
          <MessagesList
            ready={ready}
            signedOut={signedOut}
            creating={creating}
            newName={newName}
            query={query}
            formError={formError}
            visible={visible}
            bots={botMatches}
            activeId={active?.id || null}
            timesReady={timesReady}
            onCreate={() => { setCreating((open) => !open); setFormError(null); }}
            onName={setNewName}
            onQuery={setQuery}
            onStart={() => { if (newName.trim()) void openWith(newName.trim()); }}
            onBot={(username) => { void openWith(username); }}
            onOpen={(id) => { setActiveId(id); setExpandedPhoto(null); }}
          />
        ) : (
          <MailList
            ready={ready}
            signedOut={signedOut}
            address={address}
            copied={copied}
            query={query}
            visible={visible}
            activeId={active?.id || null}
            timesReady={timesReady}
            onCopy={() => { void copyAddress(); }}
            onCompose={() => { setComposing(true); setActiveId(null); setFormError(null); }}
            onQuery={setQuery}
            onOpen={(id) => {
              setComposing(false);
              setFormError(null);
              if (id !== activeId) setLinesFor(null);
              setActiveId(id);
            }}
          />
        )}
      </aside>

      <section className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-white">
        {mode === 'mail' ? (
          composing ? (
            <MailCompose
              address={address}
              to={mailTo}
              subject={mailSubject}
              photo={mailPhoto}
              sending={sendingMail}
              error={formError}
              signedOut={signedOut}
              onTo={setMailTo}
              onSubject={setMailSubject}
              onDraft={(text, html) => { setMailBody(text); setMailHtml(html); }}
              onPhoto={setMailPhoto}
              onSubmit={sendMail}
            />
          ) : active ? (
            <MailRead
              thread={active}
              lines={linesFor === active.id ? lines : []}
              loading={linesFor !== active.id}
              address={address}
              timesReady={timesReady}
              sending={sendingMail}
              error={formError}
              onSend={async (text, html) => {
                if (!active || sendingMail) return;
                setFormError(null);
                setSendingMail(true);
                try {
                  const sent = await fetch(`/api/messages/${active.id}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, html }),
                  });
                  const result = await sent.json().catch(() => ({})) as { error?: string };
                  if (!sent.ok) {
                    setFormError(result.error || 'Could not send that.');
                    throw new Error('send');
                  }
                  await loadList();
                  await loadThread(active.id);
                } finally {
                  setSendingMail(false);
                }
              }}
            />
          ) : (
            <div className="grid flex-1 place-items-center bg-[#f4f3f0] px-8">
              <div className="max-w-sm text-center">
                <p className="text-lg font-semibold text-gray-900">{signedOut ? 'Sign in to read your mail.' : 'No message open'}</p>
                <p className="mt-2 text-sm leading-6 text-gray-500">{signedOut ? 'Your inbox is waiting on the account you use for Carrot.' : 'Choose a letter from the inbox, or start one with Compose.'}</p>
              </div>
            </div>
          )
        ) : active ? (
          <>
            <header className="flex items-center gap-3 border-b border-gray-200 px-5 py-3">
              <Avatar name={active.name} color={colorFor(active.handle || active.name)} />
              <div className="min-w-0">
                <h2 className="truncate font-semibold text-gray-900">{active.name}</h2>
                <p className={`truncate text-xs ${typing || waiting ? 'text-orange-600' : 'text-gray-500'}`}>{subtitle}</p>
              </div>
            </header>
            <div className="flex-1 space-y-2 overflow-y-auto bg-[#f7f7f8] px-5 py-4">
              {lines.length === 0 && <p className="pt-16 text-center text-sm text-gray-500">Say hello to {active.name}.</p>}
              {lines.map((message, index) => {
                const previous = lines[index - 1];
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
                      <div className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm ${mine ? 'rounded-br-md bg-orange-500 text-white' : 'rounded-bl-md bg-white text-gray-900 shadow-sm'}`}>
                        {message.image && (
                          <button type="button" onClick={() => setExpandedPhoto({ src: message.image || '', alt: 'Photo' })} className="mb-1 block w-full cursor-zoom-in">
                            <img src={message.image} alt="Photo" className="max-h-64 w-full rounded-xl object-cover" />
                          </button>
                        )}
                        {message.text && message.text !== 'Photo' ? <p className="whitespace-pre-wrap break-words">{message.text}</p> : null}
                        <p className={`mt-1 text-[11px] ${mine ? 'text-orange-100' : 'text-gray-400'}`} suppressHydrationWarning>
                          {timesReady ? formatBubbleTime(message.at) : ''}
                          {mine ? ` · ${message.state === 'failed' ? 'Failed' : 'Sent'}` : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={threadEndRef} />
            </div>
            <RichComposer onSend={deliver} onDraft={(value) => { void noteDraft(value); }} />
            {expandedPhoto && (
              <div className="absolute inset-y-0 right-0 z-20 flex w-[90%] flex-col border-l bg-white shadow-2xl">
                <div className="flex items-center justify-end border-b px-4 py-3">
                  <button type="button" onClick={() => setExpandedPhoto(null)} className="grid h-8 w-8 place-items-center rounded-full text-gray-600 hover:bg-gray-100" aria-label="Close photo">
                    <X size={16} />
                  </button>
                </div>
                <div className="flex min-h-0 flex-1 items-center justify-center bg-black">
                  <img src={expandedPhoto.src} alt="" className="max-h-full max-w-full object-contain" />
                </div>
              </div>
            )}
          </>
        ) : (
          <BotStart signedOut={signedOut} bots={bots.slice(0, 8)} onBot={(username) => { void openWith(username); }} />
        )}
      </section>
    </div>
  );
}

function Avatar({ name, color, src }: { name: string; color: string; src?: string }) {
  if (src) {
    return <img src={src} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />;
  }
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: color }} aria-hidden>
      {initials(name)}
    </div>
  );
}

function MessagesList({
  ready, signedOut, creating, newName, query, formError, visible, bots, activeId, timesReady,
  onCreate, onName, onQuery, onStart, onBot, onOpen,
}: {
  ready: boolean;
  signedOut: boolean;
  creating: boolean;
  newName: string;
  query: string;
  formError: string | null;
  visible: Thread[];
  bots: Bot[];
  activeId: string | null;
  timesReady: boolean;
  onCreate: () => void;
  onName: (value: string) => void;
  onQuery: (value: string) => void;
  onStart: () => void;
  onBot: (username: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h1 className="text-xl font-semibold text-gray-900">Messages</h1>
        <button type="button" onClick={onCreate} className="rounded-full bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600">
          New chat
        </button>
      </div>
      <div className="px-4 pb-3">
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search" className="w-full rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm outline-none focus:border-orange-400" />
      </div>
      {creating && (
        <form className="mx-4 mb-3" onSubmit={(event) => { event.preventDefault(); onStart(); }}>
          <div className="flex gap-2">
            <input autoFocus value={newName} onChange={(event) => onName(event.target.value)} placeholder="Username" className="min-w-0 flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm outline-none focus:border-orange-400" />
            <button type="submit" className="rounded-full bg-gray-900 px-3 text-sm text-white">Start</button>
          </div>
          {formError && <p className="px-2 pt-2 text-xs text-red-600">{formError}</p>}
          <div className="mt-2 max-h-64 overflow-y-auto">
            {bots.map((bot) => (
              <button key={bot.username} type="button" onClick={() => onBot(bot.username)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-gray-50">
                <Avatar name={bot.name} color={colorFor(bot.username)} src={bot.avatar} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-900">{bot.name}</span>
                  <span className="block truncate text-xs text-gray-500">{bot.beat}</span>
                </span>
              </button>
            ))}
          </div>
        </form>
      )}
      <div className="flex-1 overflow-y-auto">
        {!ready && <p className="px-4 py-8 text-center text-sm text-gray-500">Loading messages.</p>}
        {ready && signedOut && <p className="px-4 py-8 text-center text-sm text-gray-500">Sign in to see your messages.</p>}
        {ready && !signedOut && visible.length === 0 && !creating && (
          <p className="px-4 py-8 text-center text-sm text-gray-500">No chats yet. Start one, or message a bot.</p>
        )}
        {visible.map((thread) => (
          <button key={thread.id} type="button" onClick={() => onOpen(thread.id)} className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 ${thread.id === activeId ? 'bg-orange-50' : ''}`}>
            <Avatar name={thread.name} color={colorFor(thread.handle || thread.name)} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="truncate font-medium text-gray-900">{thread.name}</span>
                <span className="ml-auto shrink-0 text-xs text-gray-400" suppressHydrationWarning>{thread.at && timesReady ? formatListTime(thread.at) : ''}</span>
              </div>
              <p className={`truncate text-sm ${thread.unread ? 'font-medium text-gray-800' : 'text-gray-500'}`}>
                {thread.preview ? `${thread.mine ? 'You: ' : ''}${thread.preview}` : 'No messages yet'}
              </p>
            </div>
            {thread.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-orange-500 px-1.5 text-xs font-medium text-white">{thread.unread}</span>}
          </button>
        ))}
      </div>
    </>
  );
}

function BotStart({ signedOut, bots, onBot }: { signedOut: boolean; bots: Bot[]; onBot: (username: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8">
      <p className="max-w-md text-center text-sm text-gray-500">
        {signedOut ? 'Sign in to send a message.' : 'No chats yet. These accounts will answer.'}
      </p>
      {!signedOut && (
        <div className="mt-6 grid w-full max-w-lg gap-2">
          {bots.map((bot) => (
            <button key={bot.username} type="button" onClick={() => onBot(bot.username)} className="flex items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3 text-left hover:bg-gray-50">
              <Avatar name={bot.name} color={colorFor(bot.username)} src={bot.avatar} />
              <span className="min-w-0">
                <span className="block font-medium text-gray-900">{bot.name}</span>
                <span className="block truncate text-sm text-gray-500">{bot.beat}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MailList({
  ready, signedOut, address, copied, query, visible, activeId, timesReady, onCopy, onCompose, onQuery, onOpen,
}: {
  ready: boolean;
  signedOut: boolean;
  address: string | null;
  copied: boolean;
  query: string;
  visible: Thread[];
  activeId: string | null;
  timesReady: boolean;
  onCopy: () => void;
  onCompose: () => void;
  onQuery: (value: string) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900">Inbox</h1>
          {address ? (
            <button type="button" onClick={onCopy} className="mt-2 inline-flex max-w-full truncate rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-800 hover:bg-orange-100">{copied ? 'Copied' : address}</button>
          ) : (
            <p className="mt-1 text-xs text-gray-400">{signedOut ? 'Sign in to use mail.' : 'Set a username to get an address.'}</p>
          )}
        </div>
        <button type="button" onClick={onCompose} className="rounded-full bg-orange-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-600">
          Compose
        </button>
      </div>
      <div className="px-4 py-3">
        <input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search mail" className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-orange-400" />
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {!ready && <p className="px-2 py-8 text-sm text-gray-500">Loading mail.</p>}
        {ready && signedOut && <p className="px-2 py-8 text-sm text-gray-500">Sign in to see your mail.</p>}
        {ready && !signedOut && visible.length === 0 && <p className="px-2 py-8 text-sm text-gray-500">Your inbox is empty.</p>}
        {visible.map((thread) => (
          <button key={thread.id} type="button" onClick={() => onOpen(thread.id)} className={`mb-1 flex w-full gap-3 rounded-xl px-2 py-2.5 text-left ${thread.id === activeId ? 'bg-orange-50 ring-1 ring-orange-200' : 'hover:bg-gray-50'}`}>
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: colorFor(thread.name) }} aria-hidden>
              {initials(thread.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline gap-3">
                <span className={`min-w-0 flex-1 truncate text-sm ${thread.unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}`}>{thread.name}</span>
                <span className="shrink-0 text-xs text-gray-400" suppressHydrationWarning>{thread.at && timesReady ? formatListTime(thread.at) : ''}</span>
              </span>
              <span className={`mt-0.5 block truncate text-sm ${thread.unread ? 'font-medium text-gray-900' : 'text-gray-700'}`}>{thread.subject || '(no subject)'}</span>
              <span className="mt-0.5 block truncate text-xs text-gray-400">{thread.preview || 'No message yet'}</span>
            </span>
            {thread.unread > 0 && <span className="mt-1 grid h-5 min-w-5 place-items-center self-center rounded-full bg-orange-500 px-1.5 text-[11px] font-semibold text-white">{thread.unread > 9 ? '9+' : thread.unread}</span>}
          </button>
        ))}
      </div>
    </>
  );
}

function MailCompose({
  address, to, subject, photo, sending, error, signedOut, onTo, onSubject, onDraft, onPhoto, onSubmit,
}: {
  address: string | null;
  to: string;
  subject: string;
  photo: string | null;
  sending: boolean;
  error: string | null;
  signedOut: boolean;
  onTo: (value: string) => void;
  onSubject: (value: string) => void;
  onDraft: (text: string, html: string) => void;
  onPhoto: (value: string | null) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col bg-[#f4f3f0]">
      <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-6 py-6">
        <div className="mb-4">
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">New message</h2>
          <p className="mt-1 text-sm text-gray-500">{address ? `From ${address}` : 'Set a username before sending.'}</p>
        </div>
        {signedOut ? (
          <p className="text-sm text-gray-500">Sign in to send mail.</p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-black/5 bg-white px-6 shadow-sm">
            <label className="flex items-center gap-3 border-b border-gray-100 py-3 text-sm">
              <span className="w-16 text-gray-400">To</span>
              <input value={to} onChange={(event) => onTo(event.target.value)} required placeholder="name@example.com" className="min-w-0 flex-1 outline-none" />
            </label>
            <label className="flex items-center gap-3 border-b border-gray-100 py-3 text-sm">
              <span className="w-16 text-gray-400">Subject</span>
              <input value={subject} onChange={(event) => onSubject(event.target.value)} placeholder="Subject" className="min-w-0 flex-1 font-medium outline-none" />
            </label>
            <LetterEditor onDraft={onDraft} />
            {photo && <img src={photo} alt="" className="mb-3 h-auto max-h-64 w-auto max-w-full shrink-0 self-start rounded-xl object-contain" />}
            {error && <p className="pb-2 text-sm text-red-600">{error}</p>}
            <div className="flex items-center gap-3 border-t border-gray-100 py-3">
              <button type="submit" disabled={sending} className="rounded-full bg-[#1a73e8] px-5 py-2 text-sm font-medium text-white hover:bg-[#1765cc] disabled:opacity-60">
                {sending ? 'Sending' : 'Send'}
              </button>
              <label className="cursor-pointer rounded-full px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-800">
                Attach photo
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (file.size > 380_000) {
                      onPhoto(null);
                      return;
                    }
                    void readFile(file).then(onPhoto);
                  }}
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}

function EditorButton({ label, className, onPress }: { label: string; className?: string; onPress: () => void }) {
  return (
    <button type="button" onMouseDown={(event) => { event.preventDefault(); onPress(); }} className={`rounded px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 ${className || ''}`}>
      {label}
    </button>
  );
}

function LetterEditor({ onDraft }: { onDraft: (text: string, html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(true);
  const read = () => {
    const el = ref.current;
    if (!el) return;
    const text = el.innerText.replace(/\u00a0/g, ' ').replace(/\n$/, '').trim();
    setEmpty(!text);
    onDraft(text, el.innerHTML);
  };
  const command = (name: string, value?: string) => {
    ref.current?.focus();
    document.execCommand(name, false, value);
    read();
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-0.5 border-b border-gray-100 py-2">
        <EditorButton label="B" className="font-bold" onPress={() => command('bold')} />
        <EditorButton label="I" className="italic" onPress={() => command('italic')} />
        <EditorButton label="U" className="underline" onPress={() => command('underline')} />
        <EditorButton label="List" onPress={() => command('insertUnorderedList')} />
        <EditorButton label="Link" onPress={() => {
          const url = window.prompt('Link address');
          if (!url) return;
          const href = /^https?:\/\//i.test(url) || /^mailto:/i.test(url) ? url : `https://${url}`;
          command('createLink', href);
        }} />
      </div>
      <div className="relative min-h-32 flex-1">
        {empty && <span className="pointer-events-none absolute left-0 top-3 text-[15px] text-gray-400">Write your message</span>}
        <div ref={ref} contentEditable role="textbox" aria-multiline="true" aria-label="Message" className="min-h-32 py-3 text-[15px] leading-7 outline-none" onInput={read} />
      </div>
    </div>
  );
}

function UnreadCount({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="grid h-5 min-w-5 place-items-center rounded-full bg-orange-500 px-1.5 text-[11px] font-semibold text-white">{count > 9 ? '9+' : count}</span>;
}

function accountUrl(address: string) {
  const username = address.split('@')[0];
  return `https://gotcarrot.com/people/${encodeURIComponent(username)}`;
}

function LetterSignature({ address }: { address: string }) {
  const username = address.split('@')[0];
  const name = username ? username.charAt(0).toUpperCase() + username.slice(1) : address;
  const account = accountUrl(address);
  return (
    <footer className="mt-8 border-t border-[#e6e6e6] pt-4">
      <div className="flex items-center gap-3">
        <img src="/carrot-logo.png" alt="" width={64} height={64} className="h-16 w-16 object-contain" />
        <div>
          <p className="text-[16px] font-bold leading-5 text-[#1a365d]">{name}</p>
          <p className="text-[13px] leading-5 text-[#5f6b76]">gotcarrot.com</p>
        </div>
      </div>
      <p className="mt-3 text-[13px] leading-5 text-[#3c4043]"><span className="mr-3 text-[#5f6b76]">Email</span><a href={`mailto:${address}`} className="text-[#1a73e8]">{address}</a></p>
      <p className="text-[13px] leading-5 text-[#3c4043]"><span className="mr-3 text-[#5f6b76]">Account</span><a href={account} className="text-[#1a73e8]">{`gotcarrot.com/people/${username}`}</a></p>
    </footer>
  );
}

function letterWhen(at: number) {
  return new Date(at).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function MailRead({ thread, lines, loading, address, timesReady, sending, error, onSend }: { thread: Thread; lines: Line[]; loading: boolean; address: string | null; timesReady: boolean; sending: boolean; error: string | null; onSend: (text: string, html: string) => Promise<void> }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [draftKey, setDraftKey] = useState(0);
  const draft = useRef({ text: '', html: '' });
  const letters = [...lines].sort((a, b) => b.at - a.at);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [thread.id]);
  const reply = (
    <form
      className="rounded-2xl border border-black/5 bg-white px-6 shadow-sm"
      onSubmit={(event) => {
        event.preventDefault();
        if (!draft.current.text || sending) return;
        void onSend(draft.current.text, draft.current.html).then(() => {
          draft.current = { text: '', html: '' };
          setDraftKey((key) => key + 1);
        }).catch(() => undefined);
      }}
    >
      <p className="pt-4 text-sm text-gray-500">Reply to {thread.name}</p>
      <LetterEditor key={draftKey} onDraft={(text, html) => { draft.current = { text, html }; }} />
      {error && <p className="pb-2 text-sm text-red-600">{error}</p>}
      <div className="border-t border-gray-100 py-3">
        <button type="submit" disabled={sending} className="rounded-full bg-[#1a73e8] px-5 py-2 text-sm font-medium text-white hover:bg-[#1765cc] disabled:opacity-60">
          {sending ? 'Sending' : 'Send'}
        </button>
      </div>
    </form>
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#f4f3f0]">
      <div ref={scroller} className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl">
          <h2 className="px-1 text-[28px] font-semibold tracking-tight text-gray-900">{thread.subject || '(no subject)'}</h2>
          {loading && (
            <div className="mt-4 rounded-2xl border border-black/5 bg-white px-6 py-8 text-sm text-gray-500 shadow-sm">Opening this letter…</div>
          )}
          <div className="mt-4 space-y-4">
            {letters.map((line, index) => {
              const mine = line.from === 'me';
              const who = mine ? 'You' : thread.name;
              const failed = mine && line.state === 'failed';
              return (
                <div key={line.id} className="space-y-4">
                  <article className="rounded-2xl border border-black/5 bg-white px-6 py-5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <Avatar name={who} color={colorFor(who)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-gray-900">{who}</p>
                            {mine && address && <p className="truncate text-sm text-gray-500">{address}</p>}
                          </div>
                          <p className="shrink-0 text-xs text-gray-400" suppressHydrationWarning>{timesReady ? letterWhen(line.at) : ''}</p>
                        </div>
                        <p className="mt-2 text-sm text-gray-500">To {mine ? thread.name : (address || 'you')}</p>
                        {mine && (
                          <p className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${failed ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>
                            {failed ? 'Not sent' : 'Sent'}
                          </p>
                        )}
                        {failed && sendNote(line) !== 'Not sent' && <p className="mt-2 text-sm leading-6 text-red-700">{sendNote(line).replace(/^Not sent\.\s*/, '')}</p>}
                      </div>
                    </div>
                    {line.image && <img src={line.image} alt="" className="mt-5 h-auto max-h-80 w-auto max-w-full rounded-xl object-contain" />}
                    <p className="mt-5 whitespace-pre-wrap text-[16px] leading-8 text-gray-900">{line.text}</p>
                    {line.earlier && (
                      <p className="mt-4 whitespace-pre-wrap border-l-2 border-stone-200 pl-3 text-sm leading-6 text-gray-500">{line.earlier}</p>
                    )}
                    {mine && !failed && address && <LetterSignature address={address} />}
                  </article>
                  {index === 0 && reply}
                </div>
              );
            })}
            {!loading && letters.length === 0 && (
              <>
                <div className="rounded-2xl border border-black/5 bg-white px-6 py-10 text-sm text-gray-500 shadow-sm">This message has no body yet.</div>
                {reply}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


