"use client";
import React from "react";

const NAME_TO_ISO2: Record<string, string> = {
  // Common names to ISO-2
  "UNITED STATES": "US",
  "USA": "US",
  "U.S.": "US",
  "U.S": "US",
  "UNITED STATES OF AMERICA": "US",
  "UNITED KINGDOM": "GB",
  "UK": "GB",
  "GREAT BRITAIN": "GB",
  "ENGLAND": "GB",
  "SCOTLAND": "GB",
  "WALES": "GB",
  "N. IRELAND": "GB",
  "NORTHERN IRELAND": "GB",
  "PALESTINE": "PS",
  "ISRAEL": "IL",
  "CANADA": "CA",
  "MEXICO": "MX",
  "FRANCE": "FR",
  "GERMANY": "DE",
  "SPAIN": "ES",
  "PORTUGAL": "PT",
  "BRAZIL": "BR",
  "INDIA": "IN",
  "CHINA": "CN",
  "JAPAN": "JP",
  "SOUTH KOREA": "KR",
  "KOREA": "KR",
  "RUSSIA": "RU",
  "UKRAINE": "UA",
  "TURKEY": "TR",
  "UAE": "AE",
  "UNITED ARAB EMIRATES": "AE",
};

// Alpha-3 to Alpha-2 for common codes
const A3_TO_A2: Record<string, string> = {
  USA: 'US', GBR: 'GB', CAN: 'CA', MEX: 'MX', FRA: 'FR', DEU: 'DE', ESP: 'ES', PRT: 'PT',
  BRA: 'BR', IND: 'IN', CHN: 'CN', JPN: 'JP', KOR: 'KR', RUS: 'RU', UKR: 'UA', TUR: 'TR',
  ARE: 'AE', ISR: 'IL', PSE: 'PS'
};

// Country code to name mapping for accessibility
const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', GB: 'United Kingdom', CA: 'Canada', MX: 'Mexico',
  FR: 'France', DE: 'Germany', ES: 'Spain', PT: 'Portugal', BR: 'Brazil',
  IN: 'India', CN: 'China', JP: 'Japan', KR: 'South Korea', RU: 'Russia',
  UA: 'Ukraine', TR: 'Turkey', AE: 'United Arab Emirates', IL: 'Israel',
  PS: 'Palestine', AU: 'Australia', IT: 'Italy', NL: 'Netherlands',
  SE: 'Sweden', NO: 'Norway', DK: 'Denmark', FI: 'Finland', PL: 'Poland',
  CZ: 'Czech Republic', HU: 'Hungary', AT: 'Austria', CH: 'Switzerland',
  BE: 'Belgium', IE: 'Ireland', GR: 'Greece', SA: 'Saudi Arabia',
  EG: 'Egypt', ZA: 'South Africa', NG: 'Nigeria', KE: 'Kenya'
};

function normalizeCountry(input?: string | null): string | null {
  if (!input) return null;
  let s = input.trim();
  if (!s) return null;
  // If already an emoji flag, keep it
  const containsEmoji = /[\u{1F1E6}-\u{1F1FF}]{2}/u.test(s);
  if (containsEmoji) return s;
  // Normalize: collapse punctuation/spaces and also create a letters-only variant
  s = s.replace(/[\.]/g, ' ').replace(/\s+/g, ' ').trim();
  const lettersOnly = s.replace(/[^A-Za-z]/g, '');
  // Prefer letters-only interpretation for codes like "U.S.A" or "U S A"
  if (/^[A-Za-z]{2}$/.test(lettersOnly)) return lettersOnly.toUpperCase();
  if (/^[A-Za-z]{3}$/.test(lettersOnly)) {
    const a2fromLetters = A3_TO_A2[lettersOnly.toUpperCase()];
    if (a2fromLetters) return a2fromLetters;
  }
  // If 2 or 3 contiguous letters were provided without punctuation
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  if (/^[A-Za-z]{3}$/.test(s)) {
    const a2 = A3_TO_A2[s.toUpperCase()];
    if (a2) return a2;
  }
  const upper = s.toUpperCase();
  // Try exact name map
  const mapped = NAME_TO_ISO2[upper];
  if (mapped) return mapped;
  // Try extracting the first two letters of the first word if it looks like a country phrase
  const firstWord = upper.split(' ')[0];
  if (/^[A-Z]{2,}$/.test(firstWord)) return firstWord.slice(0, 2);
  return null;
}

