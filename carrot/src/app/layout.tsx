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
              // CRITICAL FIX: Use exponential backoff for chunk retries
              var delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
              setTimeout(function() { 
                console.log('[ChunkRetry] Reloading page after ' + delay + 'ms delay');
                window.location.reload(); 
              }, delay);
            } else {
              console.error('[ChunkRetry] Max retries exceeded for chunk ' + chunkId);
              // Show user-friendly error message
              document.body.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: system-ui;"><div style="text-align: center;"><h2>Loading Error</h2><p>Please refresh the page or try again later.</p><button onclick="window.location.reload()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;">Refresh Page</button></div></div>';
            }
          };
          window.addEventListener('error', function(e) {
            var msg = e.message || '';
            if (msg.includes('ChunkLoadError') || msg.includes('Loading chunk')) {
              var match = msg.match(/chunk[s]?\\s+(\\d+)/i);
              var chunkId = match ? match[1] : 'unknown';
              console.error('[ChunkRetry] Detected chunk load error:', chunkId, msg);
              window.__RETRY_CHUNK__(chunkId);
              e.preventDefault();
            }
          }, true);
          // CRITICAL FIX: Also handle unhandled promise rejections for chunk loading
          window.addEventListener('unhandledrejection', function(e) {
            var msg = e.reason && e.reason.message ? e.reason.message : String(e.reason);
            if (msg.includes('ChunkLoadError') || msg.includes('Loading chunk')) {
              var match = msg.match(/chunk[s]?\\s+(\\d+)/i);
              var chunkId = match ? match[1] : 'unknown';
              console.error('[ChunkRetry] Detected chunk load error in promise rejection:', chunkId, msg);
              window.__RETRY_CHUNK__(chunkId);
              e.preventDefault();
            }
          });
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
