# Cloud Run compatible worker image
FROM node:20-bullseye

# Install ffmpeg and yt-dlp
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
  && rm -rf /var/lib/apt/lists/* \
  && pip3 install --no-cache-dir yt-dlp

WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm install --omit=dev || true

COPY tsconfig.json ./
COPY src ./src
RUN npm run build || npx tsc -p tsconfig.json

ENV PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