/**
 * Convert ISO-2 country code to flag emoji
 * Uses Unicode Regional Indicator Symbols (🇺🇸 = U+1F1FA + U+1F1F8)
 * @param code - ISO-2 country code (e.g., 'US', 'GB', 'FR')
 * @returns Flag emoji string or empty string if invalid
 */
const getFlagEmoji = (code?: string): string => {
  if (!code) return '';
  const trimmed = code.trim().toLowerCase();
  
  // Apply override: Israel -> Palestine
  const effectiveCode = trimmed === 'il' ? 'ps' : trimmed;
  
  if (effectiveCode.length !== 2) return '';
  
  // Convert to Regional Indicator Symbols
  // A-Z (65-90) -> 🇦-🇿 (U+1F1E6 - U+1F1FF)
  const base = 0x1F1E6 - 97; // 'a' = 97
  const first = base + effectiveCode.charCodeAt(0);
  const second = base + effectiveCode.charCodeAt(1);
  
  return String.fromCodePoint(first, second);
};

// List of valid country codes
const VALID_COUNTRY_CODES = new Set([
  'us', 'ru', 'de', 'fr', 'jp', 'gb', 'ca', 'au', 'br', 'cn', 'in', 'mx', 
  'es', 'it', 'nl', 'se', 'no', 'dk', 'fi', 'pl', 'cz', 'hu', 'at', 'ch', 
  'be', 'ie', 'pt', 'gr', 'tr', 'il', 'ps', 'sa', 'ae', 'eg', 'za', 'ng', 
  'ke', 'ma', 'tn', 'dz', 'ly', 'sd', 'et', 'gh', 'ci', 'sn', 'ml', 'bf', 
  'ne', 'td', 'cm', 'cf', 'cg', 'cd', 'ao', 'zm', 'zw', 'bw', 'na', 'sz', 
  'ls', 'mg', 'mu', 'sc', 'km', 'dj', 'so', 'er', 'ss', 'ug', 'rw', 'bi', 
  'tz', 'mw', 'mz', 'kr', 'ar', 'cl', 'co', 've', 'pe', 'ec', 'uy', 'py'
]);

interface FlagChipProps {
  countryCode?: string | null;
  label?: string;
  className?: string;
  size?: number;
}

/**
 * Displays a country flag emoji with optimized rendering
 * - Uses native Unicode flag emojis for performance
 * - Increased default size from 24px to 36px for better visibility
 * - Minimal padding for better flag-to-container ratio
 * - Hover effect for polish
 * - Full accessibility support
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
  
  // Validate country code
  if (!VALID_COUNTRY_CODES.has(normalizedCode)) {
    console.warn(`[FlagChip] Invalid country code: ${countryCode}`);
    return null;
  }

  // Get flag emoji
  const flagEmoji = getFlagEmoji(normalizedCode);
  if (!flagEmoji) {
    return null;
  }

  // Get country name for accessibility
  const countryName = COUNTRY_NAMES[normalizedCode.toUpperCase()] || countryCode.toUpperCase();
  const ariaLabel = label || `${countryName} flag`;

  return (
    <span
      className={[
        "inline-flex items-center justify-center",
        "px-1 py-0.5 rounded-md",
        "bg-white/50 border border-black/5",
        "transition-transform duration-200 hover:scale-105",
        "cursor-default",
        className
      ].filter(Boolean).join(" ")}
      role="img"
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <span
        className="inline-block leading-none"
        style={{
          fontSize: `${size}px`,
          lineHeight: 1,
          width: `${size}px`,
          height: `${size}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {flagEmoji}
      </span>
    </span>
  );
}
