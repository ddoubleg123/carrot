"use client";

import React, { useState, useRef } from "react";

import { IconPhoto, IconGif, IconEmoji, IconAudio, IconCarrot, IconLightning } from "./icons";
import Tooltip from "../ui/tooltip";
import ModalPortal from "./ModalPortal";
import { useRouter } from "next/navigation";
import { useMediaUpload } from "./useMediaUpload";
import { uploadFilesToFirebase } from 'src/lib/uploadToFirebase';

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

export default function CommitmentComposer() {
  const [content, setContent] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const modalRef = React.useRef<HTMLDivElement>(null);
  const [showModal, setShowModal] = React.useState(false);
  React.useEffect(() => {
    if (showModal && modalRef.current) {
      const { offsetWidth, offsetHeight } = modalRef.current;
      console.log('Modal rendered width:', offsetWidth, 'px');
      console.log('Modal rendered height:', offsetHeight, 'px');
    }
  }, [showModal]);
  const [mediaType, setMediaType] = React.useState<string | null>(null);
  const [mediaFile, setMediaFile] = React.useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = React.useState<string | null>(null);
  const [uploadedMedia, setUploadedMedia] = React.useState<string | null>(null);
  const { previewURL, handleSelect, removePreview, uploading, uploadProgress } = useMediaUpload();
  const router = useRouter();

  React.useEffect(() => {
    if (previewURL) setMediaPreview(previewURL);
  }, [previewURL]);

  const openFileDialog = (accept: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaType(file.type);
    setMediaFile(file);
    setShowModal(true);
    handleSelect(e);
    e.target.value = "";
  };

  const confirmUpload = async () => {
    setShowModal(false);
    setMediaPreview(null);
    setMediaFile(null);
    setMediaType(null);
    setContent("");
    setUploadedMedia(null);
    removePreview();
    router.push("/dashboard");
  };

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
  const [dynamicPaddingRight, setDynamicPaddingRight] = React.useState(64);

  React.useEffect(() => {
    function updatePadding() {
      if (textareaRef.current && bisRef.current) {
        const textareaRect = textareaRef.current.getBoundingClientRect();
        const bisRect = bisRef.current.getBoundingClientRect();
        const gap = Math.max(0, textareaRect.right - bisRect.left + 8);
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
      <div className="min-h-screen bg-gray-100 flex flex-col items-center pt-20">
      <div className="relative w-full px-4 sm:px-6 lg:px-8 mx-auto">
        {/* Upload Modal - Create Post UX */}
        {showModal && (
          <ModalPortal>
            <div className="fixed inset-0 z-[1100] flex justify-center items-center bg-black bg-opacity-40">
              {/* DIAGNOSTIC: Render CommitmentComposerTest wrapper here */}
              <div className="max-w-md mx-auto border-2 border-red-500 mt-10 p-2 bg-white z-[1200]">
                <div className="rounded-3xl bg-gradient-to-br from-[#f7b5e6] via-[#fdf6b4] to-[#ffd6a7] shadow-xl flex items-center justify-center" style={{ height: 200 }}>
  <div className="bg-white rounded-2xl shadow-md px-6 py-5 h-[140px] relative flex flex-col items-center justify-center overflow-hidden">
  <button
    onClick={cancelUpload}
    className="absolute top-4 right-5 text-gray-400 hover:text-gray-600 text-2xl font-bold z-10"
    aria-label="Close"
    style={{ lineHeight: 1 }}
  >
    &times;
  </button>
  <div className="text-center mb-2 pt-1 w-full">
    <h2 className="text-lg font-semibold text-gray-900 tracking-tight">Create Post</h2>
  </div>
  {/* Media preview */}
  <div className="flex justify-center items-center mb-4">
    {mediaPreview ? (
      <img
        src={mediaPreview}
        alt="Preview"
        className="rounded-md max-w-full h-auto"
        style={{ maxHeight: 400 }}
      />
    ) : (
      <div className="bg-gray-200 rounded-md" style={{ width: 320, height: 180 }} />
    )}
  </div>
      {/* Textarea and formatting icons */}
      <div className="px-4 sm:px-6 lg:px-8 pb-2 w-full">
        <textarea
          ref={textareaRef}
          className="w-full h-24 px-4 py-2 text-lg border-none bg-transparent focus:outline-none resize-none rounded-md"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's happening?"
        />
        {/* Formatting icons (B/I/S) */}
        <div className="flex items-center gap-2 mt-2">
          <Tooltip content="Bold">
            <button type="button" title="Bold" className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100" aria-label="Bold"><span style={{ fontWeight: 700, fontSize: 18 }}>B</span></button>
          </Tooltip>
          <Tooltip content="Italic">
            <button type="button" title="Italic" className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100" aria-label="Italic"><span style={{ fontStyle: 'italic', fontSize: 18 }}>I</span></button>
          </Tooltip>
          <Tooltip content="Strikethrough">
            <button type="button" title="Strikethrough" className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100" aria-label="Strikethrough"><span style={{ textDecoration: 'line-through', fontSize: 18 }}>S</span></button>
          </Tooltip>
        </div>
      </div>
      {/* Action row */}
      <div className="flex items-center w-full px-4 sm:px-6 lg:px-8 mt-2 pt-2 pb-1">
        <div className="flex gap-4 flex-1">
          <Tooltip content="Add image/video">
            <button className="bg-transparent p-0" onClick={() => openFileDialog("image/*,video/*,.mp4,.mov,.webm")}> <IconPhoto /></button>
          </Tooltip>
          <button className="bg-transparent p-0" title="GIF" onClick={() => openFileDialog("image/*,video/*,.mp4,.mov,.webm")}> <IconGif /></button>
          <button className="bg-transparent p-0" title="Emoji"><IconEmoji /></button>
          <button className="bg-transparent p-0" title="Audio" aria-label="Audio"><IconAudio /></button>
          <button className="bg-transparent p-0" title="Commitment" aria-label="Commitment"><IconCarrot /></button>
          <button className="bg-transparent p-0" title="Lightning"><IconLightning /></button>
        </div>
        <button
          className="ml-4 px-6 py-2 bg-primary text-white rounded-full font-semibold text-base shadow-md hover:bg-primary-dark transition disabled:opacity-50"
          disabled={!content.trim()}
          onClick={() => {}}
        >
          Post
        </button>
      </div>
    </div>
  </div>
</div>
</div>
        </ModalPortal>
      )}
        {/* Hidden file input for uploads */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,.mp4,.mov,.webm"
          className="hidden"
          onChange={onFileChange}
        />
        {/* Composer gradient card */}
        <div className="bg-gradient-to-br from-[#e0eafe] via-[#f6e6fa] to-[#d1f7e6] rounded-2xl pt-8 pb-6 w-full relative flex flex-col items-stretch">
          {/* White input card */}
          <div className="relative bg-white pt-4 pb-2 w-full flex flex-col items-end" style={{ minHeight: 140 }}>
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
                  top: '-32px',
                  transform: 'translateX(-50%)',
                  zIndex: 45
                }}
              />
            )}
            {/* Absolutely positioned B/I/S stack overlay */}
            {qaLeft !== null && (
              <div
                ref={bisRef}
                style={{
                  position: 'absolute',
                  left: qaLeft,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 40,
                  pointerEvents: 'auto',
                  width: 'max-content'
                }}
              >
                <div className="flex flex-col items-center" style={{ position: 'relative', zIndex: 42 }}>
                  <Tooltip content="Bold">
                    <button type="button" title="Bold" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9999px', background: '#f3f4f6', border: 'none', marginBottom: 4 }} aria-label="Bold"><span style={{ fontWeight: 700, fontSize: 20 }}>B</span></button>
                  </Tooltip>
                  <Tooltip content="Italic">
                    <button type="button" title="Italic" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9999px', background: '#f3f4f6', border: 'none', marginBottom: 4 }} aria-label="Italic"><span style={{ fontStyle: 'italic', fontSize: 20 }}>I</span></button>
                  </Tooltip>
                  <Tooltip content="Strikethrough">
                    <button type="button" title="Strikethrough" style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '9999px', background: '#f3f4f6', border: 'none', marginBottom: 8 }} aria-label="Strikethrough"><span style={{ textDecoration: 'line-through', fontSize: 20 }}>S</span></button>
                  </Tooltip>
                </div>
              </div>
            )}
          </div>
          {/* Action row */}
          <div ref={actionRowRef} className="flex items-center w-full px-4 sm:px-6 lg:px-8 mt-2 pt-2 pb-1 relative">
            <div className="flex gap-4 flex-1">
              <Tooltip content="Add image/video">
                <button className="bg-transparent p-0" onClick={() => openFileDialog("image/*,video/*,.mp4,.mov,.webm")}> <IconPhoto /></button>
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
  );
}