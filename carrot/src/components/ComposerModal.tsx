'use client';

import { useState, useEffect, useRef } from 'react';
// Temporarily disable for testing gradient changes
// import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { X, Camera, Mic, Image as ImageIcon, Smile, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { uploadFilesToFirebase } from '../lib/uploadToFirebase';
import AudioRecorder from './AudioRecorder';
import AudioPlayer from './AudioPlayer';
import Toast from '../app/(app)/dashboard/components/Toast';
import GifPicker from '../app/(app)/dashboard/components/GifPicker';
// Inline trim UX; modal editor removed per request

interface ComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPost: (post: any) => void;
  onPostUpdate: (tempId: string, updatedPost: any) => void;
}

export default function ComposerModal({ isOpen, onClose, onPost, onPostUpdate }: ComposerModalProps) {
  // Temporarily disable useSession for testing gradient changes
  // const { data: session } = useSession();
  const session = null;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const colorWheelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Content state
  const [content, setContent] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  
  // Media state
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [videoThumbnails, setVideoThumbnails] = useState<string[]>([]);
  const [currentThumbnailIndex, setCurrentThumbnailIndex] = useState(0);
  // Video edit state
  // Inline trim (no modal)
  const [videoTrimStart, setVideoTrimStart] = useState(0);
  const [videoTrimEnd, setVideoTrimEnd] = useState(0);
  const [videoAspect, setVideoAspect] = useState<'16:9' | '4:5' | '1:1' | '9:16'>('16:9');
  const [editedThumb, setEditedThumb] = useState<string | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  // Single slider track and dragging state
  const trimTrackRef = useRef<HTMLDivElement | null>(null);
  const [draggingHandle, setDraggingHandle] = useState<null | 'start' | 'end'>(null);

  // Enforce playback between trimStart and trimEnd
  useEffect(() => {
    const v = previewVideoRef.current;
    if (!v) return;
    const onTimeUpdate = () => {
      if (videoTrimStart && v.currentTime < videoTrimStart - 0.05) {
        v.currentTime = videoTrimStart;
      }
      if (videoTrimEnd && v.currentTime > videoTrimEnd) {
        v.pause();
        v.currentTime = videoTrimStart || 0;
      }
    };
    v.addEventListener('timeupdate', onTimeUpdate);
    return () => v.removeEventListener('timeupdate', onTimeUpdate);
  }, [videoTrimStart, videoTrimEnd]);

  // Handle dragging across the single slider with two crop handles
  useEffect(() => {
    if (!draggingHandle) return;
    const onMove = (ev: MouseEvent | TouchEvent) => {
      const track = trimTrackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const clientX = (ev as TouchEvent).touches ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const ratio = rect.width ? x / rect.width : 0;
      const t = Math.max(0, Math.min(videoDuration, ratio * videoDuration));
      if (draggingHandle === 'start') {
        const nextStart = Math.min(t, videoTrimEnd);
        setVideoTrimStart(nextStart);
        if (previewVideoRef.current) previewVideoRef.current.currentTime = nextStart;
      } else {
        const nextEnd = Math.max(t, videoTrimStart);
        setVideoTrimEnd(nextEnd);
        if (previewVideoRef.current && previewVideoRef.current.currentTime > nextEnd) {
          previewVideoRef.current.currentTime = nextEnd;
          previewVideoRef.current.pause();
        }
      }
    };
    const onUp = () => setDraggingHandle(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [draggingHandle, videoDuration, videoTrimStart, videoTrimEnd]);
  
  // Audio state
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [audioTranscription, setAudioTranscription] = useState('');
  const [audioDurationSeconds, setAudioDurationSeconds] = useState<number | null>(null);
  const [currentPostId, setCurrentPostId] = useState<string | null>(null);
  
  // UI state
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [selectedGifUrl, setSelectedGifUrl] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorWheelScrollPosition, setColorWheelScrollPosition] = useState(0);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'image' | 'video'>('all');
  const [mediaTab, setMediaTab] = useState<'gallery' | 'upload' | 'external'>('gallery');
  const [externalUrl, setExternalUrl] = useState('');
  
  // Toast state
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [showToast, setShowToast] = useState(false);
  
  // Color scheme state
  const [currentColorScheme, setCurrentColorScheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('carrot-color-scheme');
      return saved ? parseInt(saved, 10) : 0;
    }
    return 0;
  });
  
  // Expanded color schemes with full spectrum
  const colorSchemes = [
    { name: 'Ocean Breeze', gradientFromColor: '#e0eafe', gradientToColor: '#d1f7e6', gradientViaColor: '#f6e6fa' },
    { name: 'Lavender Dreams', gradientFromColor: '#f3e8ff', gradientToColor: '#fce7f3', gradientViaColor: '#e0e7ff' },
    { name: 'Sunset Glow', gradientFromColor: '#fed7aa', gradientToColor: '#fef3c7', gradientViaColor: '#fecaca' },
    { name: 'Forest Mist', gradientFromColor: '#d1fae5', gradientToColor: '#dbeafe', gradientViaColor: '#e0f2fe' },
    { name: 'Rose Garden', gradientFromColor: '#fce7f3', gradientToColor: '#e9d5ff', gradientViaColor: '#fed7d7' },
    { name: 'Crimson Fire', gradientFromColor: '#fee2e2', gradientToColor: '#fecaca', gradientViaColor: '#fca5a5' },
    { name: 'Golden Hour', gradientFromColor: '#fef3c7', gradientToColor: '#fed7aa', gradientViaColor: '#fbbf24' },
    { name: 'Emerald Valley', gradientFromColor: '#d1fae5', gradientToColor: '#a7f3d0', gradientViaColor: '#6ee7b7' },
    { name: 'Azure Sky', gradientFromColor: '#dbeafe', gradientToColor: '#bfdbfe', gradientViaColor: '#93c5fd' },
    { name: 'Violet Storm', gradientFromColor: '#e9d5ff', gradientToColor: '#d8b4fe', gradientViaColor: '#c084fc' },
    { name: 'Coral Reef', gradientFromColor: '#fed7d7', gradientToColor: '#fbb6ce', gradientViaColor: '#f687b3' },
    { name: 'Mint Fresh', gradientFromColor: '#ecfdf5', gradientToColor: '#d1fae5', gradientViaColor: '#a7f3d0' },
    { name: 'Amber Glow', gradientFromColor: '#fffbeb', gradientToColor: '#fef3c7', gradientViaColor: '#fde68a' },
    { name: 'Slate Storm', gradientFromColor: '#f8fafc', gradientToColor: '#e2e8f0', gradientViaColor: '#cbd5e1' },
    { name: 'Teal Wave', gradientFromColor: '#f0fdfa', gradientToColor: '#ccfbf1', gradientViaColor: '#99f6e4' },
    { name: 'Indigo Night', gradientFromColor: '#eef2ff', gradientToColor: '#e0e7ff', gradientViaColor: '#c7d2fe' },
    { name: 'Pink Blossom', gradientFromColor: '#fdf2f8', gradientToColor: '#fce7f3', gradientViaColor: '#fbcfe8' },
    { name: 'Lime Burst', gradientFromColor: '#f7fee7', gradientToColor: '#ecfccb', gradientViaColor: '#d9f99d' },
    { name: 'Orange Sunset', gradientFromColor: '#fff7ed', gradientToColor: '#fed7aa', gradientViaColor: '#fdba74' },
    { name: 'Purple Haze', gradientFromColor: '#faf5ff', gradientToColor: '#f3e8ff', gradientViaColor: '#e9d5ff' },
  ];
  
  // Emoji categories
  const emojiCategories = {
    'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳'],
    'Nature': ['🌱', '🌿', '☘️', '🍀', '🎋', '🍃', '🍂', '🍁', '🌾', '🌲', '🌳', '🌴', '🌵', '🌶️', '🍄', '🌰', '🎃', '🐚', '🌸', '🌺', '🌻', '🌹', '🥀', '🌷', '🌼', '🌙', '🌛', '🌜', '🌚', '🌕', '🌖'],
    'Food': ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠'],
    'Symbols': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎']
  };

  // Close modal on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      // Always randomize color scheme on open
      selectRandomColorScheme();
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setContent('');
      setMediaPreview(null);
      setMediaFile(null);
      setMediaType(null);
      setAudioBlob(null);
      setAudioUrl('');
      setAudioTranscription('');
      setAudioDurationSeconds(null);
      setSelectedGifUrl(null);
      setShowGifPicker(false);
      setShowEmojiPicker(false);
      setShowAudioRecorder(false);
      setVideoThumbnails([]);
      setCurrentThumbnailIndex(0);
      setVideoTrimStart(0);
      setVideoTrimEnd(0);
      setVideoAspect('16:9');
      setEditedThumb(null);
      setVideoDuration(0);
      previewVideoRef.current = null;
    }
  }, [isOpen]);

  // Toast helpers
  const showSuccessToast = (message: string) => {
    setToastMessage(message);
    setToastType('success');
    setShowToast(true);
  };

  const showErrorToast = (message: string) => {
    setToastMessage(message);
    setToastType('error');
    setShowToast(true);
  };

  // Random color scheme selector (client-side only to prevent hydration mismatch)
  const selectRandomColorScheme = () => {
    const availableIndices = Array.from({ length: colorSchemes.length }, (_, i) => i)
      .filter(i => i !== currentColorScheme);
    
    // Use deterministic selection based on timestamp to avoid hydration mismatch
    const seed = Date.now();
    const randomIndex = availableIndices[seed % availableIndices.length];
    setCurrentColorScheme(randomIndex);
    
    if (typeof window !== 'undefined') {
      localStorage.setItem('carrot-color-scheme', randomIndex.toString());
    }
  };

  // Utility: convert data URL to Blob without network
  const dataUrlToBlob = (dataUrl: string): Blob => {
    const [header, data] = dataUrl.split(',');
    const isBase64 = /;base64$/i.test(header) || /;base64;/i.test(header);
    const mimeMatch = header.match(/^data:(.*?)(;|$)/i);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    if (isBase64) {
      const binary = atob(data);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    } else {
      const decoded = decodeURIComponent(data);
      return new Blob([decoded], { type: mime });
    }
  };

  // Media upload handlers
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      setMediaFile(file);
      setMediaType('image');
      const reader = new FileReader();
      reader.onload = (e) => setMediaPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      setMediaFile(file);
      setMediaType('video');
      const reader = new FileReader();
      reader.onload = (e) => {
        setMediaPreview(e.target?.result as string);
        generateVideoThumbnails(e.target?.result as string);
        // Initialize trim values; end will be set on metadata load
        setVideoTrimStart(0);
        setVideoTrimEnd(0);
        setEditedThumb(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateVideoThumbnails = (videoUrl: string) => {
    const video = document.createElement('video');
    video.src = videoUrl;
    video.crossOrigin = 'anonymous';
    
    video.addEventListener('loadedmetadata', () => {
      const duration = video.duration;
      const thumbnails: string[] = [];
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return;
      
      canvas.width = 320;
      canvas.height = 180;
      
      const generateThumbnail = (time: number) => {
        return new Promise<string>((resolve) => {
          video.currentTime = time;
          video.addEventListener('seeked', () => {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL());
          }, { once: true });
        });
      };
      
      Promise.all([
        generateThumbnail(duration * 0.1),
        generateThumbnail(duration * 0.3),
        generateThumbnail(duration * 0.5),
        generateThumbnail(duration * 0.7),
        generateThumbnail(duration * 0.9)
      ]).then(thumbnails => {
        setVideoThumbnails(thumbnails);
      });
    });
  };

  // Audio handlers
  const handleAudioRecorded = async (blob: Blob, url: string, durationSeconds: number) => {
    setAudioBlob(blob);
    setAudioUrl(url);
    setAudioDurationSeconds(durationSeconds || null);
    setShowAudioRecorder(false);
    
    // Auto-transcribe
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('language', 'auto');

      const response = await fetch('/api/audio/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        setAudioTranscription(result.transcription);
        showSuccessToast('Audio transcribed successfully!');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      showErrorToast('Failed to transcribe audio');
    }
  };

  // Emoji handlers
  const handleEmojiSelect = (emoji: string) => {
    if (textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const newContent = content.slice(0, start) + emoji + content.slice(end);
      setContent(newContent);
      
      // Reset cursor position
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + emoji.length;
          textareaRef.current.selectionEnd = start + emoji.length;
          textareaRef.current.focus();
        }
      }, 0);
    }
    setShowEmojiPicker(false);
  };

  // Color scheme handlers
  const selectColorScheme = (index: number) => {
    setCurrentColorScheme(index);
    setShowColorPicker(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('carrot-color-scheme', index.toString());
    }
  };

  // Color wheel sliding functions
  const slideColorWheel = (direction: 'left' | 'right') => {
    if (colorWheelRef.current) {
      const scrollAmount = 200; // pixels to scroll
      const currentScroll = colorWheelRef.current.scrollLeft;
      const newScroll = direction === 'left' 
        ? Math.max(0, currentScroll - scrollAmount)
        : currentScroll + scrollAmount;
      
      colorWheelRef.current.scrollTo({
        left: newScroll,
        behavior: 'smooth'
      });
      setColorWheelScrollPosition(newScroll);
    }
  };

  const canScrollLeft = colorWheelScrollPosition > 0;
  const canScrollRight = colorWheelRef.current 
    ? colorWheelScrollPosition < (colorWheelRef.current.scrollWidth - colorWheelRef.current.clientWidth)
    : true;

  // GIF handlers
  const handleGifSelect = (gifUrl: string) => {
    setSelectedGifUrl(gifUrl);
    setShowGifPicker(false);
    // Clear other media
    setMediaPreview(null);
    setMediaFile(null);
    setAudioBlob(null);
    setAudioUrl('');
  };

  // Network helper: fetch with timeout using AbortController
  const fetchWithTimeout = async (input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 15000) => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(t);
    }
  };

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!content.trim() && !mediaFile && !audioBlob && !selectedGifUrl && !externalUrl.trim()) || isPosting) return;

    setIsPosting(true);

    try {
      let uploadedMediaUrl = '';
      let thumbnailUrl = '';
      
      // Upload media if present
      if (mediaFile) {
        setIsUploading(true);
        const uploadResult = await uploadFilesToFirebase([mediaFile], 'posts');
        setUploadProgress(100);
        
        if (uploadResult.length > 0) {
          uploadedMediaUrl = uploadResult[0];
          
          // For videos, upload edited thumbnail if available, otherwise selected generated thumbnail
          if (mediaType === 'video' && (editedThumb || videoThumbnails[currentThumbnailIndex])) {
            try {
              const dataUrl = (editedThumb || videoThumbnails[currentThumbnailIndex]) as string;
              let blob: Blob;
              if (dataUrl.startsWith('data:')) {
                blob = dataUrlToBlob(dataUrl);
              } else {
                // Remote URL case
                blob = await fetchWithTimeout(dataUrl, {}, 10000).then(r => r.blob());
              }
              const thumbnailFile = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
              const thumbnailResult = await uploadFilesToFirebase([thumbnailFile], 'thumbnails');
              if (thumbnailResult.length > 0) {
                thumbnailUrl = thumbnailResult[0];
              }
            } catch (thumbErr) {
              console.warn('Thumbnail upload skipped due to conversion/upload error:', thumbErr);
            }
          }
        }
        setIsUploading(false);
      }

      // Upload audio if present
      let uploadedAudioUrl = '';
      if (audioBlob) {
        try {
          setIsUploading(true);
          const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
          const audioResult = await uploadFilesToFirebase([audioFile], 'audio');
          if (audioResult.length > 0) {
            uploadedAudioUrl = audioResult[0];
            showSuccessToast('Audio uploaded');
          }
        } catch (audioErr) {
          console.error('Audio upload failed:', audioErr);
          showErrorToast('Audio upload failed');
        } finally {
          setIsUploading(false);
        }
      }

      // Build post payload
      const scheme = colorSchemes[currentColorScheme];
      const postData = {
        content: content.trim(),
        mediaUrl: uploadedMediaUrl || null,
        gifUrl: selectedGifUrl || null,
        thumbnailUrl: thumbnailUrl || null,
        audioUrl: uploadedAudioUrl || null,
        audioTranscription: audioTranscription || null,
        audioDurationSeconds: audioDurationSeconds || null,
        externalUrl: externalUrl.trim() || null,
        // Video edit metadata (server can optionally process)
        videoTrimStart: mediaType === 'video' ? videoTrimStart : null,
        videoTrimEnd: mediaType === 'video' ? videoTrimEnd : null,
        videoAspect: mediaType === 'video' ? videoAspect : null,
        // Gradient/theme fields
        gradientFromColor: scheme?.gradientFromColor || null,
        gradientToColor: scheme?.gradientToColor || null,
        gradientViaColor: scheme?.gradientViaColor || null,
      } as any;
      if (process.env.NODE_ENV !== 'production') {
        console.debug('ComposerModal POST /api/posts payload:', postData);
      }

      // Quick connectivity probe to surface mixed-content/origin issues early
      try {
        await fetchWithTimeout('/api/posts', { method: 'GET', credentials: 'include' }, 5000);
      } catch (probeErr) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Connectivity probe to /api/posts failed, retrying with absolute URL', probeErr);
        }
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        if (origin) {
          try {
            await fetchWithTimeout(`${origin}/api/posts`, { method: 'GET', credentials: 'include' }, 5000);
          } catch (absErr) {
            throw new Error(`API unreachable at ${origin}/api/posts. Check network, origin/protocol, or blockers.`);
          }
        }
      }

      let response: Response | null = null;
      const payload = JSON.stringify(postData);
      try {
        response = await fetchWithTimeout('/api/posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: payload,
        }, 15000);
      } catch (err) {
        // Network error on relative path; try absolute same-origin URL
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Relative /api/posts fetch failed, retrying with absolute URL. Error:', err);
        }
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        if (origin) {
          response = await fetchWithTimeout(`${origin}/api/posts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: payload,
          }, 15000);
        } else {
          throw err; // No window origin available
        }
      }
      if (process.env.NODE_ENV !== 'production' && response) {
        console.debug('ComposerModal POST /api/posts status:', response.status);
      }

      if (response.ok) {
        const newPost = await response.json();
        if (process.env.NODE_ENV !== 'production') {
          console.debug('ComposerModal created post:', newPost?.id);
        }
        showSuccessToast('Post created successfully!');
        
        // Call onPost with the new post data to update the feed
        onPost(newPost);
        
        // Reset form
        setContent('');
        setMediaPreview(null);
        setMediaFile(null);
        setMediaType(null);
        setAudioBlob(null);
        setAudioUrl('');
        setAudioTranscription('');
        setAudioDurationSeconds(null);
        setSelectedGifUrl(null);
        setVideoThumbnails([]);
        setCurrentThumbnailIndex(0);
        setExternalUrl('');
        
        onClose();
      } else {
        // Attempt to read error details for visibility
        let errText = '';
        try { errText = await response.text(); } catch {}
        throw new Error(`Failed to create post (status ${response.status}) ${errText ? '- ' + errText : ''}`);
      }
    } catch (error) {
      console.error('Error creating post:', error);
      const msg = error instanceof Error ? error.message : 'Unknown error';
      showErrorToast(`Failed to create post: ${msg}`);
    } finally {
      setIsPosting(false);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  if (!isOpen) return null;

  const currentScheme = colorSchemes[currentColorScheme];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div 
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${currentScheme.gradientFromColor} 0%, ${currentScheme.gradientViaColor} 50%, ${currentScheme.gradientToColor} 100%)`
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/20">
            <h2 className="text-xl font-semibold text-gray-900">Create post</h2>
            <div className="flex items-center gap-2 relative">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="p-2 hover:bg-white/20 rounded-full transition-colors duration-200"
                title="Choose color scheme"
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-r from-orange-400 to-red-500 border border-gray-300"></div>
              </button>
              <button
                onClick={selectRandomColorScheme}
                className="p-2 hover:bg-white/20 rounded-full transition-colors duration-200"
                title="Random color scheme"
              >
                <Zap className="w-5 h-5 text-gray-700" />
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/20 rounded-full transition-colors duration-200"
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>
            </div>
          </div>

          {/* Color Picker Dropdown with Sliding Mechanism */}
          {showColorPicker && (
            <div className="absolute top-16 right-6 z-10 bg-white rounded-xl shadow-lg border border-gray-200 p-4 w-80">
              <div className="text-sm font-medium text-gray-700 mb-3">Choose Color Scheme</div>
              
              {/* Horizontal Sliding Color Wheel */}
              <div className="relative">
                {/* Left Arrow */}
                <button
                  onClick={() => slideColorWheel('left')}
                  className={`absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center transition-opacity duration-200 ${
                    canScrollLeft ? 'opacity-100 hover:bg-gray-50' : 'opacity-30 cursor-not-allowed'
                  }`}
                  disabled={!canScrollLeft}
                >
                  <ChevronLeft className="w-4 h-4 text-gray-600" />
                </button>

                {/* Right Arrow */}
                <button
                  onClick={() => slideColorWheel('right')}
                  className={`absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white rounded-full shadow-md border border-gray-200 flex items-center justify-center transition-opacity duration-200 ${
                    canScrollRight ? 'opacity-100 hover:bg-gray-50' : 'opacity-30 cursor-not-allowed'
                  }`}
                  disabled={!canScrollRight}
                >
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </button>

                {/* Scrollable Color Container */}
                <div 
                  ref={colorWheelRef}
                  className="flex overflow-x-auto scrollbar-hide gap-3 pb-2 px-10" 
                  style={{ scrollBehavior: 'smooth' }}
                  onScroll={(e) => setColorWheelScrollPosition(e.currentTarget.scrollLeft)}
                >
                  {colorSchemes.map((scheme, index) => (
                    <button
                      key={index}
                      onClick={() => selectColorScheme(index)}
                      className={`relative flex-shrink-0 w-16 h-16 rounded-full border-3 transition-all duration-300 hover:scale-110 hover:shadow-lg ${
                        currentColorScheme === index ? 'border-orange-400 ring-2 ring-orange-200 scale-110' : 'border-gray-200 hover:border-gray-300'
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${scheme.gradientFromColor} 0%, ${scheme.gradientViaColor} 50%, ${scheme.gradientToColor} 100%)`
                      }}
                      title={scheme.name}
                    >
                      {currentColorScheme === index && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-4 h-4 bg-white rounded-full shadow-md border border-gray-200"></div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                
                {/* Slide indicators */}
                <div className="flex justify-center mt-2 gap-1">
                  {Array.from({ length: Math.ceil(colorSchemes.length / 4) }).map((_, pageIndex) => (
                    <div
                      key={pageIndex}
                      className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                        Math.floor(currentColorScheme / 4) === pageIndex ? 'bg-orange-400' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
              
              {/* Current scheme info */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500">Current: {colorSchemes[currentColorScheme]?.name}</div>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              {/* User Info */}
              <div className="flex items-center gap-3 mb-4">
                {/* Temporarily use fallback avatar for testing */}
                <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-medium">
                    U
                  </span>
                </div>
                <div>
                  <div className="font-medium text-gray-900">
                    Anonymous {/* session?.user?.name || 'Anonymous' */}
                  </div>
                  <div className="text-sm text-gray-600">
                    Public post
                  </div>
                </div>
              </div>

              {/* Current Color Scheme label only (removed preview box) */}
              <div className="mb-2">
                <div className="text-sm text-gray-700">Current Color Scheme: {colorSchemes[currentColorScheme]?.name}</div>
              </div>

              {/* Text Area */}
              <div className="mb-4">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="What's happening?"
                  className="w-full h-32 p-4 text-lg bg-white/50 border border-white/30 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-gray-600"
                  autoFocus
                />
              </div>

              {/* Media Preview */}
              {mediaPreview && (
                <div className="mb-4 relative">
                  {mediaType === 'image' && (
                    <img src={mediaPreview} alt="Preview" className="w-full max-h-64 object-cover rounded-xl" />
                  )}
                  {mediaType === 'video' && (
                    <div>
                      <video
                        ref={(el) => { previewVideoRef.current = el; }}
                        src={mediaPreview}
                        className="w-full max-h-64 object-cover rounded-xl"
                        controls
                        onLoadedMetadata={(e) => {
                          const d = (e.currentTarget as HTMLVideoElement).duration || 0;
                          setVideoDuration(d);
                          setVideoTrimStart(0);
                          setVideoTrimEnd(d);
                        }}
                      />
                      {/* Helper text */}
                      <div className="mt-2 text-xs text-gray-700">
                        Drag the crop handles below to trim the video start and end.
                      </div>
                      {/* Inline trim controls */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs text-gray-700 mb-1">
                          <span>Start: {videoTrimStart.toFixed(2)}s</span>
                          <span>End: {videoTrimEnd.toFixed(2)}s</span>
                          <span>Duration: {videoDuration.toFixed(2)}s</span>
                        </div>
                        {/* Single visual track with truncation shading and draggable handles */}
                        <div ref={trimTrackRef} className="relative w-full h-3 mb-4 rounded bg-gray-200 overflow-hidden select-none touch-none">
                          {/* Shaded left (cropped) */}
                          <div
                            className="absolute top-0 left-0 h-full bg-gray-400/60"
                            style={{ width: `${videoDuration ? (Math.min(videoTrimStart, videoTrimEnd) / videoDuration) * 100 : 0}%` }}
                          />
                          {/* Shaded right (cropped) */}
                          <div
                            className="absolute top-0 right-0 h-full bg-gray-400/60"
                            style={{ width: `${videoDuration ? ((videoDuration - Math.max(videoTrimStart, videoTrimEnd)) / videoDuration) * 100 : 0}%` }}
                          />
                          {/* Selected region highlight */}
                          <div
                            className="absolute top-0 h-full bg-orange-400/50"
                            style={{
                              left: `${videoDuration ? (Math.min(videoTrimStart, videoTrimEnd) / videoDuration) * 100 : 0}%`,
                              width: `${videoDuration ? ((Math.max(videoTrimEnd, videoTrimStart) - Math.min(videoTrimStart, videoTrimEnd)) / videoDuration) * 100 : 0}%`
                            }}
                          />
                          {/* Crop handles */}
                          {/* Start handle (full-hit area) */}
                          <button
                            type="button"
                            aria-label="Trim start"
                            onMouseDown={() => setDraggingHandle('start')}
                            onTouchStart={() => setDraggingHandle('start')}
                            className="absolute -top-4 w-10 h-10 z-10 bg-transparent cursor-ew-resize transform -translate-x-1/2 touch-none"
                            style={{ left: `${videoDuration ? (Math.min(videoTrimStart, videoTrimEnd) / videoDuration) * 100 : 0}%` }}
                          >
                            <span className="pointer-events-none absolute inset-0 m-auto w-4 h-6 bg-white border-2 border-orange-500 rounded-md shadow-lg ring-2 ring-orange-300 ring-offset-2 ring-offset-white" />
                          </button>
                          {/* End handle (full-hit area) */}
                          <button
                            type="button"
                            aria-label="Trim end"
                            onMouseDown={() => setDraggingHandle('end')}
                            onTouchStart={() => setDraggingHandle('end')}
                            className="absolute -top-4 w-10 h-10 z-10 bg-transparent cursor-ew-resize transform -translate-x-1/2 touch-none"
                            style={{ left: `${videoDuration ? (Math.max(videoTrimEnd, videoTrimStart) / videoDuration) * 100 : 0}%` }}
                          >
                            <span className="pointer-events-none absolute inset-0 m-auto w-4 h-6 bg-white border-2 border-red-500 rounded-md shadow-lg ring-2 ring-red-300 ring-offset-2 ring-offset-white" />
                          </button>
                          {/* Truncation symbols above handles */}
                          <div className="absolute -top-5 text-orange-600 text-lg select-none" style={{ left: `calc(${videoDuration ? (Math.min(videoTrimStart, videoTrimEnd) / videoDuration) * 100 : 0}% - 6px)` }}>⟪</div>
                          <div className="absolute -top-5 text-red-600 text-lg select-none" style={{ left: `calc(${videoDuration ? (Math.max(videoTrimEnd, videoTrimStart) / videoDuration) * 100 : 0}% - 6px)` }}>⟫</div>
                        </div>
                        <div className="mt-1 text-xs text-gray-600">Selected clip: {(Math.max(0, videoTrimEnd - videoTrimStart)).toFixed(2)}s</div>
                      </div>
                      {videoThumbnails.length > 0 && (
                        <div className="mt-2">
                          <div className="text-sm text-gray-700 mb-2">Choose thumbnail:</div>
                          <div className="flex gap-2 overflow-x-auto">
                            {videoThumbnails.map((thumb, index) => (
                              <img
                                key={index}
                                src={thumb}
                                alt={`Thumbnail ${index + 1}`}
                                className={`w-20 h-12 object-cover rounded cursor-pointer border-2 ${
                                  currentThumbnailIndex === index ? 'border-orange-500' : 'border-transparent'
                                }`}
                                onClick={() => setCurrentThumbnailIndex(index)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMediaPreview(null);
                      setMediaFile(null);
                      setMediaType(null);
                      setVideoThumbnails([]);
                      setEditedThumb(null);
                      setVideoTrimStart(0);
                      setVideoTrimEnd(0);
                      setVideoAspect('16:9');
                      setVideoDuration(0);
                    }}
                    className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* GIF Preview */}
              {selectedGifUrl && (
                <div className="mb-4 relative">
                  <img src={selectedGifUrl} alt="Selected GIF" className="w-full max-h-64 object-cover rounded-xl" />
                  <button
                    type="button"
                    onClick={() => setSelectedGifUrl(null)}
                    className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Audio Preview */}
              {audioUrl && (
                <div className="mb-4">
                  <AudioPlayer
                    audioUrl={audioUrl}
                    postId={currentPostId || 'temp'}
                    initialDurationSeconds={audioDurationSeconds ?? undefined}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setAudioBlob(null);
                      setAudioUrl('');
                      setAudioTranscription('');
                      setAudioDurationSeconds(null);
                    }}
                    className="mt-2 text-sm text-red-600 hover:text-red-800"
                  >
                    Remove audio
                  </button>
                </div>
              )}

              {/* Upload Progress */}
              {isUploading && (
                <div className="mb-4">
                  <div className="text-sm text-gray-700 mb-1" role="status" aria-live="polite">Uploading and transcribing... {Math.round(uploadProgress)}%</div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Hidden file input for 'Upload from your computer' */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={(e) => {
                  setShowMediaPicker(false);
                  handleImageUpload(e);
                }}
                className="hidden"
              />

              {/* Media Upload Buttons */}
              <div className="flex items-center gap-4 mb-6">
                <button
                  type="button"
                  onClick={() => setShowMediaPicker(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/30 hover:bg-white/50 rounded-full transition-colors duration-200"
                >
                  <Camera className="w-5 h-5 text-gray-700" />
                  <span className="text-sm font-medium text-gray-700">Photo/Video</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAudioRecorder(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-white/30 hover:bg-white/50 rounded-full transition-colors duration-200"
                >
                  <Mic className="w-5 h-5 text-gray-700" />
                  <span className="text-sm font-medium text-gray-700">Audio</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowGifPicker(!showGifPicker);
                    setShowEmojiPicker(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-white/30 hover:bg-white/50 rounded-full transition-colors duration-200"
                >
                  <span className="text-sm font-medium text-gray-700">GIF</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowEmojiPicker(!showEmojiPicker);
                    setShowGifPicker(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-white/30 hover:bg-white/50 rounded-full transition-colors duration-200"
                >
                  <Smile className="w-5 h-5 text-gray-700" />
                  <span className="text-sm font-medium text-gray-700">Emoji</span>
                </button>
              </div>

              {/* Emoji Picker */}
              {showEmojiPicker && (
                <div className="mb-4 p-4 bg-white/50 rounded-xl max-h-48 overflow-y-auto">
                  {Object.entries(emojiCategories).map(([category, emojis]) => (
                    <div key={category} className="mb-3">
                      <div className="text-sm font-medium text-gray-700 mb-2">{category}</div>
                      <div className="flex flex-wrap gap-1">
                        {emojis.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleEmojiSelect(emoji)}
                            className="p-1 hover:bg-white/50 rounded text-xl"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* GIF Picker */}
              {showGifPicker && (
                <div className="mb-4">
                  <GifPicker 
                    isOpen={showGifPicker}
                    onClose={() => setShowGifPicker(false)}
                    onSelectGif={handleGifSelect}
                  />
                </div>
              )}

              {/* Intermediary Media Picker */}
              {showMediaPicker && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 p-4">
                  <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl border border-gray-200 p-0 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                      <div className="text-base font-semibold text-gray-900">Add media</div>
                      <button
                        type="button"
                        onClick={() => setShowMediaPicker(false)}
                        className="p-2 rounded-full hover:bg-gray-100"
                        aria-label="Close"
                      >
                        <X className="w-5 h-5 text-gray-600" />
                      </button>
                    </div>

                    {/* Tabs: Gallery | Upload | External URL */}
                    <div className="grid grid-cols-3">
                      {([
                        { key: 'gallery', label: 'Gallery' },
                        { key: 'upload', label: 'Upload' },
                        { key: 'external', label: 'External URL' },
                      ] as const).map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => setMediaTab(t.key as typeof mediaTab)}
                          className={`text-sm font-medium py-3 transition-colors border-b-2 ${
                            mediaTab === t.key ? 'border-orange-500 text-gray-900 bg-orange-50' : 'border-transparent text-gray-600 hover:bg-gray-50'
                          }`}
                          role="tab"
                          aria-selected={mediaTab === t.key}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* Body */}
                    <div className="p-5">
                      {mediaTab === 'gallery' && (
                        <>
                          {/* Filter Pills */}
                          <div className="flex gap-2 mb-4">
                            {(['all','image','video'] as const).map((key) => (
                              <button
                                key={key}
                                type="button"
                                onClick={() => setMediaFilter(key)}
                                className={`px-3 py-1.5 text-sm rounded-full border ${mediaFilter === key ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                              >
                                {key === 'all' ? 'All' : key === 'image' ? 'Images' : 'Videos'}
                              </button>
                            ))}
                          </div>

                          {/* Gallery Placeholder */}
                          <div className="min-h-[160px] flex items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50">
                            <div className="text-sm text-gray-600">No items in your gallery yet.</div>
                          </div>
                        </>
                      )}

                      {mediaTab === 'upload' && (
                        <div className="flex items-center justify-between gap-4">
                          <div className="text-sm text-gray-600">
                            Upload images or videos from your computer.
                          </div>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-4 py-2 bg-gray-900 text-white rounded-full text-sm hover:bg-black"
                          >
                            Upload from your computer
                          </button>
                        </div>
                      )}

                      {mediaTab === 'external' && (
                        <div
                          className="space-y-3"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (!externalUrl.trim()) return;
                              try {
                                setMediaPreview('');
                                setMediaFile(null);
                                setMediaType(null);
                                showSuccessToast('External URL attached. We will transcribe or fetch media after posting.');
                                setShowMediaPicker(false);
                              } catch (_) {
                                setShowMediaPicker(false);
                              }
                            }
                          }}
                        >
                          <label className="block text-sm font-medium text-gray-700">Paste a link</label>
                          <input
                            type="url"
                            inputMode="url"
                            value={externalUrl}
                            onChange={(e) => setExternalUrl(e.target.value)}
                            placeholder="Transcribe or edit from Youtube, X, TikTok, FB etc"
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          />
                          <div className="flex justify-end">
                            <button
                              type="button"
                              onClick={() => {
                                if (!externalUrl.trim()) return;
                                try {
                                  setMediaPreview('');
                                  setMediaFile(null);
                                  setMediaType(null);
                                  showSuccessToast('External URL attached. We will transcribe or fetch media after posting.');
                                  setShowMediaPicker(false);
                                } catch (_) {
                                  setShowMediaPicker(false);
                                }
                              }}
                              className="px-4 py-2 bg-orange-500 text-white rounded-full text-sm hover:bg-orange-600"
                            >
                              Attach URL
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700">
                  {content.length}/1000 characters
                </div>
                
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-2 text-gray-700 hover:bg-white/20 rounded-full transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={(!content.trim() && !mediaFile && !audioBlob && !selectedGifUrl) || isPosting || isUploading}
                    className="px-6 py-2 bg-gradient-to-r from-orange-400 to-red-500 text-white rounded-full font-medium hover:from-orange-500 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {isPosting ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Audio Recorder Modal */}
      {showAudioRecorder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl p-6 max-w-md w-full">
            <AudioRecorder
              onAudioRecorded={handleAudioRecorded}
              onCancel={() => setShowAudioRecorder(false)}
            />
          </div>
        </div>
      )}

      

      {/* Toast */}
      {showToast && (
        <Toast
          message={toastMessage}
          type={toastType}
          isVisible={showToast}
          onClose={() => setShowToast(false)}
        />
      )}
    </>
  );
}
