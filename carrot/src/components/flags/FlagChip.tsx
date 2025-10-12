"use client";
import React from "react";
import { getCountryData } from 'react-international-phone';

interface FlagChipProps {
  countryCode?: string | null;
  label?: string;
  className?: string;
  size?: number;
}

/**
 * Displays a country flag using react-international-phone
 * - Uses the same library as CustomPhoneInput for consistency
 * - Proper flag display that actually works
 * - 36px default size for visibility
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

  // Normalize country code to lowercase
  const normalizedCode = countryCode.toLowerCase();
  
  try {
    // Get country data from react-international-phone
    const countryData = getCountryData({ code: normalizedCode });
    
    if (!countryData) {
      console.warn(`[FlagChip] Country not found: ${countryCode}`);
      return null;
    }

    const countryName = countryData.name || countryCode.toUpperCase();
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
          {countryData.flag}
        </span>
      </span>
    );
  } catch (error) {
    console.warn(`[FlagChip] Error getting country data for ${countryCode}:`, error);
    return null;
  }
}