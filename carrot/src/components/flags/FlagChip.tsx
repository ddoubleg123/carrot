"use client";
import React from "react";

function countryToEmoji(code?: string | null): string | null {
  if (!code) return null;
  let cc = code.trim().toUpperCase();
  // Business rule: replace Israel (IL) with Palestinian flag (PS)
  if (cc === 'IL') cc = 'PS';
  if (!/^[A-Z]{2}$/.test(cc)) return null;
  const A = 0x1F1E6;
  const a = 65; // 'A'
  const chars = [cc.charCodeAt(0) - a + A, cc.charCodeAt(1) - a + A];
  return String.fromCodePoint(chars[0], chars[1]);
}

export default function FlagChip({ countryCode, label, className }: { countryCode?: string | null; label?: string; className?: string }) {
  const emoji = countryToEmoji(countryCode);
  if (!emoji) return null;
  return (
    <span
      className={["inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#F7F8FA] border border-black/5", className]
        .filter(Boolean)
        .join(" ")}
      aria-label={label || `Home country: ${countryCode}`}
      title={label || `Home country: ${countryCode}`}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden>
        {emoji}
      </span>
    </span>
  );
}
