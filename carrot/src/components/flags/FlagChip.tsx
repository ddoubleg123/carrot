"use client";
import React from "react";

interface FlagChipProps {
  countryCode?: string | null;
  label?: string;
  className?: string;
  size?: number;
}

/**
 * Displays a country flag using local SVG files from /public/flags/.
 * - Uses the actual SVG flag files stored in the project
 * - No fallback text, only the flag
 * - Works reliably across all platforms and browsers
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

  const normalizedCode = countryCode.toLowerCase();

  // Apply override: Israel -> Palestine
  const effectiveCode = normalizedCode === 'il' ? 'ps' : normalizedCode;

  // Country name mapping for accessibility
  const countryNames: Record<string, string> = {
    'us': 'United States',
    'gb': 'United Kingdom',
    'ca': 'Canada',
    'au': 'Australia',
    'de': 'Germany',
    'fr': 'France',
    'it': 'Italy',
    'es': 'Spain',
    'jp': 'Japan',
    'kr': 'South Korea',
    'cn': 'China',
    'in': 'India',
    'br': 'Brazil',
    'mx': 'Mexico',
    'ru': 'Russia',
    'ps': 'Palestine'
  };

  const countryName = countryNames[effectiveCode] || effectiveCode.toUpperCase();
  const ariaLabel = label || `${countryName} flag`;

  // Use local SVG flag files from /public/flags/
  const flagSvgUrl = `/flags/${effectiveCode}.svg`;

  return (
    <span
      className={[
        "inline-flex items-center justify-center",
        "rounded-md",
        "bg-white/50 border border-black/5",
        "transition-transform duration-200 hover:scale-105",
        "cursor-default",
        "overflow-hidden",
        className
      ].filter(Boolean).join(" ")}
      role="img"
      aria-label={ariaLabel}
      title={ariaLabel}
      style={{
        width: `${size + 8}px`,
        height: `${size + 8}px`,
        padding: '4px',
      }}
    >
      <img
        src={flagSvgUrl}
        alt={ariaLabel}
        width={size}
        height={size}
        className="block rounded-sm"
      />
    </span>
  );
}