"use client";
import React from "react";
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';

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

// Convert ISO country code to flag emoji with Israel->Palestine override
// This is the EXACT same logic as CustomPhoneInput (which works)
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

export default function FlagChip({ countryCode, label, className }: { countryCode?: string | null; label?: string; className?: string }) {
  if (!countryCode) {
    return null;
  }

  // List of valid country codes to prevent errors
  const validCountryCodes = [
    'us', 'ru', 'de', 'fr', 'jp', 'gb', 'ca', 'au', 'br', 'cn', 'in', 'mx', 'es', 'it', 'nl', 'se', 'no', 'dk', 'fi', 'pl', 'cz', 'hu', 'at', 'ch', 'be', 'ie', 'pt', 'gr', 'tr', 'il', 'ps', 'sa', 'ae', 'eg', 'za', 'ng', 'ke', 'ma', 'tn', 'dz', 'ly', 'sd', 'et', 'gh', 'ci', 'sn', 'ml', 'bf', 'ne', 'td', 'cm', 'cf', 'cg', 'cd', 'ao', 'zm', 'zw', 'bw', 'na', 'sz', 'ls', 'mg', 'mu', 'sc', 'km', 'dj', 'so', 'er', 'ss', 'ug', 'rw', 'bi', 'tz', 'mw', 'mz', 'sz', 'za', 'bw', 'na', 'zw', 'zm', 'ao', 'cd', 'cg', 'cm', 'cf', 'td', 'ne', 'bf', 'ml', 'sn', 'ci', 'gh', 'et', 'sd', 'ly', 'dz', 'tn', 'ma', 'ke', 'ng', 'za', 'eg', 'ae', 'sa', 'ps', 'il', 'tr', 'gr', 'pt', 'ie', 'be', 'ch', 'at', 'hu', 'cz', 'pl', 'fi', 'dk', 'no', 'se', 'nl', 'it', 'es', 'mx', 'in', 'cn', 'br', 'au', 'ca', 'gb', 'jp', 'fr', 'de', 'ru', 'us'
  ];

  const normalizedCode = countryCode.toLowerCase();
  if (!validCountryCodes.includes(normalizedCode)) {
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
      {/* Use the working PhoneInput to show the flag */}
      <div style={{ 
        width: '16px', 
        height: '16px', 
        overflow: 'hidden',
        display: 'inline-block'
      }}>
        <PhoneInput
          defaultCountry={normalizedCode}
          value=""
          onChange={() => {}}
          style={{
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            background: 'transparent',
            width: '16px',
            height: '16px'
          }}
          inputStyle={{
            display: 'none'
          }}
          countrySelectorStyleProps={{
            buttonStyle: {
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              background: 'transparent',
              padding: '0',
              width: '16px',
              height: '16px',
              minWidth: '16px'
            }
          }}
        />
      </div>
    </span>
  );
}
