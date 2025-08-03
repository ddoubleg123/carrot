// ⚠️ CommitmentComposer layout is pixel-perfect and QA-locked. Do not change structure or spacing without design/QA signoff. See Figma spec and screenshot.
'use client';

import { useState, useRef, useMemo } from 'react';
import CreatePostModal from './CreatePostModal';
import { useMediaUpload } from './useMediaUpload';
import { uploadFilesToFirebase } from '@/lib/uploadToFirebase';
import dynamic from 'next/dynamic';
// Dynamically import emoji picker for SSR safety
// If you see a type error, install emoji-picker-react: npm install emoji-picker-react
// and add: declare module 'emoji-picker-react'; to a global.d.ts file if needed.
const EmojiPicker = dynamic<any>(() => import('emoji-picker-react'), { ssr: false });
import { useSession } from 'next-auth/react';
import { PaperClipIcon, FaceSmileIcon, PhotoIcon, GifIcon, MicrophoneIcon } from '@heroicons/react/24/outline';
import { PhotoIcon as PhotoIconSolid, FaceSmileIcon as FaceSmileIconSolid, GifIcon as GifIconSolid, MicrophoneIcon as MicrophoneIconSolid } from '@heroicons/react/24/solid';
import { UserCircleIcon } from '@heroicons/react/24/solid';
import { Tooltip } from '../ui/tooltip';
import ColorWheelIcon from './ColorWheelIcon';
import LightningBoltIcon from './LightningBoltIcon';

interface CommitmentComposerProps {
  onSubmit: (post: any) => void;
  isSubmitting?: boolean;
  onPostOptimistic?: (post: any) => void;
}

// Text formatting types
type TextFormat = 'bold' | 'italic' | 'strikethrough';

