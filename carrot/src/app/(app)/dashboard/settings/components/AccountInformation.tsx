'use client';

import { useState, useEffect, useRef } from 'react';
import { ExclamationCircleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

type Country = {
  code: string;
  name: string;
  flag: string;
  dialCode: string;
};

const countries: Country[] = [
  { code: 'US', name: 'United States', flag: '🇺🇸', dialCode: '+1' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', dialCode: '+1' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', dialCode: '+44' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', dialCode: '+61' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', dialCode: '+49' },
  { code: 'FR', name: 'France', flag: '🇫🇷', dialCode: '+33' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', dialCode: '+81' },
  { code: 'IN', name: 'India', flag: '🇮🇳', dialCode: '+91' },
];

interface AccountInformationProps {
  formData: {
    fullName: string;
    username: string;
    email: string;
    phone: string;
  };
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUsernameChange: (username: string) => Promise<{ success: boolean; message?: string }>;
  isSaving: boolean;
  saveError?: string;
  setSaveError: (error: string) => void;
}

export default function AccountInformation({ 
  formData, 
  onInputChange, 
  onUsernameChange,
  isSaving,
  saveError,
  setSaveError
}: AccountInformationProps) {
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [isUsernameLocked, setIsUsernameLocked] = useState(true);
  const [originalUsername, setOriginalUsername] = useState(formData.username);
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]);
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCountryDropdownOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const toggleCountryDropdown = () => {
    setIsCountryDropdownOpen(!isCountryDropdownOpen);
  };
  
  const selectCountry = (country: Country) => {
    setSelectedCountry(country);
    setIsCountryDropdownOpen(false);
  };
  
  const checkUsernameAvailability = async (username: string) => {
    if (!username) {
      setIsUsernameAvailable(null);
      setUsernameError('Username is required');
      return false;
    }
    
    if (username.length < 3) {
      setIsUsernameAvailable(false);
      setUsernameError('Username must be at least 3 characters');
      return false;
    }
    
    if (username === originalUsername) {
      setIsUsernameAvailable(true);
      setUsernameError(null);
      return true;
    }
    
    setIsCheckingUsername(true);
    setUsernameError(null);
    
    try {
      // TODO: Replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 500));
      // Mock response - in real app, this would be an API call
      const isAvailable = Math.random() > 0.7; // 30% chance of being taken for demo
      setIsUsernameAvailable(isAvailable);
      
      if (!isAvailable) {
        setUsernameError('Username is already taken');
      }
      
      return isAvailable;
    } catch (error) {
      console.error('Error checking username:', error);
      setUsernameError('Error checking username availability');
      return false;
    } finally {
      setIsCheckingUsername(false);
    }
  };
  
  const handleUsernameBlur = async () => {
    if (formData.username && formData.username !== originalUsername) {
      await checkUsernameAvailability(formData.username);
    }
  };
  
  const handleUsernameChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUsername = e.target.value;
    onInputChange(e);
    setUsernameTouched(true);
    setSaveError('');
    
    // Reset availability state when user starts typing
    if (newUsername !== originalUsername) {
      setIsUsernameAvailable(null);
      setIsUsernameLocked(false);
    } else {
      setIsUsernameLocked(true);
      setUsernameError(null);
    }
    
    // Debounce the availability check
    const timer = setTimeout(async () => {
      if (newUsername && newUsername !== originalUsername) {
        await checkUsernameAvailability(newUsername);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  };

  return (
    <div className="bg-white shadow-sm rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-6">Account Information</h2>
      
      <div className="space-y-6">
        {/* Full Name */}
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1">
            Full Name
          </label>
          <input
            type="text"
            id="fullName"
            name="fullName"
            value={formData.fullName}
            onChange={onInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
          />
        </div>

        {/* Username */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Username
            </label>
            {!isUsernameLocked && formData.username && formData.username !== originalUsername && (
              <button
                type="button"
                onClick={async () => {
                  const isAvailable = await checkUsernameAvailability(formData.username);
                  if (isAvailable) {
                    try {
                      const result = await onUsernameChange(formData.username);
                      if (result.success) {
                        setOriginalUsername(formData.username);
                        setIsUsernameLocked(true);
                      } else {
                        setUsernameError(result.message || 'Failed to update username');
                      }
                    } catch (error) {
                      setUsernameError('Error updating username');
                    }
                  }
                }}
                disabled={isSaving || !isUsernameAvailable}
                className={`text-xs font-medium ${
                  isUsernameAvailable && !isSaving
                    ? 'text-primary-600 hover:text-primary-800'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            )}
          </div>
          
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 sm:text-sm">@</span>
            </div>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleUsernameChange}
              onBlur={handleUsernameBlur}
              disabled={isSaving || isUsernameLocked}
              className={`pl-7 w-full px-3 py-2 border ${
                usernameError || saveError
                  ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                  : isUsernameAvailable === true
                  ? 'border-green-300 focus:ring-green-500 focus:border-green-500'
                  : 'border-gray-300 focus:ring-primary-500 focus:border-primary-500'
              } rounded-md shadow-sm`}
              aria-describedby="username-helper-text"
            />
            
            {isCheckingUsername ? (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              </div>
            ) : formData.username && !isUsernameLocked ? (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                {isUsernameAvailable === true ? (
                  <CheckCircleIcon className="h-5 w-5 text-green-500" aria-hidden="true" />
                ) : isUsernameAvailable === false ? (
                  <ExclamationCircleIcon className="h-5 w-5 text-red-500" aria-hidden="true" />
                ) : null}
              </div>
            ) : isUsernameLocked ? (
              <button
                type="button"
                onClick={() => setIsUsernameLocked(false)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                title="Edit username"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            ) : null}
          </div>
          
          {usernameError || saveError ? (
            <p className="mt-1 text-sm text-red-600" id="username-helper-text">
              {usernameError || saveError}
            </p>
          ) : isUsernameAvailable === true ? (
            <p className="mt-1 text-sm text-green-600" id="username-helper-text">
              Username is available! {isUsernameLocked ? '' : 'Click Save to confirm.'}
            </p>
          ) : formData.username && isUsernameAvailable === false ? (
            <p className="mt-1 text-sm text-red-600" id="username-helper-text">
              Username is already taken. Please try another one.
            </p>
          ) : formData.username?.length > 0 && formData.username.length < 3 ? (
            <p className="mt-1 text-sm text-red-600" id="username-helper-text">
              Username must be at least 3 characters
            </p>
          ) : (
            <p className="mt-1 text-xs text-gray-500" id="username-helper-text">
              {isUsernameLocked ? 'Click the edit icon to change your username' : 'Choose a unique username'}
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={onInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            We'll send a confirmation email to verify any changes.
          </p>
        </div>

        {/* Phone Number */}
        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number
          </label>
          <div className="relative">
            <div 
              className={`relative flex items-center rounded-md shadow-sm transition-all duration-150 ${
                isCountryDropdownOpen 
                  ? 'ring-2 ring-primary-500 border-primary-500' 
                  : 'border border-gray-300 hover:border-gray-400'
              }`}
            >
              {/* Country Selector */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={toggleCountryDropdown}
                  className="h-full flex items-center pl-3 pr-8 py-3 border-r border-gray-200 bg-gray-50 rounded-l-md hover:bg-gray-100 transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                >
                  <span className="text-base mr-2">{selectedCountry.flag}</span>
                  <span className="text-sm font-medium text-gray-700">{selectedCountry.dialCode}</span>
                  <svg 
                    className={`w-4 h-4 text-gray-500 absolute right-2 transition-transform duration-200 ${
                      isCountryDropdownOpen ? 'transform rotate-180' : ''
                    }`}
                    fill="currentColor" 
                    viewBox="0 0 20 20"
                  >
                    <path 
                      fillRule="evenodd" 
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" 
                      clipRule="evenodd" 
                    />
                  </svg>
                </button>
                
                {/* Country Dropdown */}
                {isCountryDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-56 bg-white rounded-md shadow-lg border border-gray-200 py-1 max-h-60 overflow-auto">
                    {countries.map((country) => (
                      <button
                        key={country.code}
                        type="button"
                        className={`w-full text-left px-4 py-2 text-sm flex items-center hover:bg-gray-50 ${
                          selectedCountry.code === country.code ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => selectCountry(country)}
                      >
                        <span className="text-base mr-3">{country.flag}</span>
                        <span className="flex-1 text-gray-700">{country.name}</span>
                        <span className="text-gray-500">{country.dialCode}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Phone Input */}
              <div className="flex-1 relative">
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={onInputChange}
                  className="block w-full pl-4 pr-4 py-3 text-sm border-0 focus:ring-0 focus:outline-none rounded-r-md"
                  placeholder="(555) 123-4567"
                  onFocus={() => document.querySelector('.phone-container')?.classList.add('focused')}
                  onBlur={() => document.querySelector('.phone-container')?.classList.remove('focused')}
                />
              </div>
            </div>
            
            <p className="mt-2 text-xs text-gray-500">
              We'll send a verification code to this number.
            </p>
          </div>
        </div>
        
        <style jsx>{`
          /* Custom scrollbar for dropdown */
          .scrollbar-custom::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          
          .scrollbar-custom::-webkit-scrollbar-track {
            background: #f1f1f1;
            border-radius: 3px;
          }
          
          .scrollbar-custom::-webkit-scrollbar-thumb {
            background: #c1c1c1;
            border-radius: 3px;
          }
          
          .scrollbar-custom::-webkit-scrollbar-thumb:hover {
            background: #a8a8a8;
          }
          
          /* Custom focus ring */
          .phone-container.focused {
            box-shadow: 0 0 0 2px rgba(244, 124, 35, 0.25);
            border-color: #f47c23;
          }
          
          /* Smooth transitions */
          .transition-all {
            transition-property: all;
            transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
            transition-duration: 150ms;
          }
        `}</style>

        {/* Change Password Button */}
        <div className="pt-2">
          <button
            type="button"
            className="text-sm font-medium text-primary-600 hover:text-primary-500"
            onClick={() => {
              // TODO: Implement change password flow
              console.log('Change password clicked');
            }}
          >
            Change Password
          </button>
        </div>
      </div>
    </div>
  );
}
