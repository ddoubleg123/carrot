'use client';
import React from 'react';

// This is the EXACT working logic from CustomPhoneInput
const getFlagEmoji = (code?: string) => {
  if (!code) return '';
  const trimmed = code.trim().toLowerCase();
  
  // Apply override: Israel -> Palestine
  const effectiveCode = trimmed === 'il' ? 'ps' : trimmed;
  
  if (effectiveCode.length !== 2) return '';
  const base = 0x1F1E6 - 65; // Regional indicator base
  const first = base + (effectiveCode.charCodeAt(0) - 97);
  const second = base + (effectiveCode.charCodeAt(1) - 97);
  return String.fromCodePoint(first) + String.fromCodePoint(second);
};

interface SimpleFlagChipProps {
  countryCode?: string | null;
  label?: string;
  className?: string;
}

export default function SimpleFlagChip({ 
  countryCode, 
  label, 
  className 
}: SimpleFlagChipProps) {
  const flagEmoji = getFlagEmoji(countryCode || '');
  
  if (!countryCode || !flagEmoji) {
    return null;
  }
  
  return (
    <span
      className={[
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#F7F8FA] border border-black/5 text-gray-800",
        className
      ].filter(Boolean).join(" ")}
      aria-label={label || `Home country: ${countryCode}`}
      title={label || `Home country: ${countryCode}`}
    >
      <span 
        style={{ 
          fontSize: '16px', 
          lineHeight: 1,
          display: 'inline-block'
        }} 
        aria-hidden
      >
        {flagEmoji}
      </span>
    </span>
  );
}
