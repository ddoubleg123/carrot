/** @type {import('next').NextConfig} */
const path = require('path');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig = {
  outputFileTracingRoot: path.resolve(__dirname, '..'),
  trailingSlash: false,
  // Force HTTP/1.1 for all requests with aggressive settings
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'carrot-app.onrender.com'],
    },
  },
  // Move serverComponentsExternalPackages to root level
  serverExternalPackages: [],
  // Disable HTTP/2 and force HTTP/1.1
  poweredByHeader: false,
  compress: false, // Disable compression to avoid HTTP/2 issues
  // Optimize chunk splitting to prevent HTTP/2 issues while maintaining performance
  webpack: (config, { isServer, dev }) => {
    if (!isServer && !dev) {
      // More aggressive chunk splitting to prevent HTTP/2 issues
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 30000,
        maxSize: 100000, // Smaller chunks to reduce HTTP/2 issues
        maxAsyncRequests: 10,
        maxInitialRequests: 10,
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
            maxSize: 100000,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: -10,
            chunks: 'all',
            maxSize: 100000,
            enforce: true,
          },
          common: {
            name: 'common',
            minChunks: 2,
            priority: -5,
            reuseExistingChunk: true,
            maxSize: 100000,
          },
          // Separate React chunks to prevent large bundles
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react',
            priority: 20,
            chunks: 'all',
            maxSize: 80000,
            enforce: true,
          },
          // Separate Next.js chunks
          nextjs: {
            test: /[\\/]node_modules[\\/](next)[\\/]/,
            name: 'nextjs',
            priority: 15,
            chunks: 'all',
            maxSize: 80000,
            enforce: true,
          },
        },
      };
      
      // Keep runtime chunk for better caching
      config.optimization.runtimeChunk = {
        name: 'runtime',
      };
      
      // Add more aggressive optimization
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
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
              {
                key: 'Cache-Control',
                value: 'public, max-age=31536000, immutable'
              },
              // Use HTTP/1.1 compatible headers to avoid protocol errors
              {
                key: 'Connection',
                value: 'keep-alive'
              },
              {
                key: 'Keep-Alive',
                value: 'timeout=5, max=1000'
              },
              {
                key: 'X-Content-Type-Options',
                value: 'nosniff'
              },
              {
                key: 'X-Frame-Options',
                value: 'SAMEORIGIN'
              }
        ]
      }
    ];
  }
};

module.exports = withBundleAnalyzer(nextConfig);
