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

function normalizeCountry(input?: string | null): string | null {
  if (!input) return null;
  let s = input.trim();
  if (!s) return null;
  // If already an emoji flag, keep it
  const containsEmoji = /[\u{1F1E6}-\u{1F1FF}]{2}/u.test(s);
  if (containsEmoji) return s;
  // Remove punctuation and periods commonly present (e.g., U.S.)
  s = s.replace(/[\.]/g, ' ').replace(/\s+/g, ' ').trim();
  // If 2 letters, assume ISO2
  if (/^[A-Za-z]{2}$/.test(s)) return s.toUpperCase();
  // If alpha-3, map to alpha-2
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

function countryToEmoji(codeOrName?: string | null): string | null {
  const norm = normalizeCountry(codeOrName);
  if (!norm) return null;
  let cc = norm;
  // If already emoji, return as-is
  if (/[\u{1F1E6}-\u{1F1FF}]{2}/u.test(cc)) return cc;
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
  
  // Debug logging for flag rendering
  if (process.env.NODE_ENV !== 'production') {
    console.log('[FlagChip] Debug:', {
      countryCode,
      normalized: normalizeCountry(countryCode),
      emoji,
      willShowFallback: !emoji
    });
  }
  
  return (
    <span
      className={["inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#F7F8FA] border border-black/5 text-gray-800", className]
        .filter(Boolean)
        .join(" ")}
      aria-label={label || `Home country: ${countryCode || ''}`}
      title={label || `Home country: ${countryCode || ''}`}
    >
      {emoji ? (
        <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden>
          {emoji}
        </span>
      ) : (
        <span className="text-[11px] font-semibold tracking-wide">
          {(normalizeCountry(countryCode) || '').toString().toUpperCase().slice(0, 3)}
        </span>
      )}
    </span>
  );
}
