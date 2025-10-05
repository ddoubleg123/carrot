'use client';

import React from 'react';
import FlagChip from '@/components/flags/FlagChip';
import CommitmentCard from '@/app/(app)/dashboard/components/CommitmentCard';

// Test data with different flag scenarios
const testPosts = [
  {
    id: 'test-russian-flag',
    content: 'This post shows a Russian flag 🇷🇺',
    carrotText: 'Test Russian Flag',
    stickText: 'Flag Test',
    author: {
      name: '',
      username: '@testuser',
      avatar: '/avatar-placeholder.svg',
      flag: 'RU', // Russian flag
      id: 'test-user-1',
    },
    homeCountry: 'RU',
    location: { zip: '10001', city: 'Moscow', state: 'RU' },
    stats: {
      likes: 42,
      comments: 7,
      reposts: 3,
      views: 150,
    },
    userVote: null,
    timestamp: new Date().toISOString(),
    imageUrls: [],
    gifUrl: null,
    videoUrl: null,
    thumbnailUrl: null,
    cfUid: null,
    cfPlaybackUrlHls: null,
    captionVttUrl: null,
    audioUrl: null,
    audioTranscription: null,
    transcriptionStatus: null,
    emoji: '🇷🇺',
    gradientFromColor: '#ff0000',
    gradientToColor: '#0000ff',
    gradientViaColor: null,
    gradientDirection: 'to-br',
  },
  {
    id: 'test-no-flag',
    content: 'This post has no flag (should not show flag chip)',
    carrotText: 'No Flag Test',
    stickText: 'Flag Test',
    author: {
      name: '',
      username: '@nouser',
      avatar: '/avatar-placeholder.svg',
      flag: undefined, // No flag
      id: 'test-user-2',
    },
    homeCountry: null,
    location: { zip: '10001', city: 'Unknown', state: 'XX' },
    stats: {
      likes: 15,
      comments: 2,
      reposts: 1,
      views: 75,
    },
    userVote: null,
    timestamp: new Date().toISOString(),
    imageUrls: [],
    gifUrl: null,
    videoUrl: null,
    thumbnailUrl: null,
    cfUid: null,
    cfPlaybackUrlHls: null,
    captionVttUrl: null,
    audioUrl: null,
    audioTranscription: null,
    transcriptionStatus: null,
    emoji: '🌍',
    gradientFromColor: '#00ff00',
    gradientToColor: '#ff00ff',
    gradientViaColor: null,
    gradientDirection: 'to-br',
  },
  {
    id: 'test-us-flag',
    content: 'This post shows a US flag 🇺🇸',
    carrotText: 'Test US Flag',
    stickText: 'Flag Test',
    author: {
      name: '',
      username: '@ususer',
      avatar: '/avatar-placeholder.svg',
      flag: 'US', // US flag
      id: 'test-user-3',
    },
    homeCountry: 'US',
    location: { zip: '10001', city: 'New York', state: 'NY' },
    stats: {
      likes: 28,
      comments: 5,
      reposts: 2,
      views: 120,
    },
    userVote: null,
    timestamp: new Date().toISOString(),
    imageUrls: [],
    gifUrl: null,
    videoUrl: null,
    thumbnailUrl: null,
    cfUid: null,
    cfPlaybackUrlHls: null,
    captionVttUrl: null,
    audioUrl: null,
    audioTranscription: null,
    transcriptionStatus: null,
    emoji: '🇺🇸',
    gradientFromColor: '#ff0000',
    gradientToColor: '#ffffff',
    gradientViaColor: '#0000ff',
    gradientDirection: 'to-br',
  },
  {
    id: 'test-german-flag',
    content: 'This post shows a German flag 🇩🇪',
    carrotText: 'Test German Flag',
    stickText: 'Flag Test',
    author: {
      name: '',
      username: '@germanuser',
      avatar: '/avatar-placeholder.svg',
      flag: 'DE', // German flag
      id: 'test-user-4',
    },
    homeCountry: 'DE',
    location: { zip: '10001', city: 'Berlin', state: 'DE' },
    stats: {
      likes: 35,
      comments: 8,
      reposts: 4,
      views: 180,
    },
    userVote: null,
    timestamp: new Date().toISOString(),
    imageUrls: [],
    gifUrl: null,
    videoUrl: null,
    thumbnailUrl: null,
    cfUid: null,
    cfPlaybackUrlHls: null,
    captionVttUrl: null,
    audioUrl: null,
    audioTranscription: null,
    transcriptionStatus: null,
    emoji: '🇩🇪',
    gradientFromColor: '#000000',
    gradientToColor: '#ff0000',
    gradientViaColor: '#ffff00',
    gradientDirection: 'to-br',
  }
];

export default function TestFlagsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Flag Display Test Page</h1>
        
        <div className="mb-8 p-4 bg-white rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Flag Component Tests</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Russian Flag:</span>
              <FlagChip countryCode="RU" />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">US Flag:</span>
              <FlagChip countryCode="US" />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">German Flag:</span>
              <FlagChip countryCode="DE" />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">No Flag (null):</span>
              <FlagChip countryCode={null} />
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Invalid Flag:</span>
              <FlagChip countryCode="XX" />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h2 className="text-xl font-semibold">Post Card Tests</h2>
          {testPosts.map((post) => (
            <div key={post.id} className="bg-white rounded-lg shadow">
              <CommitmentCard
                {...post}
                onVote={() => {}}
                onDelete={() => {}}
                currentUserId="test-user"
              />
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">Test Results</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>✅ Russian flag should display 🇷🇺</li>
            <li>✅ US flag should display 🇺🇸</li>
            <li>✅ German flag should display 🇩🇪</li>
            <li>✅ No flag post should show no flag chip</li>
            <li>✅ Invalid flag should show fallback or nothing</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
