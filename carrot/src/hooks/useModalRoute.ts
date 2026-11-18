"use client";
import { setOpenModal } from "../components/post-modal/postModalStore";

function writeUrl(mutate: (sp: URLSearchParams) => void) {
  const sp = new URLSearchParams(window.location.search);
  mutate(sp);
  const qs = sp.toString();
  const next = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
  // Updates the address bar without a server render. router.replace() refetches
  // the whole page (about a second) before the modal can paint.
  window.history.replaceState(window.history.state, '', next);
}

export function useModalRoute() {
  function openPostModal(postId: string, panel?: 'transcript' | 'translate' | 'comments') {
    setOpenModal({ postId, panel: panel ?? null });
    writeUrl((sp) => {
      sp.set('modal', '1');
      sp.set('post', postId);
      if (panel) sp.set('panel', panel);
      else sp.delete('panel');
    });
  }

  function closePostModal() {
    // Clear the address before the store update. The redraw reads the address
    // bar, and doing this afterward left the post on screen.
    writeUrl((sp) => {
      sp.delete('modal');
      sp.delete('post');
      sp.delete('panel');
    });
    setOpenModal(null);
  }

  return { openPostModal, closePostModal };
}
