'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  FileText, 
  Calendar, 
  BookOpen, 
  Search,
  X,
  Sparkles
} from 'lucide-react';

interface AIAgentDockProps {
  patchId: string;
  onAddFact?: (fact: { label: string; value: string; sourceId?: string }) => void;
  onAddEvent?: (event: { title: string; dateStart: string; summary: string; tags: string[] }) => void;
  onAddSource?: (source: { title: string; url: string; author?: string; publisher?: string }) => void;
  onSummarize?: (content: string) => void;
}

export default function AIAgentDock({ 
  patchId, 
  onAddFact, 
  onAddEvent, 
  onAddSource, 
  onSummarize 
}: AIAgentDockProps) {
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const agents = [
    {
      id: 'summarize',
      icon: FileText,
      label: 'Summarize',
      description: 'AI summary of content',
      color: 'bg-blue-500',
    },
    {
      id: 'add-fact',
      icon: BookOpen,
      label: 'Add Fact',
      description: 'Add key information',
      color: 'bg-green-500',
    },
    {
      id: 'add-event',
      icon: Calendar,
      label: 'Add Event',
      description: 'Add timeline event',
      color: 'bg-orange-500',
    },
    {
      id: 'find-sources',
      icon: Search,
      label: 'Find Sources',
      description: 'Discover references',
      color: 'bg-purple-500',
    },
  ];

  const handleAgentAction = async (agentId: string, data: any) => {
    setIsProcessing(true);
    
    // Simulate AI processing
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    try {
      switch (agentId) {
        case 'add-fact':
          onAddFact?.(data);
          break;
        case 'add-event':
          onAddEvent?.(data);
          break;
        case 'add-source':
          onAddSource?.(data);
          break;
        case 'summarize':
          onSummarize?.(data.content);
          break;
      }
      
      setActiveSheet(null);
    } catch (error) {
      console.error('Agent action failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Floating dock */}
      <div className="fixed right-4 top-1/2 transform -translate-y-1/2 z-30">
        <div className="bg-white rounded-2xl shadow-lg border border-[#E6E8EC] p-2">
          <div className="space-y-2">
            {agents.map((agent) => {
              const Icon = agent.icon;
              return (
                <Sheet key={agent.id} open={activeSheet === agent.id} onOpenChange={(open) => setActiveSheet(open ? agent.id : null)}>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-12 h-12 p-0 flex flex-col items-center justify-center gap-1 hover:bg-gray-50"
                      title={agent.description}
                    >
                      <div className={`w-8 h-8 rounded-full ${agent.color} flex items-center justify-center`}>
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-96">
                    <SheetHeader>
                      <SheetTitle className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full ${agent.color} flex items-center justify-center`}>
                          <Icon className="w-3 h-3 text-white" />
                        </div>
                        {agent.label}
                      </SheetTitle>
                    </SheetHeader>
                    
                    <div className="mt-6">
                      {agent.id === 'summarize' && (
                        <SummarizeForm 
                          onSubmit={(data) => handleAgentAction('summarize', data)}
                          isProcessing={isProcessing}
                        />
                      )}
                      
                      {agent.id === 'add-fact' && (
                        <AddFactForm 
                          onSubmit={(data) => handleAgentAction('add-fact', data)}
                          isProcessing={isProcessing}
                        />
                      )}
                      
                      {agent.id === 'add-event' && (
                        <AddEventForm 
                          onSubmit={(data) => handleAgentAction('add-event', data)}
                          isProcessing={isProcessing}
                        />
                      )}
                      
                      {agent.id === 'find-sources' && (
                        <FindSourcesForm 
                          onSubmit={(data) => handleAgentAction('add-source', data)}
                          isProcessing={isProcessing}
                        />
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

// Form components for each agent
function SummarizeForm({ onSubmit, isProcessing }: { onSubmit: (data: any) => void; isProcessing: boolean }) {
  const [content, setContent] = useState('');

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ content }); }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[#0B0B0F] mb-2">
          Content to summarize
        </label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Paste text, URL, or describe what you want summarized..."
          className="min-h-[120px]"
          required
        />
      </div>
      <Button 
        type="submit" 
        disabled={!content.trim() || isProcessing}
        className="w-full bg-[#0A5AFF] hover:bg-[#0A5AFF]/90"
      >
        {isProcessing ? (
          <>
            <Sparkles className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          'Generate Summary'
        )}
      </Button>
    </form>
  );
}

function AddFactForm({ onSubmit, isProcessing }: { onSubmit: (data: any) => void; isProcessing: boolean }) {
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ label, value }); }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[#0B0B0F] mb-2">
          Fact Label
        </label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g., Population, Founded, Location"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#0B0B0F] mb-2">
          Fact Value
        </label>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter the fact details..."
          className="min-h-[80px]"
          required
        />
      </div>
      <Button 
        type="submit" 
        disabled={!label.trim() || !value.trim() || isProcessing}
        className="w-full bg-green-600 hover:bg-green-700"
      >
        {isProcessing ? 'Adding...' : 'Add Fact'}
      </Button>
    </form>
  );
}

function AddEventForm({ onSubmit, isProcessing }: { onSubmit: (data: any) => void; isProcessing: boolean }) {
  const [title, setTitle] = useState('');
  const [dateStart, setDateStart] = useState('');
  const [summary, setSummary] = useState('');
  const [tags, setTags] = useState('');

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ 
      title, 
      dateStart, 
      summary, 
      tags: tags.split(',').map(t => t.trim()).filter(Boolean) 
    }); }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[#0B0B0F] mb-2">
          Event Title
        </label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., First Amendment Ratified"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#0B0B0F] mb-2">
          Date
        </label>
        <Input
          type="date"
          value={dateStart}
          onChange={(e) => setDateStart(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#0B0B0F] mb-2">
          Summary
        </label>
        <Textarea
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Describe what happened..."
          className="min-h-[80px]"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#0B0B0F] mb-2">
          Tags (comma-separated)
        </label>
        <Input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="e.g., constitutional, rights, history"
        />
      </div>
      <Button 
        type="submit" 
        disabled={!title.trim() || !dateStart || !summary.trim() || isProcessing}
        className="w-full bg-orange-600 hover:bg-orange-700"
      >
        {isProcessing ? 'Adding...' : 'Add Event'}
      </Button>
    </form>
  );
}

function FindSourcesForm({ onSubmit, isProcessing }: { onSubmit: (data: any) => void; isProcessing: boolean }) {
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [author, setAuthor] = useState('');

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ title, url, author }); }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-[#0B0B0F] mb-2">
          Search Query
        </label>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What sources are you looking for?"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#0B0B0F] mb-2">
          Source Title
        </label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title of the source"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#0B0B0F] mb-2">
          URL
        </label>
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[#0B0B0F] mb-2">
          Author (optional)
        </label>
        <Input
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Author name"
        />
      </div>
      <Button 
        type="submit" 
        disabled={!title.trim() || !url.trim() || isProcessing}
        className="w-full bg-purple-600 hover:bg-purple-700"
      >
        {isProcessing ? 'Adding...' : 'Add Source'}
      </Button>
    </form>
  );
}
