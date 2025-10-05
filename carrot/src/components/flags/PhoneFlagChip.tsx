'use client';
import React from 'react';
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';

interface PhoneFlagChipProps {
  countryCode?: string | null;
  label?: string;
  className?: string;
}

export default function PhoneFlagChip({ 
  countryCode, 
  label, 
  className 
}: PhoneFlagChipProps) {
  if (!countryCode) {
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
      {/* Use a hidden PhoneInput to extract the flag */}
      <div style={{ 
        width: '16px', 
        height: '16px', 
        overflow: 'hidden',
        display: 'inline-block'
      }}>
        <PhoneInput
          defaultCountry={countryCode.toLowerCase()}
          value=""
          onChange={() => {}}
          style={{
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            background: 'transparent',
            width: '16px',
            height: '16px',
            fontSize: '12px'
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
