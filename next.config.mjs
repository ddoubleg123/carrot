/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Only enable local proxies during development; disable in production
    if (process.env.NODE_ENV !== 'production') {
      return [
        {
          source: '/media/:path*',
          destination: 'http://localhost:8080/media/:path*',
        },
        {
          source: '/api/worker/:path*',
          destination: 'http://localhost:8080/:path*',
        },
      ];
    }
    return [];
  },
  async headers() {
    if (process.env.NODE_ENV !== 'production') return [];

    const csp = [
      "default-src 'self'",
      // Stream SDK and player
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://embed.videodelivery.net",
      // HLS/DASH manifests and media segments
      "media-src 'self' blob: data: https://videodelivery.net",
      // iframes (if you ever use iframe player)
      'frame-src https://iframe.videodelivery.net',
      // images/posters
      "img-src 'self' blob: data: https://videodelivery.net",
      // allow network to videodelivery for XHR/fetch if needed
      "connect-src 'self' https://videodelivery.net",
      // style/fonts
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
