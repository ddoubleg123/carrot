import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import dynamic from 'next/dynamic';

const EmojiPicker = dynamic<any>(() => import('emoji-picker-react'), { ssr: false });

interface CreatePostModalProps {
  open: boolean;
  mediaPreview: string;
  mediaType: string;
  onClose: () => void;
  onPost: (content: string, emoji: string | undefined) => void;
}

export default function CreatePostModal({ open, mediaPreview, mediaType, onClose, onPost }: CreatePostModalProps) {
  const [content, setContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState<string | undefined>(undefined);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto p-0 relative">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="text-lg font-semibold">Create Post</h2>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-red-500">
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        {/* Media preview */}
        <div className="p-6 pb-3">
          {mediaType.startsWith('video') ? (
            <video src={mediaPreview} className="w-full rounded-xl mb-4" controls autoPlay loop />
          ) : (
            <img src={mediaPreview} className="w-full rounded-xl mb-4" alt="Preview" />
          )}
          <textarea
            className="w-full rounded-xl border border-gray-200 p-3 text-base min-h-[80px] focus:outline-none resize-none mb-2"
            placeholder="Add a caption..."
            value={content}
            onChange={e => setContent(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-xl"
              onClick={() => setShowEmojiPicker(v => !v)}
              aria-label="Add emoji"
            >
              😊
            </button>
            {selectedEmoji && <span className="text-xl">{selectedEmoji}</span>}
            <button
              className="ml-auto px-5 py-2 rounded-full bg-primary text-white font-semibold text-base shadow hover:bg-primary-dark transition-all"
              disabled={!content.trim()}
              onClick={() => onPost(content, selectedEmoji)}
            >
              Post
            </button>
          </div>
          {showEmojiPicker && (
            <div className="absolute z-50 mt-2">
              <EmojiPicker
                onEmojiClick={(emoji: any) => {
                  setSelectedEmoji(emoji.emoji);
                  setShowEmojiPicker(false);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
