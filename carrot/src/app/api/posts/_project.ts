import type { Prisma } from '@prisma/client';

// Shape the DB row into a consistent Post DTO for the client/feed
// This projector should be the single source of truth for all post responses.
export function projectPost(row: any) {
  if (!row) return null;

  const user = row.User || {};
  // Stats with safe defaults (until DB defaults are enforced)
  const stats = {
    likes: typeof row.likes === 'number' ? row.likes : 0,
    comments: typeof row.comments === 'number' ? row.comments : 0,
    reposts: typeof row.reposts === 'number' ? row.reposts : 0,
    views: typeof row.views === 'number' ? row.views : 0,
  };

  // Pass-through media fields; client will route via /api/video when needed
  const out: any = {
    id: row.id,
    userId: row.userId,
    content: row.content || '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,

    // Media
    imageUrls: row.imageUrls || null,
    gifUrl: row.gifUrl || null,
    videoUrl: row.videoUrl || null,
    videoBucket: (row as any).videoBucket || null,
    videoPath: (row as any).videoPath || null,
    thumbnailUrl: row.thumbnailUrl || null,
    audioUrl: row.audioUrl || null,

    // Transcription/captions
    audioTranscription: row.audioTranscription || null,
    transcriptionStatus: row.transcriptionStatus || null,
    captionVttUrl: (row as any).captionVttUrl || null,
    storyboardVttUrl: (row as any).storyboardVttUrl || null,

    // Cloudflare Stream
    cfUid: (row as any).cfUid || (row as any).cf_uid || null,
    cfPlaybackUrlHls: (row as any).cfPlaybackUrlHls || (row as any).cf_playback_url_hls || null,

    // Visuals
    emoji: row.emoji || '🎯',
    gradientDirection: (row as any).gradientDirection || null,
    gradientFromColor: (row as any).gradientFromColor || null,
    gradientViaColor: (row as any).gradientViaColor || null,
    gradientToColor: (row as any).gradientToColor || null,

    // Stats (materialized defaults)
    ...stats,

    // User projection
    User: {
      id: user.id,
      username: user.username || null,
      profilePhoto: user.profilePhoto || user.image || null,
      profilePhotoPath: (user as any)?.profilePhotoPath || null,
      country: (user as any)?.country || null,
      image: user.image || null,
    },
  };
  // For backward-compat consumers, mirror country at top-level homeCountry
  (out as any).homeCountry = (user as any)?.country || null;
  return out;
}
