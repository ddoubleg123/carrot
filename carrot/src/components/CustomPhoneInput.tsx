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
        "overflow-hidden relative w-full",
        // No border here since parent container provides it
      )}
      style={{
        // Ensure no child elements can have borders
        '--phone-input-border': 'none',
        '--phone-input-outline': 'none'
      } as React.CSSProperties}
    >
      {/* Add a style tag to override any remaining borders */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .react-international-phone-input-container * {
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
          }
          .react-international-phone-input {
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
            -webkit-appearance: none !important;
            appearance: none !important;
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
        containerStyle={{
          border: 'none',
          outline: 'none',
          boxShadow: 'none'
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
