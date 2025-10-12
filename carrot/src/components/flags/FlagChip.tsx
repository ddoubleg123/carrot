"use client";
import React from "react";

interface FlagChipProps {
  countryCode?: string | null;
  label?: string;
  className?: string;
  size?: number;
}

/**
 * Displays a country flag using Unicode flag emojis.
 * - Ensures correct sizing (default 36px).
 * - No fallback text, only the flag.
 * - Works reliably across all platforms.
 */
export default function FlagChip({
  countryCode,
  label,
  className,
  size = 36
}: FlagChipProps) {
  if (!countryCode) {
    return null;
  }

  const normalizedCode = countryCode.toUpperCase();

  // Apply override: Israel -> Palestine
  const effectiveCode = normalizedCode === 'IL' ? 'PS' : normalizedCode;

  // Convert ISO country code to flag emoji
  const getFlagEmoji = (code: string): string => {
    const codePoints = code
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  // Country name mapping for accessibility
  const countryNames: Record<string, string> = {
    'US': 'United States',
    'GB': 'United Kingdom',
    'CA': 'Canada',
    'AU': 'Australia',
    'DE': 'Germany',
    'FR': 'France',
    'IT': 'Italy',
    'ES': 'Spain',
    'JP': 'Japan',
    'KR': 'South Korea',
    'CN': 'China',
    'IN': 'India',
    'BR': 'Brazil',
    'MX': 'Mexico',
    'RU': 'Russia',
    'PS': 'Palestine'
  };

  const countryName = countryNames[effectiveCode] || effectiveCode;
  const flagEmoji = getFlagEmoji(effectiveCode);
  const ariaLabel = label || `${countryName} flag`;

  return (
    <span
      className={[
        "inline-flex items-center justify-center",
        "rounded-md",
        "bg-white/50 border border-black/5",
        "transition-transform duration-200 hover:scale-105",
        "cursor-default",
        className
      ].filter(Boolean).join(" ")}
      role="img"
      aria-label={ariaLabel}
      title={ariaLabel}
      style={{
        width: `${size + 8}px`,
        height: `${size + 8}px`,
        padding: '4px',
        fontSize: `${size}px`,
        lineHeight: '1',
        fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif'
      }}
    >
      {flagEmoji}
    </span>
  );
}