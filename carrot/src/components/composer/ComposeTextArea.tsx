import React from 'react';

interface ComposeTextAreaProps {
  value: string;
  onChange: (next: string) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
}

export default function ComposeTextArea({ value, onChange, textareaRef }: ComposeTextAreaProps) {
  return (
    <div className="mb-4">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What's happening?"
        className="w-full h-32 p-4 text-lg bg-white/50 border border-white/30 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent placeholder-gray-600"
        autoFocus
      />
    </div>
  );
}
