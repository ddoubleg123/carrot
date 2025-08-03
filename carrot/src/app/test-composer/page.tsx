"use client";
"use client";
import React, { useState } from "react";
import { IconPhoto, IconGif, IconEmoji, IconAudio, IconCarrot, IconLightning } from "./icons";

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
    <div className="min-h-screen bg-gray-100 flex flex-col items-center pt-20">
      <div className="relative w-full px-4 sm:px-6 lg:px-8 mx-auto">
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
              <button className="bg-transparent p-0" title="Photo"><IconPhoto /></button>
              <button className="bg-transparent p-0" title="GIF"><IconGif /></button>
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
