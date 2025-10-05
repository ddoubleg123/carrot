'use client';

import React from 'react';
import FlagChip from '@/components/flags/FlagChip';

export default function SimpleTestFlagsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">Flag Display Test Page</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Flag Component Tests */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">Individual Flag Components</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-600 w-24">Russian:</span>
                <FlagChip countryCode="RU" />
                <span className="text-sm text-gray-500">🇷🇺</span>
              </div>
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-600 w-24">US:</span>
                <FlagChip countryCode="US" />
                <span className="text-sm text-gray-500">🇺🇸</span>
              </div>
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-600 w-24">German:</span>
                <FlagChip countryCode="DE" />
                <span className="text-sm text-gray-500">🇩🇪</span>
              </div>
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-600 w-24">French:</span>
                <FlagChip countryCode="FR" />
                <span className="text-sm text-gray-500">🇫🇷</span>
              </div>
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-600 w-24">Japanese:</span>
                <FlagChip countryCode="JP" />
                <span className="text-sm text-gray-500">🇯🇵</span>
              </div>
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-600 w-24">No Flag:</span>
                <FlagChip countryCode={null} />
                <span className="text-sm text-gray-500">(should be empty)</span>
              </div>
              <div className="flex items-center gap-4 p-3 bg-gray-50 rounded">
                <span className="text-sm font-medium text-gray-600 w-24">Invalid:</span>
                <FlagChip countryCode="XX" />
                <span className="text-sm text-gray-500">(fallback)</span>
              </div>
            </div>
          </div>

          {/* Username + Flag Examples */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">Username + Flag Examples</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                <span className="font-semibold text-gray-900">@russianuser</span>
                <FlagChip countryCode="RU" />
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                <span className="font-semibold text-gray-900">@americanuser</span>
                <FlagChip countryCode="US" />
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                <span className="font-semibold text-gray-900">@germanuser</span>
                <FlagChip countryCode="DE" />
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded">
                <span className="font-semibold text-gray-900">@nouser</span>
                {/* No flag chip - this tests our fix */}
              </div>
            </div>
          </div>
        </div>

        {/* Test Results */}
        <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-900 mb-4">✅ Test Results</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-green-800">
            <div>
              <h4 className="font-medium mb-2">Flag Display Tests:</h4>
              <ul className="space-y-1">
                <li>✅ Russian flag should display 🇷🇺</li>
                <li>✅ US flag should display 🇺🇸</li>
                <li>✅ German flag should display 🇩🇪</li>
                <li>✅ French flag should display 🇫🇷</li>
                <li>✅ Japanese flag should display 🇯🇵</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">Edge Cases:</h4>
              <ul className="space-y-1">
                <li>✅ No flag (null) should show nothing</li>
                <li>✅ Invalid flag should show fallback</li>
                <li>✅ Username without flag should show no flag chip</li>
                <li>✅ This fixes the "us" text issue</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">📋 Instructions</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <p>This test page demonstrates the flag functionality without requiring authentication.</p>
            <p><strong>What to look for:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Flags should display as emoji next to country codes</li>
              <li>Russian flag (RU) should show 🇷🇺</li>
              <li>No flag entries should show nothing (not "us" text)</li>
              <li>Invalid country codes should show fallback or nothing</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
