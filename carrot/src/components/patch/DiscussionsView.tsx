'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, ThumbsUp } from 'lucide-react';

interface Discussion {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  likes: number;
}

interface DiscussionsViewProps {
  patch: {
    id: string;
    name: string;
  };
}

function storageKey(patchId: string) {
  return `carrot-patch-discussions:${patchId}`;
}

export default function DiscussionsView({ patch }: DiscussionsViewProps) {
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(patch.id));
      const parsed = raw ? JSON.parse(raw) : [];
      setDiscussions(Array.isArray(parsed) ? parsed : []);
    } catch {
      setDiscussions([]);
    }
  }, [patch.id]);

  const save = (next: Discussion[]) => {
    setDiscussions(next);
    localStorage.setItem(storageKey(patch.id), JSON.stringify(next));
  };

  const handleStart = (event: FormEvent) => {
    event.preventDefault();
    const nextTitle = title.trim();
    const nextContent = content.trim();
    if (!nextTitle || !nextContent) return;
    save([
      {
        id: `${Date.now()}`,
        title: nextTitle,
        content: nextContent,
        createdAt: new Date().toISOString(),
        likes: 0
      },
      ...discussions
    ]);
    setTitle('');
    setContent('');
    setOpen(false);
  };

  const handleLike = (id: string) => {
    save(discussions.map((item) => item.id === id ? { ...item, likes: item.likes + 1 } : item));
  };

  return (
    <div className="space-y-6 px-6 md:px-10">
      <div className="rounded-2xl border border-[#E6E8EC] bg-white p-5 shadow-sm md:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-[#0B0B0F]">Discuss</h2>
            <p className="mt-1 text-sm text-[#60646C]">Talk about what this group is learning.</p>
          </div>
          <Button className="bg-[#FF6A00] text-white hover:bg-[#E55A00]" onClick={() => setOpen((value) => !value)}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Start discussion
          </Button>
        </div>
        {open && (
          <form onSubmit={handleStart} className="mt-5 space-y-3">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What should the group talk about?"
              aria-label="Discussion title"
            />
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Add the point you want people to respond to."
              aria-label="Discussion"
              rows={4}
              className="w-full rounded-lg border border-[#E6E8EC] px-3 py-2 text-sm outline-none focus:border-[#FF6A00]"
            />
            <Button type="submit" disabled={!title.trim() || !content.trim()} className="bg-[#FF6A00] text-white hover:bg-[#E55A00]">
              Post
            </Button>
          </form>
        )}
      </div>

      {discussions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#E6E8EC] bg-white px-6 py-16 text-center">
          <h3 className="text-lg font-semibold text-[#0B0B0F]">No discussions yet</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-[#60646C]">
            Start one from something you just learned about {patch.name}.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {discussions.map((discussion) => (
            <article key={discussion.id} className="rounded-2xl border border-[#E6E8EC] bg-white p-5 shadow-sm">
              <h3 className="font-medium text-[#0B0B0F]">{discussion.title}</h3>
              <p className="mt-1 text-xs text-[#60646C]">{new Date(discussion.createdAt).toLocaleString()}</p>
              <p className="mt-3 text-sm leading-relaxed text-[#0B0B0F]">{discussion.content}</p>
              <Button variant="ghost" size="sm" className="mt-3 text-[#60646C]" onClick={() => handleLike(discussion.id)}>
                <ThumbsUp className="mr-1 h-4 w-4" />
                {discussion.likes}
              </Button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
