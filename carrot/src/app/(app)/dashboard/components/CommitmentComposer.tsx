'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { uploadFilesToFirebase } from '../../../../lib/uploadToFirebase';
import { IconPhoto, IconGif, IconEmoji, IconAudio, IconCarrot, IconLightning } from './icons';
import Toast from './Toast';
import GifPicker from './GifPicker';
import AudioRecorder from '../../../../components/AudioRecorder';
import AudioPlayer from '../../../../components/AudioPlayer';
import { uploadToCloudflareStream } from '../../../../lib/cfStreamUpload';

interface CommitmentComposerProps {
  onPost: (post: any) => void;
  onPostUpdate?: (tempId: string, updatedPost: any) => void;
}

export default function CommitmentComposer({ onPost, onPostUpdate }: CommitmentComposerProps) {
  const { data: session, status } = useSession();
  const user = session?.user;
  
  const [content, setContent] = React.useState<string>('');
  const [showModal, setShowModal] = React.useState<boolean>(false);
  const [mediaPreview, setMediaPreview] = React.useState<string | null>(null);
  const [mediaFile, setMediaFile] = React.useState<File | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [mediaType, setMediaType] = React.useState<string | null>(null);
  const [currentScrubTime, setCurrentScrubTime] = React.useState<number>(0);
  const [uploadProgress, setUploadProgress] = React.useState<number>(0);
  const [isUploading, setIsUploading] = React.useState<boolean>(false);
  const [uploadedMedia, setUploadedMedia] = React.useState<string | null>(null);
  const [videoThumbnails, setVideoThumbnails] = React.useState<string[]>([]);
  const [thumbnailsLoading, setThumbnailsLoading] = React.useState<boolean>(false);
  const [currentThumbnailIndex, setCurrentThumbnailIndex] = React.useState<number>(0);
  // Cloudflare Stream tracking
  const [cfUid, setCfUid] = React.useState<string | null>(null);
  const [cfStatus, setCfStatus] = React.useState<string | null>(null);
  // Promise that resolves when CF direct-upload returns a uid
  const [cfUploadPromise, setCfUploadPromise] = React.useState<Promise<string> | null>(null);
  
  // GIF picker state
  const [showGifPicker, setShowGifPicker] = React.useState<boolean>(false);
  const [selectedGifUrl, setSelectedGifUrl] = React.useState<string | null>(null);
  
  // Emoji picker state
  const [showEmojiPicker, setShowEmojiPicker] = React.useState<boolean>(false);
  
  // Audio recording state
  const [showAudioRecorder, setShowAudioRecorder] = React.useState<boolean>(false);
  const [audioBlob, setAudioBlob] = React.useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = React.useState<string>('');
  const [audioTranscription, setAudioTranscription] = React.useState<string>('');
  const [isRecording, setIsRecording] = React.useState(false);
  const [currentPostId, setCurrentPostId] = React.useState<string | null>(null);
  
  // Debug: Track component mount/unmount (GPT diagnostic)
  React.useEffect(() => {
    console.log('🏗️ CommitmentComposer mounted');
    return () => console.log('💀 CommitmentComposer UNmounted'); // If this fires on submit, that's the smoking gun
  }, []);

  // Debug: Track currentPostId changes
  React.useEffect(() => {
    console.log('🔄 currentPostId state changed to:', currentPostId);
  }, [currentPostId]);
  
  // Emoji categories and data
  const emojiCategories = {
    'Smileys': ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳'],
    'Emotions': ['😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭'],
    'Activities': ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌'],
    'Objects': ['⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️'],
    'Nature': ['🌱', '🌿', '☘️', '🍀', '🎋', '🍃', '🍂', '🍁', '🌾', '🌲', '🌳', '🌴', '🌵', '🌶️', '🍄', '🌰', '🎃', '🐚', '🌸', '🌺', '🌻', '🌹', '🥀', '🌷', '🌼', '🌙', '🌛', '🌜', '🌚', '🌕', '🌖'],
    'Food': ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠'],
    'Travel': ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🛹', '🛼', '🚁', '🛸', '✈️', '🛩️', '🛫', '🛬', '🪂', '💺', '🚀', '🛰️', '🚢'],
    'Symbols': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎']
  };
  
  // Color wheel state with localStorage persistence
  const [currentColorScheme, setCurrentColorScheme] = React.useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('carrot-color-scheme');
      return saved ? parseInt(saved, 10) : 0;
    }
    return 0;
  });
  
  // Color schemes for the gradient backgrounds - 20 beautiful options
  const colorSchemes = [
    {
      name: 'Ocean Breeze',
      gradientFromColor: '#e0eafe',
      gradientToColor: '#d1f7e6',
      gradientViaColor: '#f6e6fa'
    },
    {
      name: 'Lavender Dreams',
      gradientFromColor: '#f3e8ff',
      gradientToColor: '#fce7f3',
      gradientViaColor: '#e0e7ff'
    },
    {
      name: 'Sunset Glow',
      gradientFromColor: '#fed7aa',
      gradientToColor: '#fef3c7',
      gradientViaColor: '#fecaca'
    },
    {
      name: 'Forest Mist',
      gradientFromColor: '#d1fae5',
      gradientToColor: '#dbeafe',
      gradientViaColor: '#e0f2fe'
    },
    {
      name: 'Rose Garden',
      gradientFromColor: '#fce7f3',
      gradientToColor: '#e9d5ff',
      gradientViaColor: '#fed7d7'
    },
    {
      name: 'Arctic Aurora',
      gradientFromColor: '#ecfdf5',
      gradientToColor: '#f0f9ff',
      gradientViaColor: '#f3e8ff'
    },
    {
      name: 'Coral Reef',
      gradientFromColor: '#ffedd5',
      gradientToColor: '#fef2f2',
      gradientViaColor: '#fce7f3'
    },
    {
      name: 'Midnight Sky',
      gradientFromColor: '#e0e7ff',
      gradientToColor: '#ddd6fe',
      gradientViaColor: '#e0f2fe'
    },
    {
      name: 'Golden Hour',
      gradientFromColor: '#fef3c7',
      gradientToColor: '#fed7aa',
      gradientViaColor: '#fde68a'
    },
    {
      name: 'Cherry Blossom',
      gradientFromColor: '#fdf2f8',
      gradientToColor: '#f3e8ff',
      gradientViaColor: '#fce7f3'
    },
    {
      name: 'Mint Fresh',
      gradientFromColor: '#f0fdfa',
      gradientToColor: '#ecfdf5',
      gradientViaColor: '#d1fae5'
    },
    {
      name: 'Peach Sorbet',
      gradientFromColor: '#fff7ed',
      gradientToColor: '#fef2f2',
      gradientViaColor: '#fed7d7'
    },
    {
      name: 'Sapphire Waves',
      gradientFromColor: '#eff6ff',
      gradientToColor: '#e0f2fe',
      gradientViaColor: '#dbeafe'
    },
    {
      name: 'Amethyst Glow',
      gradientFromColor: '#faf5ff',
      gradientToColor: '#f3e8ff',
      gradientViaColor: '#e9d5ff'
    },
    {
      name: 'Citrus Burst',
      gradientFromColor: '#fefce8',
      gradientToColor: '#ffedd5',
      gradientViaColor: '#fed7aa'
    },
    {
      name: 'Emerald Valley',
      gradientFromColor: '#f0fdf4',
      gradientToColor: '#dcfce7',
      gradientViaColor: '#d1fae5'
    },
    {
      name: 'Cotton Candy',
      gradientFromColor: '#fdf4ff',
      gradientToColor: '#fce7f3',
      gradientViaColor: '#f9a8d4'
    },
    {
      name: 'Tropical Breeze',
      gradientFromColor: '#f0fdfa',
      gradientToColor: '#e6fffa',
      gradientViaColor: '#ccfbf1'
    },
    {
      name: 'Warm Embrace',
      gradientFromColor: '#fef7ed',
      gradientToColor: '#fed7aa',
      gradientViaColor: '#fdba74'
    },
    {
      name: 'Starlight',
      gradientFromColor: '#f8fafc',
      gradientToColor: '#e2e8f0',
      gradientViaColor: '#cbd5e1'
    }
  ];
  
  // Toast notification state
  const [toastMessage, setToastMessage] = React.useState<string>('');
  const [toastType, setToastType] = React.useState<'success' | 'error' | 'info'>('success');
  const [showToast, setShowToast] = React.useState<boolean>(false);
  
  const router = useRouter();

  // Toast helper functions
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

  const hideToast = () => {
    setShowToast(false);
  };

  // Random color scheme selector - picks a different color than current
  const selectRandomColorScheme = () => {
    // Get all indices except the current one
    const availableIndices = Array.from({ length: colorSchemes.length }, (_, i) => i)
      .filter(i => i !== currentColorScheme);
    
    // Pick a deterministic index to avoid hydration mismatch
    const seed = Date.now();
    const randomIndex = availableIndices[seed % availableIndices.length];
    
    setCurrentColorScheme(randomIndex);
    
    // Save to localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('carrot-color-scheme', randomIndex.toString());
    }
    
    console.log('🎨 Auto-selected random color scheme:', colorSchemes[randomIndex].name);
  };

  // Audio recording handlers
  const handleAudioRecorded = async (blob: Blob, url: string) => {
    setAudioBlob(blob);
    setAudioUrl(url);
    setShowAudioRecorder(false);
    
    // Auto-transcribe the audio
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

  const handleAudioCancel = () => {
    setShowAudioRecorder(false);
  };

  const removeAudio = () => {
    setAudioBlob(null);
    setAudioUrl('');
    setAudioTranscription('');
    setCurrentPostId(null);
  };

  // Emoji picker handlers
  const handleEmojiButtonClick = () => {
    setShowEmojiPicker(!showEmojiPicker);
    // Close other pickers
    setShowGifPicker(false);
  };

  const handleEmojiSelect = (emoji: string) => {
    // Insert emoji at cursor position or append to content
    const textarea = document.querySelector('textarea[placeholder="What\'s happening?"]') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.slice(0, start) + emoji + content.slice(end);
      setContent(newContent);
      
      // Set cursor position after the emoji
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + emoji.length, start + emoji.length);
      }, 0);
    } else {
      // Fallback: append to end
      setContent(content + emoji);
    }
    
    // Close emoji picker after selection
    setShowEmojiPicker(false);
  };

  // Formatting button handlers
  const handleFormatting = (formatType: 'bold' | 'italic' | 'strikethrough') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.slice(start, end);
    
    let formatChars = '';
    switch (formatType) {
      case 'bold':
        formatChars = '**';
        break;
      case 'italic':
        formatChars = '*';
        break;
      case 'strikethrough':
        formatChars = '~~';
        break;
    }

    let newContent = '';
    let newCursorPos = start;

    if (selectedText) {
      // Text is selected - wrap it with formatting
      const formattedText = `${formatChars}${selectedText}${formatChars}`;
      newContent = content.slice(0, start) + formattedText + content.slice(end);
      newCursorPos = start + formatChars.length + selectedText.length + formatChars.length;
    } else {
      // No text selected - insert formatting markers and place cursor between them
      const formattedText = `${formatChars}${formatChars}`;
      newContent = content.slice(0, start) + formattedText + content.slice(end);
      newCursorPos = start + formatChars.length;
    }

    setContent(newContent);
    
    // Set cursor position and focus
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  // Color wheel click handler
  const handleColorWheelClick = () => {
    const nextScheme = (currentColorScheme + 1) % colorSchemes.length;
    setCurrentColorScheme(nextScheme);
    
    // Save to localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('carrot-color-scheme', nextScheme.toString());
    }
    
    console.log('Color scheme changed to:', colorSchemes[nextScheme].name);
  };

  // GIF picker handlers
  const handleGifButtonClick = () => {
    setShowGifPicker(true);
  };

  const handleGifPickerClose = () => {
    setShowGifPicker(false);
  };

  const handleGifSelect = (gifUrl: string) => {
    setSelectedGifUrl(gifUrl);
    setShowGifPicker(false);
    console.log('GIF selected:', gifUrl);
  };



  // Convert WebM audio to MP3 for better Firebase Storage compatibility
  const convertAudioToMp3 = async (webmBlob: Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      try {
        // Create audio context for conversion
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const fileReader = new FileReader();
        
        fileReader.onload = async (e) => {
          try {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Create WAV blob (more compatible than WebM)
            const wavBlob = audioBufferToWav(audioBuffer);
            resolve(wavBlob);
          } catch (error) {
            console.warn('🎵 Audio conversion failed, using original:', error);
            resolve(webmBlob); // Fallback to original
          }
        };
        
        fileReader.onerror = () => {
          console.warn('🎵 FileReader failed, using original WebM');
          resolve(webmBlob); // Fallback to original
        };
        
        fileReader.readAsArrayBuffer(webmBlob);
      } catch (error) {
        console.warn('🎵 Audio conversion not supported, using original:', error);
        resolve(webmBlob); // Fallback to original
      }
    });
  };

  // Convert AudioBuffer to WAV Blob
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const length = buffer.length;
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const arrayBuffer = new ArrayBuffer(44 + length * numberOfChannels * 2);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * numberOfChannels * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * numberOfChannels * 2, true);
    
    // Convert audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, buffer.getChannelData(channel)[i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  };

  // Audio recording handlers - CLEAN: Added after removing all duplicates
  const onAudioRecorded = async (blob: Blob, audioUrl: string) => {
    console.log('🎵 Audio recorded successfully:', { 
      size: blob.size, 
      type: blob.type,
      audioUrl: audioUrl?.substring(0, 50) + '...'
    });
    
    // Convert WebM to WAV for better compatibility
    let finalBlob = blob;
    if (blob.type.includes('webm')) {
      console.log('🎵 Converting WebM to WAV for better compatibility...');
      try {
        finalBlob = await convertAudioToMp3(blob);
        console.log('🎵 Audio conversion successful:', { 
          originalSize: blob.size, 
          convertedSize: finalBlob.size,
          originalType: blob.type,
          convertedType: finalBlob.type
        });
      } catch (error) {
        console.warn('🎵 Audio conversion failed, using original:', error);
        finalBlob = blob;
      }
    }
    
    // Create new blob URL for the converted audio to ensure proper metadata
    let finalAudioUrl = audioUrl;
    if (finalBlob !== blob) {
      // If we converted the audio, create a new blob URL for the converted version
      if (audioUrl && audioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(audioUrl); // Clean up original blob URL
      }
      finalAudioUrl = URL.createObjectURL(finalBlob);
      console.log('🎵 Created new blob URL for converted audio:', finalAudioUrl);
    }
    
    // Set audio blob and use blob URL for immediate playback
    setAudioBlob(finalBlob);
    setAudioUrl(finalAudioUrl);
    
    // Don't set transcription here - it will be generated server-side
    setAudioTranscription('');
    
    // Close audio recorder modal
    setShowAudioRecorder(false);
    
    console.log('✅ Audio state updated - ready for posting');
  };

  const onAudioCancel = () => {
    console.log('🚫 Audio recording cancelled');
    setShowAudioRecorder(false);
  };

  const clearAudio = () => {
    console.log('🗑️ Removing audio');
    
    // Clean up blob URL to prevent memory leaks
    if (audioUrl && audioUrl.startsWith('blob:')) {
      URL.revokeObjectURL(audioUrl);
    }
    
    // Reset all audio state
    setAudioBlob(null);
    setAudioUrl('');
    setAudioTranscription('');
    setCurrentPostId(null);
  };

  // Refs
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const postButtonRef = React.useRef<HTMLButtonElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Client-side thumbnail extraction fallback function
  const extractClientSideThumbnails = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      console.log('❌ File is not a video, skipping client-side thumbnail extraction');
      return;
    }

    console.log('🎬 Starting client-side thumbnail extraction for:', {
      name: file.name,
      type: file.type,
      size: file.size
    });
    
    try {
      // Create a video element to extract frames
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Canvas context not available');
      }

      // Create blob URL for the video
      const videoUrl = URL.createObjectURL(file);
      video.src = videoUrl;
      video.crossOrigin = 'anonymous';
      
      // Wait for video metadata to load with detailed error handling
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = () => {
          console.log('✅ Video metadata loaded successfully:', {
            duration: video.duration,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            readyState: video.readyState
          });
          resolve(null);
        };
        
        video.onerror = (error) => {
          console.error('❌ Video loading failed - likely codec issue:', {
            error: error,
            networkState: video.networkState,
            readyState: video.readyState,
            currentSrc: video.currentSrc
          });
          reject(new Error(`Video codec not supported by browser. NetworkState: ${video.networkState}, ReadyState: ${video.readyState}`));
        };
        
        video.onloadstart = () => console.log('🔄 Video loading started...');
        video.onprogress = () => console.log('🔄 Video loading progress...');
        
        console.log('🎬 Loading video with blob URL:', videoUrl);
        video.load();
      });

      const duration = video.duration;
      const thumbnailCount = 10;
      const thumbnails: string[] = [];

      // Set canvas size to video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Extract thumbnails at evenly spaced intervals
      for (let i = 0; i < thumbnailCount; i++) {
        const time = (duration / (thumbnailCount + 1)) * (i + 1);
        
        // Seek to the specific time
        video.currentTime = time;
        
        // Wait for the video to seek to the correct frame
        await new Promise((resolve) => {
          video.onseeked = resolve;
        });

        // Draw the current frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to data URL (thumbnail)
        const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        thumbnails.push(thumbnailDataUrl);
      }

      // Clean up
      URL.revokeObjectURL(videoUrl);
      
      // Set the extracted thumbnails
      setVideoThumbnails(thumbnails);
      setCurrentThumbnailIndex(0);
      console.log(`🖼️ Extracted ${thumbnails.length} client-side thumbnails`);
      
    } catch (error) {
      console.error('❌ Client-side thumbnail extraction failed:', error);
      
      // Provide a fallback for codec compatibility issues
      if (error instanceof Error && error.message && error.message.includes('codec')) {
        console.log('🔄 Video codec not supported by browser - providing fallback UI');
        
        // Create a single fallback thumbnail with video icon
        const fallbackThumbnails = [
          'data:image/svg+xml;base64,' + btoa(`
            <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
              <rect width="100%" height="100%" fill="#f3f4f6"/>
              <circle cx="160" cy="90" r="30" fill="#6b7280"/>
              <polygon points="150,75 150,105 180,90" fill="white"/>
              <text x="160" y="130" text-anchor="middle" fill="#6b7280" font-family="Arial" font-size="12">
                Video Preview
              </text>
              <text x="160" y="145" text-anchor="middle" fill="#9ca3af" font-family="Arial" font-size="10">
                (Codec not supported for thumbnails)
              </text>
            </svg>
          `)
        ];
        
        setVideoThumbnails(fallbackThumbnails);
        setCurrentThumbnailIndex(0);
        console.log('🖼️ Set fallback thumbnail for codec compatibility');
      } else {
        console.log('🔄 Generic client-side extraction failure - video preview only');
      }
    }
  };

  // Server-side thumbnail extraction function
  const extractVideoThumbnails = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      console.log('❌ File is not a video, skipping thumbnail extraction');
      return;
    }

    console.log('🎬 Starting server-side thumbnail extraction for:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: file.lastModified
    });
    
    setThumbnailsLoading(true);
    setVideoThumbnails([]);
    
    console.log('🔄 Thumbnail loading state set to true, thumbnails cleared');

    try {
      console.log('📤 Creating FormData and calling API...');
      const formData = new FormData();
      formData.append('video', file);
      console.log('📤 FormData created, making API call to /api/video/thumbnails');

      const response = await fetch('/api/video/thumbnails', {
        method: 'POST',
        body: formData,
      });

      console.log('📡 API Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ API Error Response:', errorText);
        throw new Error(`Thumbnail extraction failed: ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log('📡 Server response parsed:', result);

      if (result.success && result.thumbnails) {
        // Server-side extraction successful
        setVideoThumbnails(result.thumbnails);
        setCurrentThumbnailIndex(0);
        console.log(`🖼️ Loaded ${result.thumbnails.length} server-generated thumbnails`);
      } else if (result.success && result.useClientExtraction) {
        // Server indicates to use client-side extraction
        console.log('🔄 Using client-side thumbnail extraction:', result.message);
        await extractClientSideThumbnails(file);
      } else {
        console.warn('⚠️ No thumbnails returned from server');
      }
    } catch (error) {
      console.error('❌ Server-side thumbnail extraction failed:', error);
      // Fallback to client-side extraction
      console.log('🔄 Falling back to client-side thumbnail extraction');
      await extractClientSideThumbnails(file);
    } finally {
      setThumbnailsLoading(false);
    }
  };

  // Background upload function - Cloudflare Stream direct upload via tus
  const uploadFileInBackground = async (file: File): Promise<string> => {
    if (!file) return Promise.reject(new Error('No file'));
    
    console.log('🚀 Starting Cloudflare Stream upload for:', file.name);
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // Request a Cloudflare Stream direct upload URL
      const duResp = await fetch('/api/cf/stream/direct-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!duResp.ok) {
        const err = await duResp.text().catch(() => 'Unknown error');
        throw new Error(`Failed to create CF direct upload: ${duResp.status} ${err}`);
      }
      const { uploadURL, uid } = await duResp.json();
      if (!uploadURL || !uid) throw new Error('Invalid CF direct upload response');
      setCfUid(uid);
      setCfStatus('queued');

      // Start tus upload to Cloudflare Stream with progress updates
      await uploadToCloudflareStream(file, uploadURL, ({ progress }) => {
        setUploadProgress(Math.max(1, Math.round((progress || 0) * 100)));
        setIsUploading(true);
      });

      setCfStatus('uploaded');
      setUploadProgress(100);
      console.log('✅ Cloudflare Stream upload complete. uid:', uid);
      showSuccessToast('Upload complete. Processing video…');
      setIsUploading(false);
      return uid as string;
    } catch (error) {
      console.error('Background upload failed:', error);
      setIsUploading(false);
      setUploadProgress(0);
      throw error;
    }
  };

  const openFileDialog = (accept: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setMediaType(file.type);
    setMediaFile(file);
    setShowModal(true);
    
    // Create preview URL with validation
    try {
      const previewUrl = URL.createObjectURL(file);
      console.log('Created blob URL:', previewUrl);
      
      // Validate the blob URL
      if (!previewUrl || !previewUrl.startsWith('blob:')) {
        throw new Error('Invalid blob URL created');
      }
      
      setMediaPreview(previewUrl);
      setSelectedFile(file);
      e.target.value = "";
      
      console.log('File selected:', {
        name: file.name,
        type: file.type,
        size: file.size,
        previewUrl: previewUrl
      });
      
      // Start server-side thumbnail extraction for video files
      if (file.type.startsWith('video/')) {
        extractVideoThumbnails(file);
      }
    } catch (error) {
      console.error('Error creating preview URL:', error);
      alert('Error loading video preview. Please try again.');
      return;
    }

    // Start background upload and remember the promise so we can await uid on save
    const p = uploadFileInBackground(file);
    setCfUploadPromise(p);
  };

  const cancelUpload = () => {
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaPreview(null);
    setMediaFile(null);
    setSelectedFile(null);
    setMediaType(null);
    setUploadedMedia(null);
    setVideoThumbnails([]);
    setCurrentThumbnailIndex(0);
    setThumbnailsLoading(false);
    setShowModal(false);
    setIsUploading(false);
    setUploadProgress(0);
  };

  return (
    <>
      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={showToast}
        onClose={hideToast}
      />

      {/* Upload Modal - Create Post UX */}
      {showModal && mediaPreview && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-2 sm:p-4">
          <div 
            className="rounded-2xl max-w-2xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl"
            style={{
              background: `linear-gradient(to bottom right, ${colorSchemes[currentColorScheme].gradientFromColor}, ${colorSchemes[currentColorScheme].gradientViaColor}, ${colorSchemes[currentColorScheme].gradientToColor})`
            }}
          >
            <div className="p-4 sm:p-8">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800">Create Post</h2>
                <button
                  onClick={cancelUpload}
                  className="w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center text-gray-600 hover:text-gray-800 transition-all duration-200 shadow-md hover:shadow-lg"
                  aria-label="Close modal"
                >
                  <span className="text-lg font-bold leading-none">&times;</span>
                </button>
              </div>

              {/* Media Preview */}
              <div className="mb-4">
                {mediaType && mediaType.startsWith('video/') ? (
                  <div className="w-full">
                    {/* Video Thumbnail Preview - Full Size */}
                    <div className="relative rounded-2xl bg-white shadow-lg border border-gray-100 mb-6 overflow-hidden">
                      {selectedFile ? (
                        <div className="relative w-full">
                          {isUploading ? (
                            <div className="w-full h-80 bg-gradient-to-br from-orange-50 to-orange-100 flex items-center justify-center">
                              <div className="text-center">
                                {/* Cute bouncing carrot animation */}
                                <div className="text-6xl mb-6 animate-bounce" style={{ animationDuration: '1s' }}>🥕</div>
                                <div className="text-xl font-semibold text-orange-700 mb-2">Carrot is uploading your video...</div>
                                <div className="text-sm text-orange-600 mb-6">Hang tight, this won't take long! 🐰</div>
                                {/* Cute progress bar with carrot theme */}
                                <div className="w-72 mx-auto">
                                  <div className="flex justify-between text-sm text-orange-600 font-medium mb-3">
                                    <span className="flex items-center gap-1">
                                      <span className="text-xs">🥕</span>
                                      Progress
                                    </span>
                                    <span className="font-bold">{Math.round(uploadProgress)}%</span>
                                  </div>
                                  <div className="w-full bg-orange-200 rounded-full h-4 shadow-inner">
                                    <div 
                                      className="bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 h-4 rounded-full transition-all duration-500 ease-out shadow-sm relative overflow-hidden"
                                      style={{ width: `${uploadProgress}%` }}
                                    >
                                      {/* Subtle shimmer effect */}
                                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
                                    </div>
                                  </div>
                                  {/* Cute progress messages */}
                                  <div className="text-xs text-orange-500 mt-2 font-medium">
                                    {uploadProgress < 25 && "🐰 Starting upload..."}
                                    {uploadProgress >= 25 && uploadProgress < 50 && "🥕 Making progress..."}
                                    {uploadProgress >= 50 && uploadProgress < 75 && "🚀 Almost there..."}
                                    {uploadProgress >= 75 && uploadProgress < 100 && "✨ Finishing up..."}
                                    {uploadProgress >= 100 && "🎉 Upload complete!"}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : thumbnailsLoading ? (
                            <div className="w-full h-80 bg-gradient-to-br from-blue-50 to-purple-100 flex items-center justify-center">
                              <div className="text-center">
                                <div className="text-5xl mb-4 animate-pulse" style={{ animationDuration: '1.5s' }}>🐰</div>
                                <div className="text-lg font-semibold text-purple-700 mb-2">Rabbit is preparing thumbnails...</div>
                                <div className="text-sm text-purple-600">Creating beautiful previews for you! 🎬</div>
                              </div>
                            </div>
                          ) : videoThumbnails.length > 0 ? (
                            <div className="relative">
                              <img
                                src={videoThumbnails[currentThumbnailIndex]}
                                alt={`Video thumbnail ${currentThumbnailIndex + 1}`}
                                className="w-full h-80 object-cover bg-gray-100"
                                onError={(e) => {
                                  console.log('Thumbnail failed to load:', videoThumbnails[currentThumbnailIndex]);
                                }}
                              />
                              {/* Frame indicator - only visible overlay */}
                              <div className="absolute top-4 right-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold px-3 py-1.5 rounded-full shadow-lg">
                                Frame {currentThumbnailIndex + 1}/{videoThumbnails.length}
                              </div>
                            </div>
                          ) : (
                            <div className="w-full h-80 bg-gray-100 flex items-center justify-center">
                              <div className="text-center">
                                <div className="text-4xl mb-4">🎬</div>
                                <div className="text-lg text-gray-600">Video preview</div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-80 bg-gray-100 flex items-center justify-center">
                          <div className="text-6xl">🎬</div>
                        </div>
                      )}
                    </div>
                    
                    {/* Frame-Based Thumbnail Scrubbing Slider */}
                    {selectedFile && selectedFile.type.startsWith('video/') && videoThumbnails.length > 0 && (
                      <div className="mt-6 bg-white rounded-xl p-6 shadow-md border border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-base text-gray-700 font-semibold">Choose thumbnail:</span>
                          <span className="text-sm text-orange-600 font-bold bg-orange-50 px-3 py-1 rounded-full">Frame {currentThumbnailIndex + 1} of {videoThumbnails.length}</span>
                        </div>
                        <div className="relative w-full h-8 flex items-center">
                          {/* Background track */}
                          <div className="absolute inset-0 h-1 bg-gray-200 rounded-full top-1/2 transform -translate-y-1/2"></div>
                          
                          {/* Orange progress track */}
                          <div 
                            className="absolute h-1 bg-gradient-to-r from-orange-500 to-orange-600 rounded-full top-1/2 transform -translate-y-1/2 transition-all duration-300"
                            style={{ 
                              left: '0%',
                              width: `${((currentThumbnailIndex) / (videoThumbnails.length - 1)) * 100}%` 
                            }}
                          />
                          
                          {/* Clickable circular frame indicators */}
                          <div className="absolute inset-0 flex justify-between items-center">
                            {Array.from({ length: videoThumbnails.length }, (_, i) => {
                              const frameNum = i + 1;
                              const isSelected = i === currentThumbnailIndex;
                              return (
                                <button
                                  key={i}
                                  onClick={() => {
                                    setCurrentThumbnailIndex(i);
                                    console.log(`🖼️ Clicked to switch to thumbnail ${frameNum}/${videoThumbnails.length}`);
                                  }}
                                  className={`relative w-6 h-6 rounded-full border-2 transition-all duration-200 hover:scale-125 cursor-pointer flex items-center justify-center ${
                                    isSelected 
                                      ? 'bg-orange-500 border-orange-600 shadow-lg' 
                                      : 'bg-white border-gray-300 hover:border-orange-400 shadow-md'
                                  }`}
                                  title={`Jump to frame ${frameNum}`}
                                >
                                  <span className={`text-xs font-bold ${
                                    isSelected ? 'text-white' : 'text-gray-600'
                                  }`}>
                                    {frameNum}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                          
                          {/* Hidden range input for keyboard accessibility */}
                          <input
                            type="range"
                            min="0"
                            max={videoThumbnails.length - 1}
                            step="1"
                            value={currentThumbnailIndex}
                            onChange={(e) => {
                              const newIndex = parseInt(e.target.value);
                              setCurrentThumbnailIndex(newIndex);
                              console.log(`🖼️ Slider moved to thumbnail ${newIndex + 1}/${videoThumbnails.length}`);
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            style={{ 
                              background: 'transparent',
                              WebkitAppearance: 'none',
                              appearance: 'none'
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <img
                    src={mediaPreview}
                    alt="Preview"
                    className="w-full h-64 object-cover rounded-2xl bg-gray-100 shadow-lg"
                  />
                )}
              </div>

            {/* Caption Input */}
            <div className="mb-6">
              <textarea
                className="w-full h-32 p-4 border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white shadow-sm"
                placeholder="What's happening?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </div>

            {/* Modal Actions */}
            <div className="flex gap-4 justify-end">
              <button
                onClick={cancelUpload}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!content.trim()) return;
                  
                  try {
                    console.log('🚀 Starting post creation process...');
                    console.log('📝 Content:', content);
                    console.log('🎬 Media file:', selectedFile);
                    console.log('🔗 Media preview:', mediaPreview);
                    
                    // Generate temporary ID for optimistic UI
                    const tempId = `temp-${Date.now()}`;
                    
                    // Create optimistic UI post IMMEDIATELY (no upload delay)
                    if (user && onPost) {
                      const newPost = {
                        id: tempId,
                        content: content,
                        timestamp: new Date().toISOString(),
                        author: {
                          id: (user as any).id || 'temp-user',
                          name: user.name || user.email?.split('@')[0] || 'You',
                          username: (user as any).username ? `@${(user as any).username}` : '@daniel',
                          avatar: user.image || null,
                          flag: '🇺🇸'
                        },
                        location: {
                          city: 'San Francisco',
                          state: 'CA'
                        },
                        likes: 0,
                        comments: 0,
                        shares: 0,
                        imageUrls: mediaPreview && !mediaType?.startsWith('video/') && !mediaType?.startsWith('audio/') ? [mediaPreview] : [],
                        videoUrl: mediaPreview && mediaType?.startsWith('video/') ? mediaPreview : null,
                        gifUrl: null,
                        audioUrl: audioUrl || null,
                        emoji: '🎯',
                        colorScheme: colorSchemes[currentColorScheme].name,
                        // Add gradient color data for proper background display
                        gradientDirection: 'to-br',
                        gradientFromColor: colorSchemes[currentColorScheme].gradientFromColor,
                        gradientToColor: colorSchemes[currentColorScheme].gradientToColor,
                        gradientViaColor: colorSchemes[currentColorScheme].gradientViaColor,
                        // Add transcription fields for video/audio posts
                        transcriptionStatus: (mediaType?.startsWith('video/') || audioUrl) ? 'pending' : null,
                        audioTranscription: null,
                        // Add upload status for video posts
                        uploadStatus: mediaType?.startsWith('video/') ? 'uploading' : null,
                        uploadProgress: 0
                      };
                      
                      // Add to UI immediately for responsive feel
                      onPost(newPost);
                    }
                    
                    // Clear form and close modal IMMEDIATELY for responsive UI
                    const contentToSave = content;
                    const fileToUpload = selectedFile;
                    const mediaTypeToSave = mediaType;
                    const audioUrlToSave = audioUrl;
                    const colorSchemeToSave = currentColorScheme;
                    
                    setContent('');
                    setSelectedFile(null);
                    setMediaPreview(null);
                    setMediaType(null);
                    cancelUpload();
                    selectRandomColorScheme();
                    // Show different toast based on media type
                    if (mediaTypeToSave?.startsWith('video/')) {
                      showSuccessToast('Video post created! Uploading in background...');
                    } else {
                      showSuccessToast('Post shared successfully!');
                    }
                    
                    // Upload media and save to database in background (truly non-blocking)
                    (async () => {
                      let finalMediaUrl = null;
                      
                      // Upload media if we have a file
                      if (fileToUpload) {
                        console.log('📤 Uploading media file in background...');
                        
                        try {
                          if (mediaTypeToSave?.startsWith('video/')) {
                            // Cloudflare Stream path: if not started, start now
                            if (!cfUid) {
                              showSuccessToast('Uploading video to Cloudflare…');
                              await uploadFileInBackground(fileToUpload);
                            } else {
                              console.log('▶️ CF upload already started. uid:', cfUid);
                            }
                            // No finalMediaUrl for CF videos; playback via cfUid
                          } else {
                            // Images (and other non-video) still use Firebase or existing flow
                            const uploadResult = await uploadFilesToFirebase([fileToUpload], 'posts');
                            console.log('✅ Upload result:', uploadResult);
                            if (uploadResult && uploadResult.length > 0) {
                              finalMediaUrl = uploadResult[0];
                              console.log('🔗 Final media URL:', finalMediaUrl);
                            }
                          }
                        } catch (uploadError) {
                          console.error('❌ Upload failed:', uploadError);
                          if (mediaTypeToSave?.startsWith('video/')) {
                            showErrorToast('Video upload failed. Please try again.');
                          }
                          return;
                        }
                      }
                    
                      // Save to database in background
                      try {
                      console.log('🚀 Attempting to save post to database...');
                        console.log('📝 Post data:', {
                          content: contentToSave,
                          finalMediaUrl,
                          mediaType: mediaTypeToSave,
                          imageUrls: finalMediaUrl && !mediaTypeToSave?.startsWith('video/') ? [finalMediaUrl] : [],
                          gifUrl: null,
                          audioUrl: audioUrlToSave,
                          emoji: '🎯',
                          colorScheme: colorSchemes[colorSchemeToSave].name
                        });
                      
                      // Ensure CF uid is available for video before creating the post
                      let cfUidToSend = cfUid;
                      if (mediaTypeToSave?.startsWith('video/') && !cfUidToSend && cfUploadPromise) {
                        try {
                          cfUidToSend = await Promise.race<string>([
                            cfUploadPromise,
                            new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for CF uid')), 10000))
                          ]);
                          setCfUid(cfUidToSend);
                        } catch (e) {
                          console.warn('⚠️ CF uid not ready before POST, proceeding without it');
                        }
                      }

                      const postBody1 = {
                        content: contentToSave,
                        gradientDirection: 'to-br',
                        gradientFromColor: colorSchemes[colorSchemeToSave].gradientFromColor,
                        gradientToColor: colorSchemes[colorSchemeToSave].gradientToColor,
                        gradientViaColor: colorSchemes[colorSchemeToSave].gradientViaColor,
                        imageUrls: finalMediaUrl && !mediaTypeToSave?.startsWith('video/') ? [finalMediaUrl] : [],
                        // If using Cloudflare Stream, do not send videoUrl
                        videoUrl: cfUidToSend ? null : (finalMediaUrl && mediaTypeToSave?.startsWith('video/') ? finalMediaUrl : null),
                        gifUrl: null,
                        audioUrl: audioUrlToSave || null,
                        emoji: '🎯',
                        carrotText: '',
                        stickText: '',
                        // Cloudflare Stream identifiers
                        cfUid: cfUidToSend || null,
                        cfStatus: cfUidToSend ? (cfStatus || 'queued') : null,
                        // Include temp ID for post update
                        tempId: tempId
                      };
                      console.log('🛰️ About to POST /api/posts with body (primary flow):', postBody1);

                      const response = await fetch('/api/posts', {
                        method: 'POST',
                        credentials: 'include',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(postBody1)
                      });
                      
                      console.log('📡 Response status:', response.status);
                      const responseData = await response.json();
                      console.log('📡 Response data:', responseData);
                      
                      if (!response.ok) {
                        console.error('❌ Failed to save post to database:', responseData);
                        console.error('❌ Error details:', responseData.details);
                        console.error('❌ Error name:', responseData.name);
                        
                        // Update post status to show error
                        if (mediaTypeToSave?.startsWith('video/') && onPostUpdate) {
                          onPostUpdate(tempId, {
                            id: tempId,
                            uploadStatus: 'error',
                            transcriptionStatus: 'error'
                          });
                        }
                      } else {
                        console.log('✅ Post saved to database successfully');
                        
                        // Update post with real database data and mark as ready
                        // FIX: API returns post data directly, not wrapped in responseData.post
                        const postData = responseData.post || responseData; // Handle both formats
                        if (onPostUpdate && postData && postData.id) {
                          console.log('🔄 CRITICAL: Updating post with database data');
                          console.log('🎯 TempId:', tempId);
                          console.log('🎯 Database post ID:', postData.id);
                          console.log('🎯 Upload status will be:', mediaTypeToSave?.startsWith('video/') ? (cfUid ? 'processing' : 'ready') : null);
                          console.log('🎯 Transcription status will be:', (postData.videoUrl || postData.audioUrl || cfUid) ? 'processing' : null);
                          
                          onPostUpdate(tempId, {
                            ...postData,
                            // Include CF fields for immediate playback
                            cfUid: cfUid || postData.cfUid || null,
                            cfStatus: cfUid ? (cfStatus || 'queued') : (postData.cfStatus || null),
                            uploadStatus: mediaTypeToSave?.startsWith('video/') ? (cfUid ? 'processing' : 'ready') : null,
                            transcriptionStatus: (postData.videoUrl || postData.audioUrl || cfUid) ? 'processing' : null
                          });
                          
                          console.log('✅ onPostUpdate called successfully');
                        } else {
                          console.error('❌ onPostUpdate failed - missing data');
                          console.log('🔍 onPostUpdate exists:', !!onPostUpdate);
                          console.log('🔍 responseData.post exists:', !!responseData.post);
                          console.log('🔍 responseData exists:', !!responseData);
                          console.log('🔍 responseData.id exists:', !!responseData.id);
                        }
                        
                        // Start transcription for video/audio posts
                        const postForTranscription = responseData.post || responseData; // Handle both formats
                        if (postForTranscription && (postForTranscription.videoUrl || postForTranscription.audioUrl)) {
                          console.log('🎵 Starting transcription for media post:', postForTranscription.id);
                          
                          // Trigger transcription in background
                          fetch('/api/transcribe', {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              postId: postForTranscription.id,
                              audioUrl: postForTranscription.audioUrl,
                              videoUrl: postForTranscription.videoUrl,
                              mediaType: postForTranscription.videoUrl ? 'video' : 'audio'
                            })
                          }).then(transcribeResponse => {
                            console.log('🎵 Transcription started:', transcribeResponse.status);
                          }).catch(transcribeError => {
                            console.warn('🎵 Transcription start failed:', transcribeError);
                            
                            // Update transcription status to show it failed
                            if (onPostUpdate) {
                              onPostUpdate(postForTranscription.id, {
                                id: postForTranscription.id,
                                transcriptionStatus: 'failed'
                              });
                            }
                          });
                        }
                      }
                    } catch (dbError) {
                        console.error('❌ Database save error:', dbError);
                        
                        // Update post status to show error
                        if (mediaTypeToSave?.startsWith('video/') && onPostUpdate) {
                          onPostUpdate(tempId, {
                            id: tempId,
                            uploadStatus: 'error',
                            transcriptionStatus: 'error'
                          });
                        }
                        
                        showErrorToast('Failed to save post. Please try again.');
                      }
                    })(); // End of background async function
                    
                  } catch (error) {
                    console.error('Post creation failed:', error);
                    // Show professional error toast
                    showErrorToast('Failed to create post. Please try again.');
                  }
                  }}
                  disabled={!content.trim()}
                  className="px-8 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Hidden file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*,.mp4,.mov,.webm"
        className="hidden"
        onChange={onFileChange}
      />

      {/* Main Composer */}
      <div className="w-full mb-6" style={{ width: '650px !important', maxWidth: '650px !important', paddingLeft: '16px', paddingRight: '16px' }}>
        <div className="relative w-full">
          {/* Composer gradient card */}
          <div 
            className="rounded-2xl p-4 sm:p-6 w-full relative"
            style={{
              background: `linear-gradient(to bottom right, ${colorSchemes[currentColorScheme].gradientFromColor}, ${colorSchemes[currentColorScheme].gradientViaColor}, ${colorSchemes[currentColorScheme].gradientToColor})`
            }}
          >
            

            
            {/* Color wheel - positioned to overlap gradient/white card and center with B/I/S */}
            <div 
              className="absolute -top-2 right-7 sm:right-9 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center shadow-lg cursor-pointer hover:scale-105 transition-transform z-10"
              onClick={handleColorWheelClick}
              title={`Current: ${colorSchemes[currentColorScheme].name}`}
            >
              <span className="text-white font-bold text-base sm:text-lg">🎨</span>
            </div>
            
            {/* White input card */}
            <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-100 mb-4 relative">
              <textarea
                ref={textareaRef}
                className="w-full h-16 sm:h-20 text-base sm:text-lg border-none bg-transparent focus:outline-none resize-none placeholder-gray-500"
                placeholder="What's happening?"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              
              {/* B/I/S formatting tools - spaced evenly within white card */}
              <div className="absolute top-8 right-4 sm:right-6 flex flex-col items-center gap-3">
                <button 
                  onClick={() => handleFormatting('bold')}
                  className="w-6 h-6 bg-gray-100 hover:bg-orange-200 rounded flex items-center justify-center text-xs font-bold transition-colors" 
                  title="Bold (Markdown: **text**)"
                >
                  B
                </button>
                <button 
                  onClick={() => handleFormatting('italic')}
                  className="w-6 h-6 bg-gray-100 hover:bg-orange-200 rounded flex items-center justify-center text-xs italic transition-colors" 
                  title="Italic (Markdown: *text*)"
                >
                  I
                </button>
                <button 
                  onClick={() => handleFormatting('strikethrough')}
                  className="w-6 h-6 bg-gray-100 hover:bg-orange-200 rounded flex items-center justify-center text-xs line-through transition-colors" 
                  title="Strikethrough (Markdown: ~~text~~)"
                >
                  S
                </button>
              </div>
            </div>
            
            {/* GIF Preview */}
            {selectedGifUrl && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
                <div className="flex items-start gap-3">
                  {/* GIF Display */}
                  <div className="flex-1">
                    <div className="relative rounded-lg overflow-hidden bg-gray-50 max-w-xs">
                      <img
                        src={selectedGifUrl}
                        alt="Selected GIF"
                        className="w-full h-auto max-h-48 object-contain"
                      />
                      {/* Remove GIF button */}
                      <button
                        onClick={() => setSelectedGifUrl(null)}
                        className="absolute top-2 right-2 bg-black bg-opacity-60 hover:bg-opacity-80 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm transition-all duration-200"
                        title="Remove GIF"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                  
                  {/* GIF Info and Controls */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">GIF Selected</span>
                      <button
                        onClick={handleGifButtonClick}
                        className="text-xs text-orange-500 hover:text-orange-600 font-medium transition-colors"
                      >
                        Change GIF
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">
                      Ready to post with your message
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedGifUrl(null)}
                        className="flex-1 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                      >
                        Remove
                      </button>
                      <button
                        onClick={handleGifButtonClick}
                        className="flex-1 px-3 py-1.5 text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-md transition-colors"
                      >
                        Replace
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Audio Preview */}
            {audioUrl && (
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
                <div className="flex items-start gap-3">
                  {/* Audio Player - FIXED: Show immediately with blob URL */}
                  <div className="flex-1">
                    <AudioPlayer 
                      key={audioUrl} // Use audioUrl as key for proper re-rendering
                      audioUrl={audioUrl}
                      postId={currentPostId || undefined} // Playback-only in composer
                      className="w-full"
                    />
                  </div>
                  
                  {/* Audio Info and Controls */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">Audio Recorded</span>
                      <button
                        onClick={() => {
                          setShowAudioRecorder(true);
                          setAudioTranscription(''); // Clear old transcription when re-recording
                        }}
                        className="text-xs text-orange-500 hover:text-orange-600 font-medium transition-colors"
                      >
                        Re-record
                      </button>
                    </div>

                    <p className="text-xs text-gray-500 mb-3">
                      Ready to post with your message
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={removeAudio}
                        className="flex-1 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => setShowAudioRecorder(true)}
                        className="flex-1 px-3 py-1.5 text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-md transition-colors"
                      >
                        Replace
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Emoji Picker */}
            {showEmojiPicker && (
              <div className="mt-4 p-4 bg-white/90 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg">
                <div className="max-h-64 overflow-y-auto">
                  {Object.entries(emojiCategories).map(([category, emojis]) => (
                    <div key={category} className="mb-4">
                      <h4 className="text-sm font-semibold text-gray-700 mb-2 px-2">{category}</h4>
                      <div className="grid grid-cols-8 gap-1">
                        {emojis.map((emoji, index) => (
                          <button
                            key={`${category}-${index}`}
                            onClick={() => handleEmojiSelect(emoji)}
                            className="p-2 text-xl hover:bg-gray-100 rounded-lg transition-colors duration-150 flex items-center justify-center"
                            title={emoji}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-200 flex justify-end">
                  <button
                    onClick={() => setShowEmojiPicker(false)}
                    className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
            
            {/* Action row */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2 sm:gap-4">
                <button 
                  className="p-2 hover:bg-white/50 rounded-full transition-colors" 
                  title="Add image/video" 
                  onClick={() => openFileDialog("image/*,video/*,.mp4,.mov,.webm")}
                >
                  <IconPhoto />
                </button>
                <button 
                  className="p-2 hover:bg-white/50 rounded-full transition-colors" 
                  title="GIF" 
                  onClick={handleGifButtonClick}
                >
                  <IconGif />
                </button>
                <button 
                  className="p-2 hover:bg-white/50 rounded-full transition-colors" 
                  title="Emoji"
                  onClick={handleEmojiButtonClick}
                >
                  <IconEmoji />
                </button>
                <button 
                  className="p-2 hover:bg-white/50 rounded-full transition-colors" 
                  title="Audio"
                  onClick={() => setShowAudioRecorder(true)}
                >
                  <IconAudio />
                </button>
                <button 
                  className="p-2 hover:bg-white/50 rounded-full transition-colors" 
                  title="Commitment"
                  onClick={handleColorWheelClick}
                >
                  <IconCarrot />
                </button>
                <button className="p-2 hover:bg-white/50 rounded-full transition-colors" title="Boost">
                  <IconLightning />
                </button>
              </div>
              
              <button 
                ref={postButtonRef} 
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-6 rounded-full shadow disabled:opacity-50 transition-colors" 
                disabled={!content.trim()}
                onClick={async () => {
                  try {
                    console.log('🚀 POST BUTTON CLICKED - Starting post creation...');
                    
                    if (!content.trim()) {
                      console.log('❌ No content, returning early');
                      return;
                    }
                    
                    // Debug: Log user session data
                    console.log('🔍 Session status:', status);
                    console.log('🔍 Full session object:', session);
                    console.log('🔍 User object:', user);
                    console.log('🔍 User name:', user?.name);
                    console.log('🔍 User email:', user?.email);
                    
                    // Debug: Log audio state during post creation
                    console.log('🎵 AUDIO STATE DEBUG:', {
                      audioBlob: audioBlob ? `${audioBlob.size} bytes` : null,
                      audioUrl: audioUrl,
                      audioTranscription: audioTranscription,
                      hasAudio: !!audioBlob
                    });
                  } catch (error) {
                    console.error('💥 CRITICAL ERROR in post button click handler:', error);
                    console.error('💥 Error stack:', (error as Error).stack);
                    return;
                  }
                  
                  // Safety check: Ensure we have user data
                  if (!user) {
                    console.warn('⚠️ No user data available for optimistic UI update - skipping optimistic UI');
                  }
                  if (status !== 'authenticated') {
                    console.warn('⚠️ Session status is not authenticated:', status);
                  }
                  
                  // Start media uploads in background (non-blocking)
                  let uploadedAudioUrl = null;
                  let uploadedVideoUrl = null;
                  let audioUploadPromise = null;
                  let videoUploadPromise = null;
                  
                  // Handle audio upload
                  if (audioBlob) {
                    try {
                      // Convert Blob to File for uploadFilesToFirebase
                      const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
                      
                      // Start upload but don't wait for it
                      audioUploadPromise = uploadFilesToFirebase([audioFile], 'audio/webm');
                      console.log('🎵 Audio upload started in background...');
                    } catch (error) {
                      console.error('Audio upload initialization failed:', error);
                      showErrorToast('Failed to start audio upload');
                      return;
                    }
                  }
                  
                  // Handle video upload
                  if (mediaFile && mediaType?.startsWith('video/')) {
                    try {
                      // With Cloudflare Stream, allow posting once we have a cfUid (upload may still be processing)
                      if (cfUid) {
                        console.log('🎬 Using Cloudflare Stream UID:', cfUid);
                        // Do not set uploadedVideoUrl; playback will use cfUid
                      } else {
                        console.log('🎬 No Cloudflare Stream UID yet');
                        showErrorToast('Please start the video upload before posting.');
                        return;
                      }
                    } catch (error) {
                      console.error('Video upload initialization failed:', error);
                      showErrorToast('Failed to start video upload');
                      return;
                    }
                  }

                  // Generate temp ID for optimistic UI and post updates
                  const tempPostId = `temp-${Date.now()}`;

                  // Only do optimistic UI update if we have user data
                  if (user && onPost) {
                    // Create complete post object for optimistic UI update
                    const newPost = {
                      id: tempPostId,
                      content: content,
                      carrotText: '',
                      stickText: '',
                      author: {
                        name: user?.name || user?.email?.split('@')[0] || 'You',
                        username: user?.name || 'Anonymous',
                        avatar: user?.image || null,
                        flag: user?.name ? '🇺🇸' : undefined,
                        id: (user as any)?.id || undefined
                      },
                      location: {
                        zip: '00000',
                        city: 'Your City'
                      },
                      stats: {
                        likes: 0,
                        comments: 0,
                        reposts: 0,
                        views: 0
                      },
                      userVote: null,
                      timestamp: new Date().toISOString(),
                      imageUrls: [],
                      gifUrl: selectedGifUrl,
                      audioUrl: audioUrl || null, // FIXED: Use actual audio URL (blob URL for instant display)
                      audioTranscription: audioTranscription,
                      transcriptionStatus: audioBlob ? 'pending' : null,
                      // Video support with instant thumbnail display
                      videoUrl: uploadedVideoUrl || null,
                      videoThumbnail: videoThumbnails.length > 0 ? videoThumbnails[currentThumbnailIndex] : null,
                      videoTranscriptionStatus: uploadedVideoUrl ? 'pending' : null,
                      emoji: '🎯',
                      colorScheme: colorSchemes[currentColorScheme].name,
                      gradientDirection: 'to-br',
                      gradientFromColor: colorSchemes[currentColorScheme].gradientFromColor,
                      gradientToColor: colorSchemes[currentColorScheme].gradientToColor,
                      gradientViaColor: colorSchemes[currentColorScheme].gradientViaColor
                    };
                    
                    // Add to UI immediately for responsive feel
                    onPost(newPost);
                  }
                
                  // Save to database in background
                  try {
                    // Ensure CF uid is available for video before creating the post
                    let cfUidToSend2 = cfUid;
                    if (!!uploadedVideoUrl && !cfUidToSend2 && cfUploadPromise) {
                      try {
                        cfUidToSend2 = await Promise.race<string>([
                          cfUploadPromise,
                          new Promise<string>((_, reject) => setTimeout(() => reject(new Error('Timed out waiting for CF uid')), 10000))
                        ]);
                        setCfUid(cfUidToSend2);
                      } catch (e) {
                        console.warn('⚠️ CF uid not ready before POST (secondary flow), proceeding without it');
                      }
                    }

                    const postBody2 = {
                      content: content,
                      gradientDirection: 'to-br',
                      gradientFromColor: colorSchemes[currentColorScheme].gradientFromColor,
                      gradientToColor: colorSchemes[currentColorScheme].gradientToColor,
                      gradientViaColor: colorSchemes[currentColorScheme].gradientViaColor,
                      imageUrls: [],
                      gifUrl: selectedGifUrl,
                      audioUrl: null, // Will be updated when upload completes
                      audioTranscription: audioTranscription,
                      transcriptionStatus: audioBlob ? 'pending' : null,
                      // Video support: if using Cloudflare Stream, do not send videoUrl
                      videoUrl: cfUidToSend2 ? null : (uploadedVideoUrl || null),
                      videoThumbnail: videoThumbnails.length > 0 ? videoThumbnails[currentThumbnailIndex] : null,
                      videoTranscriptionStatus: uploadedVideoUrl ? 'pending' : null,
                      emoji: '🎯',
                      carrotText: '',
                      stickText: '',
                      // Cloudflare Stream identifiers
                      cfUid: cfUidToSend2 || null,
                      cfStatus: cfUidToSend2 ? (cfStatus || 'queued') : null
                    };
                    console.log('🛰️ About to POST /api/posts with body (secondary flow):', postBody2);

                    const response = await fetch('/api/posts', {
                      method: 'POST',
                      credentials: 'include',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify(postBody2),
                    });
                    
                    if (!response.ok) {
                      const errorText = await response.text();
                      console.error('Failed to save post to database:', {
                        status: response.status,
                        statusText: response.statusText,
                        error: errorText
                      });
                      try { showErrorToast('Failed to save. Please retry.'); } catch {}
                      return;
                    } else {
                      const savedPost = await response.json();
                      console.log('Post saved to database successfully');
                      console.log('Real post ID:', savedPost.id);
                      
                      // Handle background audio upload completion
                      if (audioUploadPromise && savedPost.id) {
                        console.log('🎵 Waiting for background audio upload to complete...');
                        audioUploadPromise.then(async (audioUploadResponse) => {
                          console.log('🎵 Firebase upload response received:', { 
                            response: audioUploadResponse, 
                            isArray: Array.isArray(audioUploadResponse),
                            length: audioUploadResponse?.length,
                            firstItem: audioUploadResponse?.[0]
                          });
                          
                          if (audioUploadResponse && audioUploadResponse.length > 0) {
                            const finalAudioUrl = audioUploadResponse[0];
                            console.log('🎵 Background audio upload completed:', finalAudioUrl);
                            
                            // Update post with final audio URL
                            try {
                              const updateResponse = await fetch(`/api/posts/${savedPost.id}`, {
                                method: 'PATCH',
                                credentials: 'include',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                  audioUrl: finalAudioUrl,
                                  transcriptionStatus: 'processing' 
                                })
                              });
                              
                              if (updateResponse.ok) {
                                console.log('🎵 Post updated with final audio URL');
                                setCurrentPostId(savedPost.id); // Enable transcription polling
                                
                                // Update the UI with the new audio URL (use real post ID since temp ID was already replaced)
                                if (onPostUpdate) {
                                  console.log('🎵 Updating UI with Firebase Storage URL:', finalAudioUrl);
                                  onPostUpdate(savedPost.id, { audioUrl: finalAudioUrl });
                                }
                              }
                            } catch (updateError) {
                              console.error('Failed to update post with audio URL:', updateError);
                            }
                          }
                        }).catch((uploadError) => {
                          console.error('Background audio upload failed:', uploadError);
                        });
                      }

                      // Update dashboard feed post with real ID
                      if (onPostUpdate && tempPostId && savedPost.id) {
                        console.log('🔄 Updating dashboard post:', tempPostId, '→', savedPost.id);
                        onPostUpdate(tempPostId, savedPost);
                      }
                    }
                  } catch (error) {
                    console.error('Error saving post:', error);
                    try { showErrorToast('Failed to save. Please retry.'); } catch {}
                    return;
                  }
                  
                  // Clear content, selected GIF, audio, video, and show success
                  setContent('');
                  setSelectedGifUrl(null);
                  removeAudio();
                  cancelUpload(); // Clear video state
                  setCurrentPostId(null);
                  // Auto-select a random color scheme for next post
                  selectRandomColorScheme();
                  showSuccessToast('Post shared successfully!');
                }}
              >
                Post
              </button>
            </div>
          </div>
        </div>
      </div>

      <GifPicker
        isOpen={showGifPicker}
        onClose={handleGifPickerClose}
        onSelectGif={handleGifSelect}
      />

      {/* Audio Recorder Modal */}
      {showAudioRecorder && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md">
            <AudioRecorder
              onAudioRecorded={onAudioRecorded}
              onCancel={onAudioCancel}
              maxDuration={300} // 5 minutes
              className="w-full"
            />
          </div>
        </div>,
        document.body
      )}

      {/* Toast Notification */}
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={showToast}
        onClose={hideToast}
      />
    </>
  );
}
