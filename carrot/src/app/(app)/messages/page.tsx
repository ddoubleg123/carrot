'use client';

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import {
  Mail,
  MessageSquareText,
  AtSign,
  Search,
  Filter,
  Paperclip,
  Send,
  ChevronDown,
  Archive,
  Clock,
  AlertTriangle,
} from 'lucide-react';

// Tokens
const PANE_GAP = 'gap-4 md:gap-6';
const SECTION_GAP = 'space-y-3';

// Types
type Channel = 'email' | 'text' | 'dm';

type Conversation = {
  id: string;
  participants: string[];
  subject?: string;
  preview: string;
  timestamp: string;
  unread?: boolean;
  channel: Channel;
  badges?: Array<'needs-reply' | 'failed' | 'has-attachments'>;
};

type Message = {
  id: string;
  author: string;
  at: string;
  channel: Channel;
  body: string;
  attachments?: number;
  state?: 'sent' | 'delivered' | 'read' | 'failed';
};

export default function MessagesPage() {
  // Channel selection is UI-only (no backend yet)
  const [channel, setChannel] = useState<Channel | 'all'>('all');
  const [active, setActive] = useState<string>('c1');

  // Demo data
  const conversations: Conversation[] = [
    {
      id: 'c1',
      participants: ['Ada Lovelace'],
      subject: 'Algorithm review for tomorrow',
      preview: 'Drafted notes on the computation flow and edge cases…',
      timestamp: '2:41 PM',
      unread: true,
      channel: 'email',
      badges: ['has-attachments'],
    },
    {
      id: 'c2',
      participants: ['Team Ops'],
      preview: 'Can you confirm the SMS opt‑out copy?',
      timestamp: '1:18 PM',
      channel: 'text',
      badges: ['needs-reply'],
    },
    {
      id: 'c3',
      participants: ['Alan Turing'],
      preview: 'Typing…',
      timestamp: '12:07 PM',
      channel: 'dm',
    },
  ];

  const thread: Message[] = [
    {
      id: 'm1',
      author: 'Ada Lovelace',
      at: '2:31 PM',
      channel: 'email',
      body: 'Here is the updated outline of the algorithm with clearer steps and constraints.',
      attachments: 2,
      state: 'read',
    },
    {
      id: 'm2',
      author: 'You',
      at: '2:40 PM',
      channel: 'email',
      body: 'Thanks! I will annotate complexity and run quick tests before EOD.',
      state: 'delivered',
    },
  ];

  const filtered = useMemo(() => {
    if (channel === 'all') return conversations;
    return conversations.filter((c) => c.channel === channel);
  }, [channel]);

  return (
    <div className={`h-full w-full ${PANE_GAP} p-3 md:p-6 grid`} style={{ gridTemplateColumns: '280px 420px 1fr' }}>
      {/* Left rail */}
      <aside className="hidden md:flex flex-col border rounded-lg p-3 bg-white">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">Channels</h2>
          <Button variant="outline" size="sm" className="gap-2"><Filter className="w-4 h-4"/>Filters</Button>
        </div>
        <div className="grid grid-cols-1 gap-2">
          <ChannelButton active={channel==='all'} onClick={() => setChannel('all')} icon={<AllIcon/>} label="All" count={27} />
          <ChannelButton active={channel==='email'} onClick={() => setChannel('email')} icon={<Mail className="w-4 h-4"/>} label="Email" count={12} />
          <ChannelButton active={channel==='text'} onClick={() => setChannel('text')} icon={<MessageSquareText className="w-4 h-4"/>} label="Text" count={8} />
          <ChannelButton active={channel==='dm'} onClick={() => setChannel('dm')} icon={<AtSign className="w-4 h-4"/>} label="DMs" count={7} />
        </div>

        <div className="mt-4">
          <h3 className="text-xs font-medium text-gray-500 mb-2">Folders</h3>
          <div className="grid gap-1 text-sm">
            <FolderLink label="Inbox" count={18} />
            <FolderLink label="Assigned" count={3} />
            <FolderLink label="Snoozed" count={2} icon={<Clock className="w-3.5 h-3.5"/>} />
            <FolderLink label="Sent" />
            <FolderLink label="Drafts" />
            <FolderLink label="Archived" icon={<Archive className="w-3.5 h-3.5"/>} />
            <FolderLink label="Spam" icon={<AlertTriangle className="w-3.5 h-3.5"/>} />
          </div>
        </div>

        <div className="mt-4">
          <h3 className="text-xs font-medium text-gray-500 mb-2">Quick filters</h3>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Unread</Badge>
            <Badge variant="secondary">Needs reply</Badge>
            <Badge variant="secondary">Has attachments</Badge>
          </div>
        </div>

        <div className="mt-auto pt-3">
          <Button className="w-full">New message</Button>
        </div>
      </aside>

      {/* Conversation list */}
      <section className="flex flex-col border rounded-lg bg-white">
        <div className="p-3 border-b flex items-center gap-2">
          <div className="relative flex-1">
            <Input placeholder="Search messages" className="pl-9" />
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
          <Button variant="outline" className="gap-2"><Filter className="w-4 h-4"/>Sort</Button>
        </div>

        <div className="flex-1 overflow-auto divide-y">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => setActive(c.id)}
              className={`w-full text-left p-3 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none ${active===c.id ? 'bg-gray-50' : ''}`}
            >
              <ConversationItem c={c} />
            </button>
          ))}
        </div>
      </section>

      {/* Thread + Composer */}
      <section className="flex flex-col border rounded-lg bg-white">
        {/* Thread header */}
        <div className="p-3 border-b flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Ada Lovelace</h2>
              <ChannelChip channel="email" />
            </div>
            <p className="text-sm text-gray-600">Algorithm review for tomorrow</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1">Archive</Button>
            <Button variant="outline" size="sm" className="gap-1">Snooze</Button>
            <Button variant="outline" size="sm" className="gap-1">More<ChevronDown className="w-4 h-4"/></Button>
          </div>
        </div>

        {/* Thread log */}
        <div className="flex-1 overflow-auto p-3 ${SECTION_GAP}">
          <div className="space-y-3">
            {thread.map((m) => (
              <MessageCard key={m.id} m={m} />
            ))}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t">
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="email" className="gap-2"><Mail className="w-4 h-4"/>Email</TabsTrigger>
              <TabsTrigger value="text" className="gap-2"><MessageSquareText className="w-4 h-4"/>Text</TabsTrigger>
              <TabsTrigger value="dm" className="gap-2"><AtSign className="w-4 h-4"/>DM</TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="p-3">
              <Card className="shadow-none border-0">
                <CardContent className="p-0 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="To" />
                    <Input placeholder="CC/BCC" />
                  </div>
                  <Input placeholder="Subject" />
                  <textarea className="w-full min-h-[120px] rounded-md border p-2 text-sm" placeholder="Write your email…" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Button variant="outline" size="sm" className="gap-1"><Paperclip className="w-4 h-4"/>Attach</Button>
                      <span>Signature enabled</span>
                    </div>
                    <Button className="gap-2"><Send className="w-4 h-4"/>Send</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="text" className="p-3">
              <Card className="shadow-none border-0">
                <CardContent className="p-0 space-y-2">
                  <Input placeholder="Recipient" />
                  <div className="space-y-2">
                    <textarea className="w-full min-h-[100px] rounded-md border p-2 text-sm" placeholder="Write your text message…" />
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>0/160</span>
                      <span>MMS supported</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Button variant="outline" size="sm" className="gap-1"><Paperclip className="w-4 h-4"/>Media</Button>
                    <Button className="gap-2"><Send className="w-4 h-4"/>Send</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dm" className="p-3">
              <Card className="shadow-none border-0">
                <CardContent className="p-0 space-y-2">
                  <Input placeholder="Recipient(s)" />
                  <textarea className="w-full min-h-[100px] rounded-md border p-2 text-sm" placeholder="Write your message… Use @ to mention" />
                  <div className="flex items-center justify-end">
                    <Button className="gap-2"><Send className="w-4 h-4"/>Send</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </div>
  );
}