function CommitmentComposer({ onSubmit }: CommitmentComposerProps) {
  const { data: session, status, update } = useSession();
  console.log('[CommitmentComposer] session:', session);
  console.log('[CommitmentComposer] session.user:', session?.user);
  console.log('[CommitmentComposer] session.user.profilePhoto:', session?.user?.profilePhoto);
  console.log('[CommitmentComposer] session.user.image:', session?.user?.image);
  console.log('[CommitmentComposer] session.user.username:', session?.user?.username);
  console.log('[CommitmentComposer] session status:', status);

  // Log after session update
  const logSessionUpdate = async () => {
    const updated = await update();
    console.log('[CommitmentComposer] session updated:', updated);
  };

  const user = session?.user;
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);

  // Emoji state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState<string | undefined>(undefined);
  // GIF state
  const [gifFile, setGifFile] = useState<File | null>(null);
  const [gifPreview, setGifPreview] = useState<string | null>(null);
  const [gifUrl, setGifUrl] = useState<string | undefined>(undefined);
  // Audio state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  // Refs for GIF/audio file inputs
  const gifInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const [activeFormats, setActiveFormats] = useState<Set<TextFormat>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { previewURL, handleSelect, removePreview, uploading, uploadProgress } = useMediaUpload();

  // Interactive gradient backgrounds
  const gradients = [
    'bg-gradient-to-br from-pink-200 via-yellow-100 to-orange-200',
    'bg-gradient-to-br from-green-200 via-blue-100 to-cyan-200',
    'bg-gradient-to-br from-purple-200 via-pink-100 to-indigo-200',
    'bg-gradient-to-br from-orange-200 via-yellow-100 to-red-200',
    'bg-gradient-to-br from-blue-200 via-cyan-100 to-teal-200',
    'bg-gradient-to-br from-fuchsia-200 via-rose-100 to-yellow-100',
  ];
  const [composerGradient, setComposerGradient] = useState(() => gradients[Math.floor(Math.random() * gradients.length)]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- MODAL STATE ---
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMediaPreview, setModalMediaPreview] = useState<string | null>(null);
  const [modalMediaType, setModalMediaType] = useState<string | null>(null);
  const [modalFile, setModalFile] = useState<File | null>(null);

  // --- HANDLERS TO FIX LINTS ---
  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('[handleMediaUpload] called');
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setModalMediaPreview(preview);
    setModalMediaType(file.type);
    setModalFile(file);
    setModalOpen(true);
    // DO NOT update mediaFiles or mediaPreviews here!
    setTimeout(() => {
      console.log('[handleMediaUpload][debug] modalOpen:', modalOpen);
      console.log('[handleMediaUpload][debug] modalMediaPreview:', preview);
      console.log('[handleMediaUpload][debug] modalMediaType:', file.type);
    }, 0);
    console.log('[handleMediaUpload] set modalOpen to true, preview:', preview, 'type:', file.type);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const removeMedia = (index: number) => {
    // TODO: implement remove media logic
  };
  const handleGifUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // TODO: implement gif upload logic
  };
  const removeGif = () => {
    // TODO: implement remove gif logic
  };
  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // TODO: implement audio upload logic
  };
  const removeAudio = () => {
    // TODO: implement remove audio logic
  };
  const handleEmojiClick = (emoji: any) => {
    // TODO: implement emoji click logic
  };

  // --- END HANDLERS ---

  const handleColorWheelClick = () => {
    // Pick a new random gradient different from current
    let next;
    do {
      next = gradients[Math.floor(Math.random() * gradients.length)];
    } while (next === composerGradient && gradients.length > 1);
    setComposerGradient(next);
  };

  // --- POST SUBMIT STATE ---
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- SUBMIT HANDLER ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setIsSubmitting(true);
    setErrorMsg?.(null);
    let imageUrls: string[] = [];
    let gifUrlToSend: string | undefined = undefined;
    let audioUrlToSend: string | undefined = undefined;
    const basePath = `users/${user?.id || 'anon'}/posts/${Date.now()}/`;
    try {
      // Upload images
      if (mediaFiles.length > 0) {
        imageUrls = await uploadFilesToFirebase(mediaFiles, basePath + 'media/');
      }
      // Upload GIF
      if (gifFile) {
        const [url] = await uploadFilesToFirebase([gifFile], basePath + 'gif/');
        gifUrlToSend = url;
      }
      // Upload audio
      if (audioFile) {
        const [url] = await uploadFilesToFirebase([audioFile], basePath + 'audio/');
        audioUrlToSend = url;
        setAudioUrl(audioUrlToSend);
      }

      // Compose post object
      const emoji = selectedEmoji;
      const carrotText = undefined; // TODO: implement carrot text
      const stickText = undefined; // TODO: implement stick text;
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          imageUrls,
          gifUrl: gifUrlToSend,
          audioUrl: audioUrlToSend,
          emoji,
          carrotText,
          stickText,
        })
      });
      if (!res.ok) throw new Error('Failed to create post');
      setContent('');
      setMediaPreviews([]);
      setMediaFiles([]);
      setGifFile(null);
      setGifPreview(null);
      setGifUrl(undefined);
      setAudioFile(null);
      setAudioPreview(null);
      setAudioUrl(undefined);
      setSelectedEmoji(undefined);
      setSuccessMsg?.('Post submitted – View Post');
      setTimeout(() => setSuccessMsg?.(null), 2500);
      if (onSubmit) onSubmit({ content, imageUrls, gifUrl: gifUrlToSend, audioUrl: audioUrlToSend, emoji });
    } catch (err) {
      setErrorMsg?.('Failed to submit post. Please try again.');
      setTimeout(() => setErrorMsg?.(null), 3500);
      console.error('Failed to submit post:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- END SUBMIT HANDLER ---

  return (
    <>
      {modalOpen && modalMediaPreview && modalMediaType && (
        <CreatePostModal
          open={modalOpen}
          mediaPreview={modalMediaPreview}
          mediaType={modalMediaType}
          onClose={() => {
            setModalOpen(false);
            setModalMediaPreview(null);
            setModalMediaType(null);
            setModalFile(null);
          }}
          onPost={(caption, emoji) => {
            if (modalFile && modalMediaPreview) {
              setMediaFiles([modalFile]);
              setMediaPreviews([modalMediaPreview]);
            }
            setModalOpen(false);
          }}
        />
      )}
      <form onSubmit={handleSubmit} className="w-full">
        <div className={`relative rounded-2xl ${composerGradient} px-5 mx-2 md:mx-4 mt-[36px] pt-8 pb-2 max-w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl mx-auto`}>
          {/* QA green line for alignment check */}
          <div className="absolute left-0 top-0 w-full h-[2px] bg-green-500 opacity-60 rounded-t-2xl pointer-events-none" />
          {/* Avatar */}
          <div className="absolute -top-7 left-8">
            {user?.profilePhoto || user?.image ? (
              <img
                src={user?.profilePhoto || user?.image || ''}
                alt="Profile"
                className="w-14 h-14 md:w-12 md:h-12 lg:w-16 lg:h-16 rounded-full border-4 border-white shadow-md object-cover"
              />
            ) : (
              <UserCircleIcon className="w-14 h-14 md:w-12 md:h-12 lg:w-16 lg:h-16 text-gray-300 bg-white rounded-full border-4 border-white shadow-md" />
            )}
          </div>
          {/* Color wheel right */}
          <div className="absolute -top-7 right-8">
            <button type="button" onClick={handleColorWheelClick} className="w-14 h-14 md:w-12 md:h-12 lg:w-16 lg:h-16 flex items-center justify-center rounded-full bg-white shadow-md">
              <ColorWheelIcon className="w-8 h-8" />
            </button>
          </div>
          {/* Main flex row */}
          <div className="flex flex-row gap-4 pt-2">
            {/* Left: vertical tools */}
            <div className="flex flex-col items-center gap-3 pt-2">
              {/* B/I/S formatting tools stacked vertically */}
              <button type="button" className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow hover:bg-gray-100 font-bold text-lg">B</button>
              <button type="button" className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow hover:bg-gray-100 italic text-lg">I</button>
              <button type="button" className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow hover:bg-gray-100 line-through text-lg">S</button>
            </div>
            {/* Center: input box */}
            <div className="flex-1">
              <textarea
                className="w-full bg-transparent text-lg placeholder-gray-500 focus:outline-none resize-none min-h-[60px] max-h-[200px]"
                placeholder="What's happening?"
                value={content || ''}
                onChange={e => setContent(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                rows={3}
                maxLength={280}
              />
              {/* Emoji picker */}
              {showEmojiPicker && (
                <div className="absolute z-10 mt-2">
                  <EmojiPicker onEmojiClick={(emojiObject: { emoji: string }, _?: unknown) => { setSelectedEmoji(emojiObject.emoji); setShowEmojiPicker(false); }} />
                </div>
              )}
            </div>
            {/* Right: action row */}
            <div className="flex flex-col items-end justify-between gap-3">
              <div className="flex flex-row gap-2">
                <button type="button" className="w-10 h-10 flex items-center justify-center rounded-full bg-[#ffe3f7] hover:bg-[#ffd1f1] transition">
                  <GifIcon className="w-6 h-6 text-[#b86bff]" />
                </button>
                <button type="button" className="w-10 h-10 flex items-center justify-center rounded-full bg-[#e3ffe8] hover:bg-[#d1ffd8] transition">
                  <MicrophoneIcon className="w-6 h-6 text-[#2fd97c]" />
                </button>
                <button type="button" className="w-10 h-10 flex items-center justify-center rounded-full bg-[#fffbe3] hover:bg-[#fff4c7] transition">
                  <LightningBoltIcon className="w-6 h-6" />
                </button>
                <button type="button" className="w-10 h-10 flex items-center justify-center rounded-full bg-[#ffe6c7] hover:bg-[#ffd9a3] transition">
                  <span className="text-[22px]">🥕</span>
                </button>
              </div>
              <button
                type="submit"
                className="mt-2 px-6 py-2 bg-[#2fd97c] text-white font-bold rounded-full shadow-md hover:bg-[#27c46f] mr-[49px]"
                disabled={isSubmitting || !content.trim()}
              >
                {isSubmitting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}

export default CommitmentComposer;