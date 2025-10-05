"use client";
import { useRouter, useSearchParams } from "next/navigation";

export function useModalRoute() {
  const router = useRouter();
  const params = useSearchParams();

  function openPostModal(postId: string, panel?: 'transcript' | 'translate' | 'comments') {
    const sp = new URLSearchParams(params?.toString() || '');
    sp.set('modal', '1');
    sp.set('post', postId);
    if (panel) sp.set('panel', panel);
    // Use replace instead of push for instant modal opening
    router.replace(`?${sp.toString()}`, { scroll: false });
  }

  function closePostModal() {
    const sp = new URLSearchParams(params?.toString() || '');
    sp.delete('modal');
    sp.delete('post');
    sp.delete('panel');
    const qs = sp.toString();
    router.replace(qs ? `?${qs}` : `?`, { scroll: false });
  }

  return { openPostModal, closePostModal };
}
