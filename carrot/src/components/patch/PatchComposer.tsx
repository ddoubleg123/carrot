'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { X, FileText, Calendar, Link, MessageSquare, Upload, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

interface Patch {
  id: string;
  handle: string;
  title?: string;
  name?: string;
}

interface PatchComposerProps {
  isOpen: boolean;
  onClose: () => void;
  patch: Patch;
}

const documentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  tags: z.string().optional(),
  file: z.any().optional()
});

const eventSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  summary: z.string().min(1, 'Summary is required'),
  dateStart: z.string().min(1, 'Start date is required'),
  dateEnd: z.string().optional(),
  tags: z.string().optional(),
  sourceUrl: z.string().url('Must be a valid URL').optional().or(z.literal(''))
});

const sourceSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  url: z.string().url('Must be a valid URL'),
  author: z.string().optional(),
  publisher: z.string().optional()
});

const discussionSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.string().min(1, 'Content is required'),
  tags: z.string().optional()
});

type DocumentForm = z.infer<typeof documentSchema>;
type EventForm = z.infer<typeof eventSchema>;
type SourceForm = z.infer<typeof sourceSchema>;
type DiscussionForm = z.infer<typeof discussionSchema>;

const composerTypes = [
  { id: 'document', label: 'Document', icon: FileText, description: 'PDF, image, video, or text' },
  { id: 'event', label: 'Event', icon: Calendar, description: 'Timeline entry' },
  { id: 'source', label: 'Source', icon: Link, description: 'Link or upload' },
  { id: 'discussion', label: 'Discussion', icon: MessageSquare, description: 'Text post' }
];

