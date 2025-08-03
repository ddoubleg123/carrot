'use client';

import React from 'react';
import { PhoneInput } from 'react-international-phone';
import 'react-international-phone/style.css';
import { cn } from '@/lib/utils';

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
    <PhoneInput
      defaultCountry="us"
      value={value}
      onChange={onChange}
      disabled={disabled}
      inputClassName={cn(
        'w-full bg-transparent border-0 outline-none rounded-lg',
        error ? 'text-red-600 ring-1 ring-red-500/40 border-red-500' : 'text-gray-900',
        className
      )}
      onBlur={onBlur}
      onFocus={onFocus}
    />
  );
}
