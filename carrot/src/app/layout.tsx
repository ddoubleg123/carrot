import { Inter } from 'next/font/google';
import './globals.css';
import type { Metadata } from 'next';
import ErrorBoundary from '@/components/ErrorBoundary';
import GlobalErrorHandlers from '@/components/GlobalErrorHandlers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Carrot',
  description: 'Make commitments, earn rewards, build community',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: '/favicon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {

  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon.png" type="image/png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/favicon.png" />
        {/* Chunk retry logic - must load early */}
        <script dangerouslySetInnerHTML={{ __html: `
          window.__CHUNK_RETRY_COUNT__ = new Map();
          window.__RETRY_CHUNK__ = function(chunkId) {
            var retryCount = window.__CHUNK_RETRY_COUNT__.get(chunkId) || 0;
            var maxRetries = 3;
            console.log('[ChunkRetry] Retry attempt ' + (retryCount + 1) + '/' + maxRetries + ' for chunk ' + chunkId);
            if (retryCount < maxRetries) {
              window.__CHUNK_RETRY_COUNT__.set(chunkId, retryCount + 1);
              setTimeout(function() { window.location.reload(); }, 1000);
            }
          };
          window.addEventListener('error', function(e) {
            var msg = e.message || '';
            if (msg.includes('ChunkLoadError') || msg.includes('Loading chunk')) {
              var match = msg.match(/chunk[s]?\\s+(\\d+)/i);
              var chunkId = match ? match[1] : 'unknown';
              window.__RETRY_CHUNK__(chunkId);
              e.preventDefault();
            }
          }, true);
        ` }} />
        {/* Performance hints: preconnect/dns-prefetch to common media/font domains */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" />
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://firebasestorage.googleapis.com" />
        <link rel="preconnect" href="https://storage.googleapis.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://storage.googleapis.com" />
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
      </head>
          <body className={inter.className} style={{ position: 'relative', minHeight: '100vh' }}>
            {/* Background removed - carrotfield.mp4 no longer exists */}
            <GlobalErrorHandlers />
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </body>
    </html>
  );
}
