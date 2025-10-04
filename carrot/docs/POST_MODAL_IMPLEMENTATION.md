# PostModal Implementation Guide

## Overview

This guide covers the complete implementation of the PostModal system that provides fullscreen video viewing with comments, maintaining video playback state without reloading.

## 🎯 **Key Features**

- **Video Reuse**: Existing video elements are moved to modal without reloading
- **Responsive Design**: Desktop (70/30 split) and mobile (stacked) layouts
- **Comments Integration**: Live comments in right rail (desktop) or below (mobile)
- **Accessibility**: ESC key, focus trapping, ARIA roles
- **Picture-in-Picture Behavior**: Video maintains playback state

## 📁 **File Structure**

```
src/
├── components/
│   ├── post-modal/
│   │   └── PostModal.tsx           # Main modal component
│   ├── video/
│   │   └── ReusableVideoPlayer.tsx # Video player with refs
│   └── feed/
│       └── PostCardWithModal.tsx   # Example integration
├── hooks/
│   └── usePostModal.ts             # Modal state management
└── app/api/comments/
    └── route.ts                    # Comments API endpoint
```

## 🚀 **Quick Start**

### 1. **Install Dependencies**
```bash
npm install lucide-react
```

### 2. **Add to Your PostCard Component**
```tsx
import { usePostModal } from '@/hooks/usePostModal';
import PostModal from '@/components/post-modal/PostModal';
import ReusableVideoPlayer, { ReusableVideoPlayerRef } from '@/components/video/ReusableVideoPlayer';

function YourPostCard({ post }) {
  const videoPlayerRef = useRef<ReusableVideoPlayerRef>(null);
  const { isOpen, currentPost, videoElement, isVideo, openModal, closeModal } = usePostModal();

  const handleFullscreenClick = () => {
    const videoEl = videoPlayerRef.current?.getVideoElement() || null;
    openModal(post, videoEl);
  };

  const handleCommentsClick = () => {
    const videoEl = post.mediaType === 'video' ? videoPlayerRef.current?.getVideoElement() || null : null;
    openModal(post, videoEl);
  };

  return (
    <>
      {/* Your existing post content */}
      {post.mediaType === 'video' && (
        <ReusableVideoPlayer
          ref={videoPlayerRef}
          src={post.mediaUrl}
          className="w-full aspect-video"
        />
      )}
      
      {/* Action bar with fullscreen and comments buttons */}
      <div className="flex items-center gap-4">
        <Button onClick={handleFullscreenClick}>
          <Maximize2 size={16} />
        </Button>
        <Button onClick={handleCommentsClick}>
          <MessageCircle size={16} />
        </Button>
      </div>

      {/* Modal */}
      {currentPost && (
        <PostModal
          isOpen={isOpen}
          onClose={closeModal}
          post={currentPost}
          videoElement={videoElement}
          isVideo={isVideo}
        />
      )}
    </>
  );
}
```

## 🎨 **Component Details**

### **PostModal Component**

#### **Props**
```typescript
interface PostModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: Post;
  videoElement?: HTMLVideoElement | null;
  isVideo?: boolean;
}
```

#### **Features**
- **Responsive Layout**: Desktop grid (70/30) vs mobile stack
- **Video Reuse**: Moves existing video element without reload
- **Comments**: Fetches and displays comments with real-time updates
- **Accessibility**: ESC key, focus trapping, ARIA roles
- **Portal Rendering**: Renders outside component tree

### **usePostModal Hook**

#### **Return Values**
```typescript
interface UsePostModalReturn {
  isOpen: boolean;
  currentPost: Post | null;
  videoElement: HTMLVideoElement | null;
  isVideo: boolean;
  openModal: (post: Post, videoElement?: HTMLVideoElement | null) => void;
  closeModal: () => void;
  setVideoElement: (element: HTMLVideoElement | null) => void;
}
```

#### **Video State Management**
- Stores original video position and state
- Preserves currentTime, volume, playback state
- Restores video to original position on close

### **ReusableVideoPlayer Component**

#### **Ref Methods**
```typescript
interface ReusableVideoPlayerRef {
  play: () => Promise<void>;
  pause: () => void;
  getCurrentTime: () => number;
  setCurrentTime: (time: number) => void;
  getDuration: () => number;
  getVolume: () => number;
  setVolume: (volume: number) => void;
  getMuted: () => boolean;
  setMuted: (muted: boolean) => void;
  getPaused: () => boolean;
  getVideoElement: () => HTMLVideoElement | null;
}
```

## 🎯 **Usage Examples**

### **Basic Video Post**
```tsx
<ReusableVideoPlayer
  ref={videoPlayerRef}
  src="https://example.com/video.mp4"
  poster="https://example.com/thumbnail.jpg"
  className="w-full aspect-video"
  controls={true}
  autoPlay={false}
  muted={true}
/>
```

