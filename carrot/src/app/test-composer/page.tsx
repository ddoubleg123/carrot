"use client";
"use client";
import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { IconPhoto, IconGif, IconEmoji, IconAudio, IconCarrot, IconLightning } from "./icons";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "../../components/ui/tooltip";
import { useMediaUpload } from "../(app)/dashboard/components/useMediaUpload";

// Dummy avatar and color wheel SVG
const ColorWheelIcon = (props: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    {...props}
    className="w-12 h-12 rounded-full border-4 border-white"
    style={{
      background: 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)',
      ...props.style,
    }}
  />
);

export default function TestComposerPage() {
  const [content, setContent] = useState("");
  // Media upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Modal ref for measuring size
  const modalRef = useRef<HTMLDivElement>(null);
  const [showModal, setShowModal] = useState(false);
  React.useEffect(() => {
    if (showModal && modalRef.current) {
      const { offsetWidth, offsetHeight } = modalRef.current;
      console.log('Modal rendered width:', offsetWidth, 'px');
      console.log('Modal rendered height:', offsetHeight, 'px');
    }
  }, [showModal]);
  const [mediaType, setMediaType] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [uploadedMedia, setUploadedMedia] = useState<string | null>(null);
  const { previewURL, handleSelect, removePreview, uploading, uploadProgress } = useMediaUpload();
  const router = useRouter();

  // When previewURL changes, update modal preview
  React.useEffect(() => {
    if (previewURL) setMediaPreview(previewURL);
  }, [previewURL]);

  // Open file dialog for image/video
  const openFileDialog = (accept: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  };

  // Handle file selection
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaType(file.type);
    setMediaFile(file);
    setShowModal(true);
    handleSelect(e); // triggers preview
    // Reset file input value so same file can be picked again
    e.target.value = "";
  };

  // Confirm upload
  const confirmUpload = async () => {
    setShowModal(false);
    // Assume useMediaUpload returns publicURL after upload (see hook)
    // For now, use previewURL as placeholder
    // Reset all composer state
    setMediaPreview(null);
    setMediaFile(null);
    setMediaType(null);
    setContent("");
    setUploadedMedia(null);
    removePreview();
    // Redirect to dashboard/feed
    router.push("/dashboard");
  };

  // Cancel upload
  const cancelUpload = () => {
    setShowModal(false);
    setMediaPreview(null);
    setMediaFile(null);
    setMediaType(null);
    removePreview();
  };

  const postButtonRef = React.useRef<HTMLButtonElement>(null);
  const actionRowRef = React.useRef<HTMLDivElement>(null);
  const bisRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [qaLeft, setQaLeft] = React.useState<number | null>(null);
  const [dynamicPaddingRight, setDynamicPaddingRight] = React.useState(64); // default buffer

  // Dynamically update paddingRight so text never goes under B/I/S stack
  React.useEffect(() => {
    function updatePadding() {
      if (textareaRef.current && bisRef.current) {
        const textareaRect = textareaRef.current.getBoundingClientRect();
        const bisRect = bisRef.current.getBoundingClientRect();
        const gap = Math.max(0, textareaRect.right - bisRect.left + 8); // 8px buffer
        setDynamicPaddingRight(gap);
      }
    }
    updatePadding();
    window.addEventListener('resize', updatePadding);
    return () => window.removeEventListener('resize', updatePadding);
  }, [qaLeft]);

  React.useEffect(() => {
    function updateQaLine() {
      if (postButtonRef.current && actionRowRef.current) {
        const btnRect = postButtonRef.current.getBoundingClientRect();
        const rowRect = actionRowRef.current.getBoundingClientRect();
        setQaLeft(btnRect.left - rowRect.left + btnRect.width / 2);
      }
    }
    updateQaLine();
    window.addEventListener('resize', updateQaLine);
    return () => window.removeEventListener('resize', updateQaLine);
  }, []);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-100 flex flex-col items-center pt-20">
      <div className="relative w-full px-4 sm:px-6 lg:px-8 mx-auto">

        {/* Upload Modal - Create Post UX */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
            {/* Modal Gradient Outer */}
            <div
              ref={modalRef}
              className="relative rounded-3xl border border-orange-100 shadow-2xl w-full max-w-sm sm:max-w-md md:max-w-xl pt-10 pb-4 mx-auto min-h-[420px] bg-gradient-to-br from-[#f7b5e6] via-[#fdf6b4] to-[#ffd6a7] animate-fadein"
              style={{ transition: 'box-shadow 0.3s, border 0.3s, background 0.3s' }}
            >
              {/* White Card Inner */}
              <div className="bg-white rounded-3xl w-full px-8 py-7 shadow-lg relative flex flex-col min-h-[340px] sm:min-h-[380px] md:min-h-[400px]" style={{ transition: 'box-shadow 0.3s, border-radius 0.3s, padding 0.3s' }}>
                {/* Close (X) button */}
                <button onClick={cancelUpload} className="absolute top-4 right-5 text-gray-400 hover:text-gray-600 text-2xl font-bold z-10" aria-label="Close">
                  &times;
                </button>
                {/* Modal Title */}
                <div className="text-center mb-2 pt-1">
                  <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Create Post</h2>
                </div>
                {/* Media Preview */}
                <div className="flex justify-center items-center mb-6">
                  {mediaPreview && mediaType?.startsWith('image/') && (
                    <img src={mediaPreview} alt="Preview" className="w-full max-w-xs sm:max-w-sm max-h-48 sm:max-h-60 rounded-xl border border-gray-100 shadow-sm object-contain" />
                  )}
                  {mediaPreview && mediaType?.startsWith('video/') && (
                    <video src={mediaPreview} controls className="w-full max-w-xs sm:max-w-sm max-h-48 sm:max-h-60 rounded-xl border border-gray-100 shadow-sm object-contain" />
                  )}
                </div>
                {/* Text Input */}
                <textarea
                  className="w-full bg-transparent border border-gray-200 rounded-xl p-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-200 resize-none mb-4 placeholder-gray-500"
                  rows={3}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="What's on your mind?"
                  autoFocus
                  style={{ minHeight: '56px', maxHeight: '160px' }}
                />
                {/* Actions */}
                <div className="flex justify-end gap-2 mt-4">
                  <button className="px-5 py-2 rounded-full bg-gray-100 hover:bg-gray-200 font-semibold text-gray-700 shadow transition-all duration-150" onClick={cancelUpload} disabled={uploading}>Cancel</button>
                  <button className="px-7 py-2 rounded-full bg-gradient-to-r from-[#2fd97c] to-[#1fcba1] text-white font-extrabold shadow-xl hover:from-[#27c46f] hover:to-[#1fa97c] transition-all duration-150" onClick={confirmUpload} disabled={uploading || !content.trim()}>Post</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hidden file input for uploads */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,.mp4,.mov,.webm"
          className="hidden"
          onChange={onFileChange}
        />

        {/* Uploaded media preview (should not show after post) */}
        {/* (intentionally left blank: preview is now handled only in modal, not above composer) */}

        {/* Composer gradient card */}
        <div className="bg-gradient-to-br from-[#e0eafe] via-[#f6e6fa] to-[#d1f7e6] rounded-2xl pt-8 pb-6 w-full relative flex flex-col items-stretch">

          {/* White input card */}
          <div className="relative bg-white pt-4 pb-2 w-full flex flex-col items-end" style={{ minHeight: 140 }}>


            {/* Avatar temporarily removed for spacing QA */}
            {/* QA vertical guide centered with Post button */}

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              className="w-full h-24 px-4 sm:px-6 lg:px-8 py-0 text-lg border-none bg-transparent focus:outline-none resize-none"
              style={{ paddingRight: dynamicPaddingRight }}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What's happening?"
            />
            {/* Absolutely positioned color wheel overlay */}
            {qaLeft !== null && (
              <ColorWheelIcon
                className="w-16 h-16"
                style={{
                  position: 'absolute',
                  left: qaLeft,
                  top: '-32px', // half of 64px height
                  transform: 'translateX(-50%)',
                  zIndex: 45
                }}
              />
            )}
            {/* Absolutely positioned B/I/S stack overlay */}
            {qaLeft !== null && (
              <div ref={bisRef} style={{ position: 'absolute', left: qaLeft, top: '50%', transform: 'translate(-50%, -50%)', zIndex: 40, pointerEvents: 'auto', width: 'max-content' }}>
                <div className="flex flex-col items-center" style={{ position: 'relative', zIndex: 42 }}>
                  <button type="button" title="Bold" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9999px', background: '#f3f4f6', border: 'none', marginBottom: 4 }} aria-label="Bold"><span style={{ fontWeight: 700, fontSize: 20 }}>B</span></button>
                  <button type="button" title="Italic" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9999px', background: '#f3f4f6', border: 'none', marginBottom: 4 }} aria-label="Italic"><span style={{ fontStyle: 'italic', fontSize: 20 }}>I</span></button>
                  <button type="button" title="Strikethrough" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9999px', background: '#f3f4f6', border: 'none', marginBottom: 8 }} aria-label="Strikethrough"><span style={{ textDecoration: 'line-through', fontSize: 20 }}>S</span></button>
                </div>
              </div>
            )}

            {/* Unified stack: color wheel, Post button */}
            {/* Unified stack: color wheel, B/I/S, Post button */}

          </div>
          {/* Action row */}
          <div ref={actionRowRef} className="flex items-center w-full px-4 sm:px-6 lg:px-8 mt-2 pt-2 pb-1 relative">

            <div className="flex gap-4 flex-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="bg-transparent p-0" onClick={() => openFileDialog("image/*,video/*,.mp4,.mov,.webm")}> <IconPhoto /></button>
                </TooltipTrigger>
                <TooltipContent>Add image/video</TooltipContent>
              </Tooltip>
              <button className="bg-transparent p-0" title="GIF" onClick={() => openFileDialog("image/*,video/*,.mp4,.mov,.webm")}> <IconGif /></button>
              <button className="bg-transparent p-0" title="Emoji"><IconEmoji /></button>
              <button className="bg-transparent p-0" title="Audio" aria-label="Audio"><IconAudio /></button>
              <button className="bg-transparent p-0" title="Commitment" aria-label="Commitment"><IconCarrot /></button>
              <button className="bg-transparent p-0" title="Lightning"><IconLightning /></button>
            </div>
            <button ref={postButtonRef} className="ml-auto bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-6 rounded-full shadow disabled:opacity-50" disabled={!content.trim()}>
              Post
            </button>
          </div>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