export default function PatchComposer({ isOpen, onClose, patch }: PatchComposerProps) {
  const [activeType, setActiveType] = useState('document');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const documentForm = useForm<DocumentForm>({
    resolver: zodResolver(documentSchema),
    defaultValues: { title: '', content: '', tags: '', file: null }
  });

  const eventForm = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: { title: '', summary: '', dateStart: '', dateEnd: '', tags: '', sourceUrl: '' }
  });

  const sourceForm = useForm<SourceForm>({
    resolver: zodResolver(sourceSchema),
    defaultValues: { title: '', url: '', author: '', publisher: '' }
  });

  const discussionForm = useForm<DiscussionForm>({
    resolver: zodResolver(discussionSchema),
    defaultValues: { title: '', content: '', tags: '' }
  });

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      // TODO: Implement API call based on activeType
      console.log(`Submitting ${activeType}:`, data);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reset forms and close modal
      documentForm.reset();
      eventForm.reset();
      sourceForm.reset();
      discussionForm.reset();
      onClose();
    } catch (error) {
      console.error('Error submitting:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl border border-[#E6E8EC] shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#E6E8EC]">
          <div>
            <h2 className="text-xl font-semibold text-[#0B0B0F]">Create Post</h2>
            <p className="text-sm text-[#60646C] mt-1">Add content to {patch.title || patch.name}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-[#60646C] hover:text-[#0B0B0F]"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Type Selector */}
        <div className="p-6 border-b border-[#E6E8EC]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {composerTypes.map((type) => {
              const Icon = type.icon;
              return (
                <button
                  key={type.id}
                  onClick={() => setActiveType(type.id)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    activeType === type.id
                      ? 'border-[#FF6A00] bg-[#FF6A00]/5'
                      : 'border-[#E6E8EC] hover:border-[#60646C]'
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-2 ${
                    activeType === type.id ? 'text-[#FF6A00]' : 'text-[#60646C]'
                  }`} />
                  <div className="text-sm font-medium text-[#0B0B0F]">{type.label}</div>
                  <div className="text-xs text-[#60646C] mt-1">{type.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {activeType === 'document' && (
            <form onSubmit={documentForm.handleSubmit(handleSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  {...documentForm.register('title')}
                  placeholder="Document title"
                />
                {documentForm.formState.errors.title && (
                  <p className="text-sm text-red-600 mt-1">
                    {documentForm.formState.errors.title.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  {...documentForm.register('content')}
                  placeholder="Document content or description"
                  rows={4}
                />
                {documentForm.formState.errors.content && (
                  <p className="text-sm text-red-600 mt-1">
                    {documentForm.formState.errors.content.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="file">Upload File (Optional)</Label>
                <div className="border-2 border-dashed border-[#E6E8EC] rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 text-[#60646C] mx-auto mb-2" />
                  <p className="text-sm text-[#60646C]">Click to upload or drag and drop</p>
                  <p className="text-xs text-[#60646C] mt-1">PDF, images, videos supported</p>
                </div>
              </div>

              <div>
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  {...documentForm.register('tags')}
                  placeholder="tag1, tag2, tag3"
                />
              </div>
            </form>
          )}

          {activeType === 'event' && (
            <form onSubmit={eventForm.handleSubmit(handleSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="title">Event Title</Label>
                <Input
                  id="title"
                  {...eventForm.register('title')}
                  placeholder="Event title"
                />
                {eventForm.formState.errors.title && (
                  <p className="text-sm text-red-600 mt-1">
                    {eventForm.formState.errors.title.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="summary">Summary</Label>
                <Textarea
                  id="summary"
                  {...eventForm.register('summary')}
                  placeholder="Event summary"
                  rows={3}
                />
                {eventForm.formState.errors.summary && (
                  <p className="text-sm text-red-600 mt-1">
                    {eventForm.formState.errors.summary.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="dateStart">Start Date</Label>
                  <Input
                    id="dateStart"
                    type="date"
                    {...eventForm.register('dateStart')}
                  />
                  {eventForm.formState.errors.dateStart && (
                    <p className="text-sm text-red-600 mt-1">
                      {eventForm.formState.errors.dateStart.message}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="dateEnd">End Date (Optional)</Label>
                  <Input
                    id="dateEnd"
                    type="date"
                    {...eventForm.register('dateEnd')}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="sourceUrl">Source URL (Optional)</Label>
                <Input
                  id="sourceUrl"
                  {...eventForm.register('sourceUrl')}
                  placeholder="https://example.com"
                />
                {eventForm.formState.errors.sourceUrl && (
                  <p className="text-sm text-red-600 mt-1">
                    {eventForm.formState.errors.sourceUrl.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  {...eventForm.register('tags')}
                  placeholder="tag1, tag2, tag3"
                />
              </div>
            </form>
          )}

          {activeType === 'source' && (
            <form onSubmit={sourceForm.handleSubmit(handleSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="title">Source Title</Label>
                <Input
                  id="title"
                  {...sourceForm.register('title')}
                  placeholder="Source title"
                />
                {sourceForm.formState.errors.title && (
                  <p className="text-sm text-red-600 mt-1">
                    {sourceForm.formState.errors.title.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  {...sourceForm.register('url')}
                  placeholder="https://example.com"
                />
                {sourceForm.formState.errors.url && (
                  <p className="text-sm text-red-600 mt-1">
                    {sourceForm.formState.errors.url.message}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="author">Author (Optional)</Label>
                  <Input
                    id="author"
                    {...sourceForm.register('author')}
                    placeholder="Author name"
                  />
                </div>
                <div>
                  <Label htmlFor="publisher">Publisher (Optional)</Label>
                  <Input
                    id="publisher"
                    {...sourceForm.register('publisher')}
                    placeholder="Publisher name"
                  />
                </div>
              </div>
            </form>
          )}

          {activeType === 'discussion' && (
            <form onSubmit={discussionForm.handleSubmit(handleSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="title">Discussion Title</Label>
                <Input
                  id="title"
                  {...discussionForm.register('title')}
                  placeholder="Discussion title"
                />
                {discussionForm.formState.errors.title && (
                  <p className="text-sm text-red-600 mt-1">
                    {discussionForm.formState.errors.title.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  {...discussionForm.register('content')}
                  placeholder="Start a discussion..."
                  rows={6}
                />
                {discussionForm.formState.errors.content && (
                  <p className="text-sm text-red-600 mt-1">
                    {discussionForm.formState.errors.content.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="tags">Tags (comma-separated)</Label>
                <Input
                  id="tags"
                  {...discussionForm.register('tags')}
                  placeholder="tag1, tag2, tag3"
                />
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-[#E6E8EC]">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={() => {
              if (activeType === 'document') documentForm.handleSubmit(handleSubmit)();
              if (activeType === 'event') eventForm.handleSubmit(handleSubmit)();
              if (activeType === 'source') sourceForm.handleSubmit(handleSubmit)();
              if (activeType === 'discussion') discussionForm.handleSubmit(handleSubmit)();
            }}
            disabled={isSubmitting}
            className="bg-[#FF6A00] hover:bg-[#E55A00] text-white"
          >
            {isSubmitting ? 'Creating...' : 'Create Post'}
          </Button>
        </div>
      </div>
    </div>
  );
}
