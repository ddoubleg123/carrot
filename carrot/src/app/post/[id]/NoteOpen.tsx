'use client'

import { useEffect } from 'react'

export default function NoteOpen({ postId }: { postId: string }) {
  useEffect(() => {
    fetch(`/api/posts/${postId}/open`, { method: 'POST' }).catch(() => void 0)
  }, [postId])
  return null
}
