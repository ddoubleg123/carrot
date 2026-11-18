export function youtubeIdFromText(text?: string | null): string | null {
  if (!text) return null
  const match = text.match(/(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
  return match?.[1] || null
}

export function youtubeEmbedSrc(id: string, autoplay: boolean): string {
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    mute: '1',
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    controls: '1',
    iv_load_policy: '3',
    enablejsapi: '1'
  })
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`
}
