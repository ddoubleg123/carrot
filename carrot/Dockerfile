# Use Node.js 20 LTS
FROM node:20-bookworm-slim

# Set working directory
WORKDIR /app

# Install system dependencies. Quote cards are rendered here, not on a laptop.
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    ffmpeg \
    tesseract-ocr \
    python3 \
    python3-pil \
    python3-numpy \
    python3-opencv \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN pip3 install --break-system-packages playwright pytesseract \
    && python3 -m playwright install --with-deps chromium \
    && chmod -R 755 /ms-playwright

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Create non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs nodejs
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 10000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=10000
ENV HTTP2_DISABLED=true
ENV NEXT_TELEMETRY_DISABLED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:10000/api/health || exit 1

# Start the application
CMD ["npm", "start"]