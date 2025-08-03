import React from 'react';
import { FaGoogle, FaMicrosoft, FaMobileAlt, FaLink, FaApple } from 'react-icons/fa';

type Channel = 'gmail' | 'outlook' | 'phone' | 'apple' | 'share';

// Base priority for each channel (lower number = lower priority)
const basePriority: Record<Channel, number> = {
  gmail: 1,
  outlook: 1,
  phone: 1,
  apple: 1,
  share: 0 // Always last
};

/**
 * Checks if the email domain is a Google-hosted domain (Gmail or Google Workspace)
 */
function isGoogleHosted(domain: string): boolean {
  // Gmail domains
  if (['gmail.com', 'googlemail.com'].includes(domain)) {
    return true;
  }
  
  // Google Workspace domains (could be extended with additional validation)
  // This is a simple check and might need adjustment based on your requirements
  return domain.endsWith('.gmail.com') || domain.endsWith('.googlemail.com');
}

/**
 * Determines the user's platform from the user agent string
 */
function detectPlatform(ua: string): 'android' | 'ios' | 'other' {
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'other';
}

/**
 * Computes the priority-ordered list of channels based on user's email and platform
 */
export function computeChannelOrder(email: string, userAgent: string): Channel[] {
  const pri = { ...basePriority };
  
  // 1) Email domain priority
  const domain = email.split('@')[1]?.toLowerCase() || '';
  if (/(outlook|hotmail|live|msn)\./i.test(domain)) {
    pri.outlook += 3;
  } else if (isGoogleHosted(domain)) {
    pri.gmail += 3;
  }

  // 2) Platform-specific priorities
  const platform = detectPlatform(userAgent);
  if (platform === 'android') {
    pri.phone += 2;
  } else if (platform === 'ios') {
    pri.apple += 2;
    // On iOS, also slightly boost phone for fallback
    pri.phone += 1;
  }

  // Sort channels by priority (descending) and return as array
  return (Object.keys(pri) as Channel[]).sort((a, b) => pri[b] - pri[a]);
}

/**
 * Gets the display name for a channel
 */
export function getChannelDisplayName(channel: Channel): string {
  switch (channel) {
    case 'gmail': return 'Gmail Contacts';
    case 'outlook': return 'Outlook Contacts';
    case 'phone': return 'Phone Contacts';
    case 'apple': return 'Apple Contacts';
    case 'share': return 'Share Link';
    default: return channel;
  }
}

/**
 * Gets the icon component for a channel
 */
export function getChannelIcon(channel: Channel, className: string = '') {
  switch (channel) {
    case 'gmail':
      return <FaGoogle className={`text-[#DB4437] ${className}`} />;
    case 'outlook':
      return <FaMicrosoft className={`text-[#0078D4] ${className}`} />;
    case 'phone':
      return <FaMobileAlt className={`text-[#34B7F1] ${className}`} />;
    case 'apple':
      return <FaApple className={`text-gray-900 ${className}`} />;
    case 'share':
      return <FaLink className={`text-purple-600 ${className}`} />;
    default:
      return null;
  }
}

/**
 * Gets the description for a channel
 */
export function getChannelDescription(channel: Channel): string {
  switch (channel) {
    case 'gmail': return 'Invite your Gmail contacts';
    case 'outlook': return 'Connect your Outlook account';
    case 'phone': return 'Send invites via SMS';
    case 'apple': return 'Access your iOS contacts';
    case 'share': return 'Get a shareable link';
    default: return '';
  }
}
