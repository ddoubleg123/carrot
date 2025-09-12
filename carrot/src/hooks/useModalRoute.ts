"use client";
import { useRouter, useSearchParams } from "next/navigation";

export function useModalRoute() {
  const router = useRouter();
  const params = useSearchParams();

  function openPostModal(postId: string) {
    const sp = new URLSearchParams(params?.toString() || '');
    sp.set('modal', '1');
    sp.set('post', postId);
    router.push(`?${sp.toString()}`, { scroll: false });
  }

  function closePostModal() {
    const sp = new URLSearchParams(params?.toString() || '');
    sp.delete('modal');
    sp.delete('post');
    const qs = sp.toString();
    router.replace(qs ? `?${qs}` : `?`, { scroll: false });
  }

  return { openPostModal, closePostModal };
}