// Components
function ChannelButton({ active, onClick, icon, label, count }: { active?: boolean; onClick?: () => void; icon: React.ReactNode; label: string; count?: number; }) {
  return (
    <button onClick={onClick} className={`flex items-center justify-between px-2.5 py-2 rounded-md border text-sm ${active ? 'bg-gray-50 border-gray-300' : 'border-transparent hover:bg-gray-50'}`}>
      <span className="flex items-center gap-2">{icon}<span>{label}</span></span>
      {typeof count === 'number' && (
        <Badge variant={active ? 'default' : 'secondary'}>{count}</Badge>
      )}
    </button>
  );
}

function FolderLink({ label, count, icon }: { label: string; count?: number; icon?: React.ReactNode; }) {
  return (
    <button className="flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-50 text-left">
      <span className="flex items-center gap-2 text-gray-700 text-sm">{icon}<span>{label}</span></span>
      {typeof count === 'number' && <span className="text-xs text-gray-500">{count}</span>}
    </button>
  );
}

function ChannelChip({ channel }: { channel: Channel; }) {
  const palette = channel === 'email' ? 'bg-blue-50 text-blue-700' : channel === 'text' ? 'bg-green-50 text-green-700' : 'bg-purple-50 text-purple-700';
  const Icon = channel === 'email' ? Mail : channel === 'text' ? MessageSquareText : AtSign;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${palette}`}>
      <Icon className="w-3.5 h-3.5" />
      {channel === 'email' ? 'Email' : channel === 'text' ? 'Text' : 'DM'}
    </span>
  );
}

function ConversationItem({ c }: { c: Conversation; }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs flex-shrink-0">
        {c.participants[0]?.split(' ').map(n => n[0]).join('')}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{c.participants.join(', ')}</p>
          <ChannelChip channel={c.channel} />
          {c.badges?.includes('needs-reply') && <Badge variant="outline" className="text-xs">Needs reply</Badge>}
          {c.badges?.includes('failed') && <Badge variant="destructive" className="text-xs">Failed</Badge>}
          {c.badges?.includes('has-attachments') && <Badge variant="secondary" className="text-xs"><Paperclip className="w-3 h-3 mr-1"/>Files</Badge>}
          <span className="ml-auto text-xs text-gray-500 whitespace-nowrap">{c.timestamp}</span>
        </div>
        {c.subject && <p className="text-sm text-gray-900 truncate">{c.subject}</p>}
        <p className="text-sm text-gray-600 line-clamp-2">{c.preview}</p>
      </div>
      {c.unread && <span className="w-2 h-2 rounded-full bg-blue-600 mt-1" />}
    </div>
  );
}

function MessageCard({ m }: { m: Message; }) {
  const stateLabel = m.state === 'read' ? 'Read' : m.state === 'delivered' ? 'Delivered' : m.state === 'failed' ? 'Failed' : 'Sent';
  return (
    <div className="flex items-start gap-2">
      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-xs flex-shrink-0">
        {m.author.split(' ').map(n => n[0]).join('')}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium">{m.author}</p>
          <ChannelChip channel={m.channel} />
          <span className="text-xs text-gray-500">{m.at}</span>
          <span className="ml-auto text-xs text-gray-500">{stateLabel}</span>
        </div>
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{m.body}</p>
        {m.attachments ? (
          <div className="mt-2 inline-flex items-center gap-1 text-xs text-gray-600"><Paperclip className="w-3 h-3"/>{m.attachments} attachment(s)</div>
        ) : null}
      </div>
    </div>
  );
}

function AllIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 12h10M12 7v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
