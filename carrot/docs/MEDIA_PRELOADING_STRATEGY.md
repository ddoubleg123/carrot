# Media Preloading Strategy

## Overview
The media preloading system ensures smooth user experience by downloading content in advance while respecting bandwidth and performance constraints.

## Preloading Rules

### Post 1 (Current/Focus Post)
- **Videos**: Full download (`VIDEO_FULL`)
- **Images**: Full download (`IMAGE`)
- **Text**: Full download (`TEXT_FULL`)
- **Audio**: Shell only (`AUDIO_META`) - gradient/metadata, no actual audio file

### Post 2+ (Next 10 Posts)
- **Videos**: 6-second preroll (`VIDEO_PREROLL_6S`)
- **Images**: Full download (`IMAGE`)
- **Text**: Full download (`TEXT_FULL`)
- **Audio**: Shell only (`AUDIO_META`) - gradient/metadata, no actual audio file

## Media Type Behavior

### Videos
- **Current post**: Downloads full video for immediate playback
- **Other posts**: Downloads first 6 seconds for smooth scrolling
- **On-demand**: Full video downloads when user scrolls to post

### Images
- **All posts**: Full download (images are typically small)
- **Purpose**: Immediate display when scrolled into view

### Text Posts
- **All posts**: Full download (text content + gradients)
- **Purpose**: Immediate display when scrolled into view

### Audio Posts
- **All posts**: Shell only (`AUDIO_META`)
- **What's downloaded**: Gradient, metadata, visual shell
- **What's NOT downloaded**: Actual audio file
- **On-demand**: Audio file downloads only when user clicks play button
- **Purpose**: Shows visual shell immediately, audio loads on interaction

## Concurrency Limits

```typescript
{
  POSTER: 6,           // Thumbnails
  VIDEO_PREROLL_6S: 2, // 6-second video segments
  VIDEO_FULL: 1,       // Full videos (current post only)
  IMAGE: 4,            // Images
  AUDIO_META: 3,       // Audio shells
  TEXT_FULL: 4,        // Text content
  AUDIO_FULL: 2        // Full audio (on-demand only)
}
```

## Key Principles

1. **Aggressive Preloading**: Post 2+ start downloading immediately, don't wait for Post 1
2. **Smart Prioritization**: Current post gets full content, others get optimized versions
3. **Bandwidth Efficiency**: Videos get 6-second prerolls, audio gets shells only
4. **On-Demand Loading**: Full audio/video downloads only when user interacts
5. **Parallel Processing**: Multiple downloads happen simultaneously

## Implementation Details

- **Sequential Blocking**: Disabled (`videoBlocksProgression: false`)
- **Preload Range**: Next 10 posts + previous 5 posts
- **Budget Management**: 8MB global budget with size estimates
- **Task Dependencies**: Minimal dependencies for maximum parallelism

## User Experience

- **Smooth Scrolling**: Preloaded content appears instantly
- **Fast Playback**: Videos start immediately when scrolled into view
- **Visual Feedback**: Audio posts show gradient shells immediately
- **Bandwidth Friendly**: Only downloads what's needed, when it's needed