### **Image Post**
```tsx
<img
  src={post.mediaUrl}
  alt="Post content"
  className="w-full h-auto object-cover"
/>
```

### **Action Bar Integration**
```tsx
<div className="flex items-center justify-between p-4">
  <div className="flex items-center gap-4">
    <Button onClick={handleLike}>
      <Heart size={20} />
    </Button>
    <Button onClick={handleCommentsClick}>
      <MessageCircle size={20} />
    </Button>
    <Button onClick={handleShare}>
      <Share2 size={20} />
    </Button>
  </div>
  
  {post.mediaType === 'video' && (
    <Button onClick={handleFullscreenClick}>
      <Maximize2 size={20} />
    </Button>
  )}
</div>
```

## 📱 **Responsive Behavior**

### **Desktop Layout**
- **Video Area**: ~70% width, full height
- **Comments Rail**: ~30% width, fixed position
- **Grid Layout**: `grid-cols-[1fr_320px]`

### **Mobile Layout**
- **Video**: Pinned at top, full width
- **Comments**: Scrollable below video
- **Stack Layout**: `flex-col`

## 🔧 **API Integration**

### **Comments Endpoint**
```typescript
// GET /api/comments?postId=xxx
const response = await fetch(`/api/comments?postId=${postId}`);
const { comments } = await response.json();

// POST /api/comments
const response = await fetch('/api/comments', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ postId, content: 'New comment' }),
});
```

### **Comment Structure**
```typescript
interface Comment {
  id: string;
  content: string;
  author: {
    id: string;
    name: string;
    avatar?: string;
  };
  createdAt: string;
  likes: number;
  isLiked: boolean;
}
```

## ♿ **Accessibility Features**

### **Keyboard Navigation**
- **ESC Key**: Closes modal
- **Tab Navigation**: Focus trapping within modal
- **Enter/Space**: Activates buttons

### **ARIA Roles**
```tsx
<div role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <h2 id="modal-title">Post by {post.author.name}</h2>
</div>
```

### **Screen Reader Support**
- Modal announcements
- Video controls labeling
- Comment form accessibility

## 🎨 **Styling Customization**

### **Modal Container**
```css
.modal-container {
  @apply fixed inset-0 z-50 flex items-center justify-center;
}

.modal-backdrop {
  @apply absolute inset-0 bg-black/80 backdrop-blur-sm;
}

.modal-content {
  @apply relative w-full h-full max-w-7xl max-h-[95vh] bg-white rounded-2xl shadow-2xl;
}
```

### **Responsive Breakpoints**
```css
/* Desktop */
@media (min-width: 1024px) {
  .modal-layout {
    @apply grid grid-cols-[1fr_320px];
  }
}

/* Mobile */
@media (max-width: 1023px) {
  .modal-layout {
    @apply flex flex-col;
  }
}
```

## 🚀 **Performance Optimizations**

### **Video Element Reuse**
- No video reloading or buffering
- Preserves playback state
- Maintains network connections

### **Comments Loading**
- Lazy loading on modal open
- Pagination for large comment lists
- Optimistic updates for new comments

### **Portal Rendering**
- Renders outside component tree
- Prevents layout shifts
- Better performance isolation

## 🐛 **Troubleshooting**

### **Video Not Playing in Modal**
```tsx
// Ensure video element is properly passed
const videoEl = videoPlayerRef.current?.getVideoElement();
if (videoEl) {
  openModal(post, videoEl);
}
```

### **Comments Not Loading**
```tsx
// Check API endpoint and authentication
const response = await fetch(`/api/comments?postId=${postId}`);
if (!response.ok) {
  console.error('Failed to fetch comments:', response.status);
}
```

### **Modal Not Closing**
```tsx
// Ensure onClose is properly bound
<PostModal
  isOpen={isOpen}
  onClose={() => closeModal()} // Not just closeModal
  post={currentPost}
/>
```

## 📊 **Browser Support**

- **Chrome**: Full support
- **Firefox**: Full support
- **Safari**: Full support
- **Edge**: Full support
- **Mobile**: iOS Safari, Chrome Mobile

## 🔄 **Future Enhancements**

- **Video Controls**: Custom video controls in modal
- **Comment Threading**: Nested comment replies
- **Real-time Updates**: WebSocket for live comments
- **Keyboard Shortcuts**: Space for play/pause, arrow keys for seeking
- **Picture-in-Picture**: Native PiP support
- **Analytics**: Track modal usage and engagement

This implementation provides a complete, production-ready PostModal system with video reuse, responsive design, and accessibility features.
