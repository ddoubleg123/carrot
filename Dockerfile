FROM node:20-bookworm-slim
WORKDIR /app

# Install system dependencies + ffmpeg
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl ffmpeg \
  && rm -rf /var/lib/apt/lists/*

# Optional cache bust arg (used to trigger CI builds when needed)
ARG CACHEBUST=2
RUN echo "cachebust=$CACHEBUST"

# Install yt-dlp static binary into /usr/local/bin
RUN curl -L "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" \
     -o /usr/local/bin/yt-dlp \
 && chmod a+rx /usr/local/bin/yt-dlp

# Fail fast if tools aren't present
RUN ffmpeg -version && yt-dlp --version

# Copy package files and install dependencies
COPY package*.json ./
RUN if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then \
      npm ci --omit=dev; \
    else \
      npm install --omit=dev; \
    fi

# Copy source code
COPY src/ ./src/

# Note: Using YT_DLP_COOKIES_FROM_BROWSER for automated cookie detection

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/healthz || exit 1

# Environment and port
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

# Run as non-root user (binaries are world-executable)
USER node

# Start the application
CMD ["node", "src/index.js"]
