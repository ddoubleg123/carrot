"use client";
import React from "react";
import { useSearchParams } from "next/navigation";
import PostModal from "./PostModal";
import { useModalRoute } from "../../hooks/useModalRoute";

export default function PostModalController() {
  const params = useSearchParams();
  const { closePostModal } = useModalRoute();
  const show = params?.get('modal') === '1';
  const postId = params?.get('post') || '';

  if (!show || !postId) return null;
  return <PostModal id={postId} onClose={closePostModal} />;
}
