"use client";
import React from 'react';
import TestFeedClient from './TestFeedClient';

export const dynamic = 'force-dynamic';

export default function TestFeedPage() {
  return (
    <main style={{ maxWidth: 680, margin: '0 auto', padding: 16 }}>
      <h1 style={{ fontSize: 24, marginBottom: 12 }}>Public Test Feed</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        This page is public and used by Playwright to validate deterministic Active/Warm selection and video pid attribution.
      </p>
      <TestFeedClient />
    </main>
  );
}
