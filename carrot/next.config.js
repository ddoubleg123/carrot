/** @type {import('next').NextConfig} */
const path = require('path');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  outputFileTracingRoot: path.resolve(__dirname, '..'),
  // Add compression and caching optimizations
  compress: true,
  poweredByHeader: false,
  // Optimize for production deployment
  swcMinify: true,
  // Disable static optimization for better compatibility
  trailingSlash: false,
  // Disable HTTP/2 completely
  experimental: {
    http2: false,
    // Force HTTP/1.1 for Render deployment
    serverComponentsExternalPackages: [],
  },
  // Add webpack optimizations for chunk loading
  webpack: (config, { isServer, dev }) => {
    if (!isServer && !dev) {
      // Optimize chunk loading for production
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000,
        maxAsyncRequests: 30,
        maxInitialRequests: 30,
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: -10,
            chunks: 'all',
            enforce: true,
            maxSize: 244000,
          },
          common: {
            name: 'common',
            minChunks: 2,
            priority: -5,
            reuseExistingChunk: true,
            enforce: true,
            maxSize: 244000,
          },
          // Separate React chunks
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react',
            priority: 20,
            chunks: 'all',
            enforce: true,
          },
        },
      };
      
      // Add chunk loading optimization
      config.optimization.runtimeChunk = {
        name: 'runtime',
      };
      
      // Add chunk loading error handling
      config.optimization.chunkIds = 'deterministic';
      config.optimization.moduleIds = 'deterministic';
    }
    return config;
  },
  images: {
    domains: [
      'firebasestorage.googleapis.com',
      'storage.googleapis.com',
      'lh3.googleusercontent.com',
      'lh4.googleusercontent.com',
      'lh5.googleusercontent.com',
      'lh6.googleusercontent.com',
      'images.unsplash.com',
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.firebasestorage.app',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async rewrites() {
    return [
      // Proxy all media through Firebase Function
      {
        source: '/media/:path*',
        destination: 'https://us-central1-involuted-river-466315.cloudfunctions.net/fullWorker/media/:path*',
      },
      // Proxy worker API through Firebase Function
      {
        source: '/api/worker/:path*',
        destination: 'https://us-central1-involuted-river-466315.cloudfunctions.net/fullWorker/:path*',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.knightlab.com",
              "style-src 'self' 'unsafe-inline' https://cdn.knightlab.com",
              "font-src 'self' https://cdn.knightlab.com https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://lh3.googleusercontent.com https://firebasestorage.googleapis.com https://storage.googleapis.com https://images.unsplash.com https://media.giphy.com https://*.giphy.com https://media.tenor.com https://*.tenor.com https://c.tenor.com https://media1.tenor.com https://media2.tenor.com https://media3.tenor.com https://media4.tenor.com https://media5.tenor.com https://cdnjs.cloudflare.com https://ui-avatars.com",
              // 👇 THE CRITICAL FIX - Allow media sources
              "media-src 'self' blob: data: https://firebasestorage.googleapis.com https://storage.googleapis.com https://*.firebasestorage.app https://commondatastorage.googleapis.com https://www.youtube.com https://youtube.com https://*.youtube.com https://*.googlevideo.com https://media.giphy.com https://*.giphy.com https://media.tenor.com https://*.tenor.com https://c.tenor.com https://media0.giphy.com https://media1.giphy.com https://media2.giphy.com https://media3.giphy.com https://media4.giphy.com https://media5.giphy.com https://www.soundhelix.com",
              "connect-src 'self' blob: https://*.googleapis.com https://firebasestorage.googleapis.com https://storage.googleapis.com https://api.giphy.com https://tenor.googleapis.com https://huggingface.co https://*.huggingface.co https://cdn-lfs.huggingface.co https://cdn.knightlab.com",
              "frame-ancestors 'self'"
            ].join('; ')
          },
          // Add headers to help with chunk loading and HTTP/2 issues
          {
            key: 'Connection',
            value: 'keep-alive'
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
          // Disable HTTP/2 to prevent protocol errors
          {
            key: 'Alt-Svc',
            value: 'clear'
          },
          {
            key: 'Upgrade',
            value: 'HTTP/1.1'
          },
          {
            key: 'HTTP2-Settings',
            value: ''
          },
          {
            key: 'Connection',
            value: 'close'
          },
          {
            key: 'X-Forwarded-Proto',
            value: 'http'
          }
        ]
      },
      // Specific headers for Next.js static chunks
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
          {
            key: 'Connection',
            value: 'close'
          },
          {
            key: 'Alt-Svc',
            value: 'clear'
          },
          {
            key: 'Upgrade',
            value: 'HTTP/1.1'
          },
          {
            key: 'X-Forwarded-Proto',
            value: 'http'
          }
        ]
      }
    ];
  }
};

module.exports = withBundleAnalyzer(nextConfig);
