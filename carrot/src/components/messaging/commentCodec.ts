import { uploadFileToFirebase } from '@/lib/uploadToFirebase';

export type MediaKind = 'image' | 'video' | 'audio' | 'gif';

export type CommentMedia = {
  kind: MediaKind;
  url: string;
};

export function encodeComment(text: string, media?: CommentMedia, transcript?: string, parentId?: string) {
  const trimmed = text.trim();
  if (!media?.url && !parentId) return trimmed;
  return JSON.stringify({
    carrot: 1,
    text: trimmed,
    media,
    transcript: transcript || undefined,
    parentId: parentId || undefined,
  });
}

export function decodeComment(content: string): { text: string; media?: CommentMedia; transcript?: string; parentId?: string } {
  if (!content.startsWith('{"carrot":')) return { text: content };
  try {
    const parsed = JSON.parse(content) as { carrot?: number; text?: string; media?: CommentMedia; transcript?: string; parentId?: string };
    if (parsed.carrot === 1) {
      const media = parsed.media?.url && parsed.media.kind ? parsed.media : undefined;
      return {
        text: parsed.text || '',
        media,
        transcript: typeof parsed.transcript === 'string' ? parsed.transcript : undefined,
        parentId: typeof parsed.parentId === 'string' ? parsed.parentId : undefined,
      };
    }
  } catch {
    // Older comments are plain text.
  }
  return { text: content };
}

export async function publishComment(
  postId: string,
  text: string,
  attachment?: { kind: MediaKind; file?: File; url?: string },
  parentId?: string
) {
  let media: CommentMedia | undefined;
  if (attachment?.file) {
    const safeName = (attachment.file.name || 'attachment').replace(/[^\w.-]+/g, '_');
    const url = await uploadFileToFirebase(attachment.file, `comments/${postId}/${Date.now()}_${safeName}`);
    media = { kind: attachment.kind, url };
  } else if (attachment?.url) {
    media = { kind: attachment.kind, url: attachment.url };
  }

  const content = encodeComment(text, media, undefined, parentId);
  if (!content) throw new Error('Write a reply or add a photo, video, GIF, or voice message.');

  const response = await fetch('/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postId, content }),
  });
  if (!response.ok) {
    const failed = await response.json().catch(() => null);
    throw new Error(typeof failed?.error === 'string' ? failed.error : 'Could not post that reply.');
  }
  return response.json();
}
