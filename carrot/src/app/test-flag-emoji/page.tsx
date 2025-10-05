'use client';

import React from 'react';

// Test flag emoji generation directly
function testFlagEmoji(code: string) {
  const A = 0x1F1E6;
  const a = 65; // 'A'
  const chars = [code.charCodeAt(0) - a + A, code.charCodeAt(1) - a + A];
  const emoji = String.fromCodePoint(chars[0], chars[1]);
  return emoji;
}

export default function TestFlagEmojiPage() {
  const testCodes = ['RU', 'US', 'DE', 'FR', 'JP', 'GB', 'CA'];
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Flag Emoji Test</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-6">Direct Emoji Generation</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {testCodes.map(code => {
              const emoji = testFlagEmoji(code);
              return (
                <div key={code} className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                  <span className="text-2xl">{emoji}</span>
                  <span className="font-mono text-sm">{code}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-6">Unicode Values</h2>
          <div className="space-y-2 text-sm font-mono">
            {testCodes.map(code => {
              const A = 0x1F1E6;
              const a = 65;
              const chars = [code.charCodeAt(0) - a + A, code.charCodeAt(1) - a + A];
              const emoji = String.fromCodePoint(chars[0], chars[1]);
              return (
                <div key={code} className="flex items-center gap-4">
                  <span className="text-xl">{emoji}</span>
                  <span>{code}: U+{chars[0].toString(16).toUpperCase()} U+{chars[1].toString(16).toUpperCase()}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-6">Browser Support Test</h2>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded">
              <h3 className="font-semibold text-blue-900 mb-2">Expected Results:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>🇷🇺 Russian flag</li>
                <li>🇺🇸 US flag</li>
                <li>🇩🇪 German flag</li>
                <li>🇫🇷 French flag</li>
                <li>🇯🇵 Japanese flag</li>
                <li>🇬🇧 British flag</li>
                <li>🇨🇦 Canadian flag</li>
              </ul>
            </div>
            <div className="p-4 bg-yellow-50 rounded">
              <h3 className="font-semibold text-yellow-900 mb-2">If you see boxes or text instead of flags:</h3>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>Your browser may not support flag emojis</li>
                <li>Your system may not have flag emoji fonts installed</li>
                <li>This is a common issue on Windows systems</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
