'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { uploadFilesToFirebase } from '../../../../lib/uploadToFirebase';
import { IconPhoto, IconGif, IconEmoji, IconAudio, IconCarrot, IconLightning } from './icons';
import Toast from './Toast';
import GifPicker from './GifPicker';

interface CommitmentComposerProps {
  onPost?: (post: any) => void;
}

export default function CommitmentComposer({ onPost }: CommitmentComposerProps) {
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
  
  // GIF picker state
  const [showGifPicker, setShowGifPicker] = React.useState<boolean>(false);
  const [selectedGifUrl, setSelectedGifUrl] = React.useState<string | null>(null);
  
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
    
    // Pick a random index from available options
    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    
    setCurrentColorScheme(randomIndex);
    
    // Save to localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('carrot-color-scheme', randomIndex.toString());
    }
    
    console.log('🎨 Auto-selected random color scheme:', colorSchemes[randomIndex].name);
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

  // Background upload function - FIXED: Use presigned URL upload instead of Firebase SDK
  const uploadFileInBackground = async (file: File) => {
    if (!file) return;
    
    console.log('🚀 Starting background upload for:', file.name);
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);
      
      // FIXED: Use presigned URL upload (same as useMediaUpload.ts)
      console.log("Requesting presigned URL with type:", file.type);
      const presignedResp = await fetch("/api/getPresignedURL", {
        method: "POST",
        body: JSON.stringify({ type: file.type }),
      });
      if (!presignedResp.ok) throw new Error("Failed to get presigned URL");
      const { uploadURL, publicURL } = await presignedResp.json();

      // Upload directly to storage with correct headers
      console.log("Uploading with type:", file.type);
      const uploadResp = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadResp.ok) throw new Error("Upload failed");
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      setUploadedMedia(publicURL);
      console.log('✅ Background upload complete:', publicURL);
      
      // Show completion briefly
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 1500);
      
    } catch (error) {
      console.error('Background upload failed:', error);
      setIsUploading(false);
      setUploadProgress(0);
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

    // Start background upload
    uploadFileInBackground(file);
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
                            <div className="w-full h-80 bg-gray-100 flex items-center justify-center">
                              <div className="text-center">
                                <div className="text-4xl mb-4">📤</div>
                                <div className="text-lg text-gray-600 mb-4">Uploading video...</div>
                                {/* Upload Progress Bar */}
                                <div className="w-64 mx-auto">
                                  <div className="flex justify-between text-sm text-gray-500 mb-2">
                                    <span>Progress</span>
                                    <span>{Math.round(uploadProgress)}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-3">
                                    <div 
                                      className="bg-gradient-to-r from-orange-500 to-orange-600 h-3 rounded-full transition-all duration-300 ease-out"
                                      style={{ width: `${uploadProgress}%` }}
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : thumbnailsLoading ? (
                            <div className="w-full h-80 bg-gray-100 flex items-center justify-center">
                              <div className="text-center">
                                <div className="text-4xl mb-4">🎬</div>
                                <div className="text-lg text-gray-600">Extracting thumbnails...</div>
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
                    
                    let finalMediaUrl = null;
                    
                    // Upload media if we have a file
                    if (selectedFile) {
                      console.log('📤 Uploading media file...');
                      const uploadResult = await uploadFilesToFirebase([selectedFile], 'posts');
                      console.log('✅ Upload result:', uploadResult);
                      
                      if (uploadResult && uploadResult.length > 0) {
                        finalMediaUrl = uploadResult[0];
                        console.log('🔗 Final media URL:', finalMediaUrl);
                      }
                    }
                    
                    // Create optimistic UI post if we have user data
                    if (user && onPost) {
                      const newPost = {
                        id: Date.now().toString(),
                        content: content,
                        timestamp: new Date().toISOString(),
                        author: {
                          name: user.name || 'You',
                          username: user.username ? (user.username.startsWith('@') ? user.username : `@${user.username}`) : (user.name ? (user.name.startsWith('@') ? user.name.replace(/\s+/g, '').toLowerCase() : `@${user.name.replace(/\s+/g, '').toLowerCase()}`) : '@you'),
                          avatar: user.profilePhoto || user.image || null,
                          flag: '🇺🇸'
                        },
                        location: {
                          city: 'San Francisco',
                          state: 'CA'
                        },
                        likes: 0,
                        comments: 0,
                        shares: 0,
                        imageUrls: finalMediaUrl && !mediaType?.startsWith('video/') ? [finalMediaUrl] : [],
                        videoUrl: finalMediaUrl && mediaType?.startsWith('video/') ? finalMediaUrl : null,
                        gifUrl: null,
                        audioUrl: null,
                        emoji: '🎯',
                        colorScheme: colorSchemes[currentColorScheme].name,
                        // Add gradient color data for proper background display
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
                      console.log('🚀 Attempting to save post to database...');
                      console.log('📝 Post data:', {
                        content: content,
                        finalMediaUrl,
                        mediaType,
                        imageUrls: finalMediaUrl && !mediaType?.startsWith('video/') ? [finalMediaUrl] : [],
                        gifUrl: null,
                        audioUrl: null,
                        emoji: '🎯',
                        colorScheme: colorSchemes[currentColorScheme].name
                      });
                      
                      const response = await fetch('/api/posts', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          content: content,
                          gradientDirection: 'to-br',
                          gradientFromColor: colorSchemes[currentColorScheme].gradientFromColor,
                          gradientToColor: colorSchemes[currentColorScheme].gradientToColor,
                          gradientViaColor: colorSchemes[currentColorScheme].gradientViaColor,
                          imageUrls: finalMediaUrl && !mediaType?.startsWith('video/') ? [finalMediaUrl] : [],
                          videoUrl: finalMediaUrl && mediaType?.startsWith('video/') ? finalMediaUrl : null,
                          gifUrl: null,
                          audioUrl: null,
                          emoji: '🎯',
                          carrotText: '',
                          stickText: ''
                        }),
                      });
                      
                      console.log('📡 Response status:', response.status);
                      const responseData = await response.json();
                      console.log('📡 Response data:', responseData);
                      
                      if (!response.ok) {
                        console.error('❌ Failed to save post to database:', responseData);
                        console.error('❌ Error details:', responseData.details);
                        console.error('❌ Error name:', responseData.name);
                      } else {
                        console.log('✅ Post saved to database successfully');
                      }
                    } catch (dbError) {
                      console.error('❌ Database save error:', dbError);
                    }
                    
                    // Clear form and close modal
                    setContent('');
                    setSelectedFile(null);
                    setMediaPreview(null);
                    setMediaType(null);
                    cancelUpload();
                    
                    // Auto-select a random color scheme for next post
                    selectRandomColorScheme();
                    
                    // Show professional success toast
                    showSuccessToast('Post shared successfully!');
                    
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
                <button className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center text-xs font-bold transition-colors" title="Bold">
                  B
                </button>
                <button className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center text-xs font-italic transition-colors" title="Italic">
                  I
                </button>
                <button className="w-6 h-6 bg-gray-100 hover:bg-gray-200 rounded flex items-center justify-center text-xs underline transition-colors" title="Strikethrough">
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
                <button className="p-2 hover:bg-white/50 rounded-full transition-colors" title="Emoji">
                  <IconEmoji />
                </button>
                <button className="p-2 hover:bg-white/50 rounded-full transition-colors" title="Audio">
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
                  if (!content.trim()) return;
                  
                  // Debug: Log user session data
                  console.log('🔍 Session status:', status);
                  console.log('🔍 Full session object:', session);
                  console.log('🔍 User object:', user);
                  console.log('🔍 User name:', user?.name);
                  console.log('🔍 User username:', user?.username);
                  
                  // Safety check: Ensure we have user data
                  if (!user) {
                    console.warn('⚠️ No user data available for optimistic UI update - skipping optimistic UI');
                  }
                  if (status !== 'authenticated') {
                    console.warn('⚠️ Session status is not authenticated:', status);
                  }
                  
                  // Only do optimistic UI update if we have user data
                  if (user && onPost) {
                    // Create complete post object for optimistic UI update
                    const newPost = {
                      id: `temp-${Date.now()}`,
                      content: content,
                      carrotText: '',
                      stickText: '',
                      author: {
                        name: user.name || 'You',
                        username: user.username ? (user.username.startsWith('@') ? user.username : `@${user.username}`) : (user.name ? (user.name.startsWith('@') ? user.name.replace(/\s+/g, '').toLowerCase() : `@${user.name.replace(/\s+/g, '').toLowerCase()}`) : '@you'),
                        avatar: user.profilePhoto || user.image || null,
                        flag: '🇺🇸'
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
                      audioUrl: null,
                      emoji: '🎯',
                      colorScheme: colorSchemes[currentColorScheme].name
                    };
                    
                    // Add to UI immediately for responsive feel
                    onPost(newPost);
                  }
                
                  // Save to database in background
                  try {
                    const response = await fetch('/api/posts', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        content: content,
                        gradientDirection: 'to-br',
                        gradientFromColor: colorSchemes[currentColorScheme].gradientFromColor,
                        gradientToColor: colorSchemes[currentColorScheme].gradientToColor,
                        gradientViaColor: colorSchemes[currentColorScheme].gradientViaColor,
                        imageUrls: [],
                        gifUrl: selectedGifUrl,
                        audioUrl: null,
                        emoji: '🎯',
                        carrotText: '',
                        stickText: ''
                      }),
                    });
                    
                    if (!response.ok) {
                      console.error('Failed to save post to database');
                    } else {
                      console.log('Post saved to database successfully');
                    }
                  } catch (error) {
                    console.error('Error saving post:', error);
                  }
                  
                  // Clear content, selected GIF, and show success
                  setContent('');
                  setSelectedGifUrl(null);
                  
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

      {/* GIF Picker Modal */}
      <GifPicker
        isOpen={showGifPicker}
        onClose={handleGifPickerClose}
        onSelectGif={handleGifSelect}
      />
    </>
  );
}
