'use client';

import React from 'react';
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import '../styles/phone-input-override.css';
import { cn } from '../lib/utils';

interface CustomPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  error?: boolean;
  onBlur?: () => void;
  onFocus?: () => void;
}

export function CustomPhoneInput({
  value = '',
  onChange,
  disabled = false,
  className = '',
  error = false,
  onBlur,
  onFocus,
}: CustomPhoneInputProps) {
  return (
    <div 
      className={cn(
        "relative w-full",
        // Removed overflow-hidden which was clipping the flag
      )}
      style={{
        // Ensure no child elements can have borders
        '--phone-input-border': 'none',
        '--phone-input-outline': 'none'
      } as React.CSSProperties}
    >
      {/* Add a style tag to override borders but preserve flag display */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .react-international-phone-input {
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
            -webkit-appearance: none !important;
            appearance: none !important;
          }
          .react-international-phone-country-selector-button {
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
            background: transparent !important;
            display: flex !important;
            align-items: center !important;
            padding: 4px 8px !important;
            cursor: pointer !important;
          }
          .react-international-phone-country-selector-button__flag-emoji {
            display: inline-block !important;
            font-size: 24px !important;
            margin-right: 8px !important;
            visibility: visible !important;
            opacity: 1 !important;
            width: 24px !important;
            height: 24px !important;
          }
          /* Target the flag in both button states */
          .react-international-phone-country-selector-button .react-international-phone-country-selector-button__flag-emoji,
          .react-international-phone-country-selector .react-international-phone-country-selector-button__flag-emoji {
            display: inline-block !important;
            font-size: 24px !important;
            margin-right: 8px !important;
            visibility: visible !important;
            opacity: 1 !important;
            width: 24px !important;
            height: 24px !important;
          }
          /* Also target any flag emoji directly */
          .react-international-phone-country-selector span[role="img"],
          .react-international-phone-country-selector-button span[role="img"] {
            font-size: 24px !important;
            width: 24px !important;
            height: 24px !important;
            display: inline-block !important;
            margin-right: 8px !important;
          }
          .react-international-phone-country-selector {
            display: flex !important;
            align-items: center !important;
            visibility: visible !important;
            opacity: 1 !important;
          }
        `
      }} />
      <PhoneInput
        defaultCountry="us"
        value={value}
        onChange={onChange}
        disabled={disabled}
        inputStyle={{
          border: 'none',
          outline: 'none',
          boxShadow: 'none',
          borderWidth: '0',
          borderStyle: 'none',
          borderColor: 'transparent',
          background: 'transparent',
          width: '100%'
        }}
        inputClassName={cn(
          'w-full bg-transparent',
          '[border:none!important] [outline:none!important] [box-shadow:none!important]',
          '[border-width:0!important] [border-style:none!important] [border-color:transparent!important]',
          error ? 'text-red-600' : 'text-gray-900',
          className
        )}
        onBlur={onBlur}
        onFocus={onFocus}
      />
    </div>
  );
}
