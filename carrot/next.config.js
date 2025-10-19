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
    isrFlushToDisk: false, // Disable to avoid Windows permission errors
  },
  generateBuildId: async () => {
    return 'build-' + Date.now()
  },
  // Move serverComponentsExternalPackages to root level
  serverExternalPackages: [],
  // Disable HTTP/2 and force HTTP/1.1
  poweredByHeader: false,
  compress: false, // Disable compression to avoid HTTP/2 issues
  // Optimize chunk splitting to prevent HTTP/2 issues while maintaining performance
  webpack: (config, { isServer, dev }) => {
    if (!isServer && !dev) {
      // More conservative chunk splitting to prevent CSS loading issues
      config.optimization.splitChunks = {
        chunks: 'all',
        minSize: 20000,
        maxSize: 244000, // Even larger chunks to reduce fragmentation
        maxAsyncRequests: 5, // Further reduced to prevent too many concurrent requests
        maxInitialRequests: 4, // Further reduced to prevent too many concurrent requests
        cacheGroups: {
          default: false, // Disable default cache group
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: -10,
            chunks: 'all',
            maxSize: 244000,
            enforce: true,
          },
          // Separate React chunks to prevent large bundles
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react',
            priority: 20,
            chunks: 'all',
            maxSize: 200000,
            enforce: true,
          },
          // Separate Next.js chunks
          nextjs: {
            test: /[\\/]node_modules[\\/](next)[\\/]/,
            name: 'nextjs',
            priority: 15,
            chunks: 'all',
            maxSize: 200000,
            enforce: true,
          },
          // CRITICAL: Bundle ALL CSS into a single chunk to prevent loading issues
          styles: {
            test: /\.(css|scss|sass)$/,
            name: 'styles',
            priority: 30,
            chunks: 'all',
            enforce: true,
            // No maxSize limit for CSS - bundle it all together
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
      'upload.wikimedia.org',
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
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
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
      // Static assets - aggressive caching (Next.js handles Content-Type automatically)
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      // HTML pages and API routes - CSP and security headers  
      {
        source: '/((?!_next/static|_next/image|favicon.ico|robots.txt).*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.knightlab.com",
              "style-src 'self' 'unsafe-inline' https://cdn.knightlab.com",
              "font-src 'self' https://cdn.knightlab.com https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://lh3.googleusercontent.com https://firebasestorage.googleapis.com https://storage.googleapis.com https://images.unsplash.com https://media.giphy.com https://*.giphy.com https://media.tenor.com https://*.tenor.com https://c.tenor.com https://media1.tenor.com https://media2.tenor.com https://media3.tenor.com https://media4.tenor.com https://media5.tenor.com https://cdnjs.cloudflare.com https://ui-avatars.com https://upload.wikimedia.org https://www.google.com https://*.gstatic.com",
              "media-src 'self' blob: data: https://firebasestorage.googleapis.com https://storage.googleapis.com https://*.firebasestorage.app https://commondatastorage.googleapis.com https://www.youtube.com https://youtube.com https://*.youtube.com https://*.googlevideo.com https://media.giphy.com https://*.giphy.com https://media.tenor.com https://*.tenor.com https://c.tenor.com https://media0.giphy.com https://media1.giphy.com https://media2.giphy.com https://media3.giphy.com https://media4.giphy.com https://media5.giphy.com https://www.soundhelix.com",
              "connect-src 'self' blob: https://*.googleapis.com https://firebasestorage.googleapis.com https://storage.googleapis.com https://api.giphy.com https://tenor.googleapis.com https://huggingface.co https://*.huggingface.co https://cdn-lfs.huggingface.co https://cdn.knightlab.com",
              "frame-ancestors 'self'"
            ].join('; ')
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
