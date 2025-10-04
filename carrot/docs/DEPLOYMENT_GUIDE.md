# Discovery System Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Carrot Patch Discovery System, including environment setup, database migrations, and production configuration.

## 🚀 **Prerequisites**

### **System Requirements**
- **Node.js**: 18.x or higher
- **PostgreSQL**: 14.x or higher
- **Redis**: 6.x or higher (optional, for caching)
- **Memory**: Minimum 2GB RAM
- **Storage**: Minimum 10GB free space

### **External Services**
- **DeepSeek API**: For Janus image generation
- **Pexels API**: For free stock images
- **Unsplash API**: For free stock images
- **Pixabay API**: For free stock images

## 🔧 **Environment Setup**

### **1. Clone Repository**
```bash
git clone https://github.com/your-org/carrot-patch.git
cd carrot-patch
```

### **2. Install Dependencies**
```bash
npm install
# or
yarn install
```

### **3. Environment Variables**

Create `.env.local` file:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/carrot_patch"

# NextAuth
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# AI Image Generation
JANUS_API_BASE="https://api.deepseek.com"
JANUS_API_KEY="your_janus_api_key"

# Free Image APIs
PEXELS_API_KEY="your_pexels_api_key"
UNSPLASH_ACCESS_KEY="your_unsplash_access_key"
PIXABAY_API_KEY="your_pixabay_api_key"

# Optional: DeepSeek fallback
DEEPSEEK_API_KEY="your_deepseek_api_key"
DEEPSEEK_API_BASE="https://api.deepseek.com"

# Redis (optional)
REDIS_URL="redis://localhost:6379"

# Feature Flags
ENABLE_AI_IMAGES="true"
ENABLE_FREE_APIS="true"
ENABLE_SAFE_EXTRACTION="true"
ENABLE_BATCH_PROCESSING="true"

# Rate Limiting
RATE_LIMIT_PER_HOUR="1000"
MAX_ITEMS_PER_BATCH="50"

# Logging
LOG_LEVEL="info"
ENABLE_DEBUG_LOGS="false"
```

### **4. Database Setup**

#### **Install PostgreSQL**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS
brew install postgresql
brew services start postgresql

# Windows
# Download from https://www.postgresql.org/download/windows/
```

#### **Create Database**
```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE carrot_patch;
CREATE USER carrot_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE carrot_patch TO carrot_user;
\q
```

#### **Run Migrations**
```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma db push

# Optional: Seed database
npx prisma db seed
```

## 🏗️ **Development Setup**

### **1. Start Development Server**
```bash
npm run dev
# or
yarn dev
```

### **2. Verify Installation**
- Open http://localhost:3000
- Check database connection
- Test discovery functionality
- Verify image generation

### **3. Run Tests**
```bash
npm run test
# or
yarn test
```

## 🚀 **Production Deployment**

### **Option 1: Vercel (Recommended)**

#### **1. Connect Repository**
- Go to [Vercel Dashboard](https://vercel.com/dashboard)
- Click "New Project"
- Import your Git repository

#### **2. Configure Environment Variables**
In Vercel dashboard, add all environment variables from `.env.local`

#### **3. Configure Build Settings**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "installCommand": "npm install"
}
```

#### **4. Deploy**
- Click "Deploy"
- Wait for build to complete
- Test production deployment

### **Option 2: Docker**

#### **1. Create Dockerfile**
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
```

#### **2. Create docker-compose.yml**
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://carrot_user:password@db:5432/carrot_patch
      - NEXTAUTH_SECRET=your-nextauth-secret
      - NEXTAUTH_URL=http://localhost:3000
    depends_on:
      - db
      - redis

  db:
    image: postgres:14
    environment:
      - POSTGRES_DB=carrot_patch
      - POSTGRES_USER=carrot_user
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:6-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

#### **3. Deploy with Docker**
```bash
# Build and start services
docker-compose up -d

# Check logs
docker-compose logs -f app

# Stop services
docker-compose down
```

### **Option 3: Traditional Server**

#### **1. Server Setup**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx
```

#### **2. Application Setup**
```bash
# Clone repository
git clone https://github.com/your-org/carrot-patch.git
cd carrot-patch

# Install dependencies
npm install

# Build application
npm run build

# Start with PM2
pm2 start npm --name "carrot-patch" -- start
pm2 save
pm2 startup
```

#### **3. Nginx Configuration**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔐 **Security Configuration**

### **1. Environment Security**
```bash
# Use strong secrets
NEXTAUTH_SECRET="$(openssl rand -base64 32)"

# Restrict database access
DATABASE_URL="postgresql://carrot_user:strong_password@localhost:5432/carrot_patch"

# Use HTTPS in production
NEXTAUTH_URL="https://your-domain.com"
```

### **2. API Security**
```typescript
// Rate limiting middleware
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
});

app.use('/api/', limiter);
```

### **3. Database Security**
```sql
-- Create read-only user for analytics
CREATE USER carrot_readonly WITH PASSWORD 'readonly_password';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO carrot_readonly;

-- Enable SSL
ALTER SYSTEM SET ssl = on;
```

## 📊 **Monitoring & Logging**

### **1. Application Monitoring**
```bash
# Install monitoring tools
npm install --save @sentry/nextjs

# Configure Sentry
SENTRY_DSN="your-sentry-dsn"
SENTRY_ORG="your-org"
SENTRY_PROJECT="carrot-patch"
```

### **2. Database Monitoring**
```bash
# Install database monitoring
npm install --save @datadog/db

# Configure monitoring
DD_API_KEY="your-datadog-api-key"
DD_SERVICE="carrot-patch"
```

### **3. Logging Configuration**
```typescript
// logger.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

export default logger;
```

## 🔄 **CI/CD Pipeline**

### **GitHub Actions**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

## 🚨 **Troubleshooting**

### **Common Issues**

#### **Database Connection Failed**
```bash
# Check database status
sudo systemctl status postgresql

# Check connection
psql -h localhost -U carrot_user -d carrot_patch

# Reset database
npx prisma db push --force-reset
```

#### **API Rate Limits**
```bash
# Check API usage
curl -H "Authorization: Bearer $API_KEY" https://api.example.com/usage

# Implement backoff
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
```

#### **Image Generation Failed**
```bash
# Check API keys
echo $JANUS_API_KEY
echo $PEXELS_API_KEY

# Test API connectivity
curl -H "Authorization: Bearer $JANUS_API_KEY" https://api.deepseek.com/v1/models
```

### **Performance Issues**

#### **Slow Database Queries**
```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Add indexes
CREATE INDEX idx_discovered_content_patch_id ON discovered_content(patch_id);
CREATE INDEX idx_discovered_content_status ON discovered_content(status);
```

#### **Memory Usage**
```bash
# Monitor memory usage
pm2 monit

# Restart if needed
pm2 restart carrot-patch
```

## 📈 **Scaling**

### **Horizontal Scaling**
```yaml
# docker-compose.yml
services:
  app:
    build: .
    deploy:
      replicas: 3
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/carrot_patch
      - REDIS_URL=redis://redis:6379
```

### **Database Scaling**
```bash
# Read replicas
DATABASE_READ_URL="postgresql://readonly:pass@read-replica:5432/carrot_patch"
DATABASE_WRITE_URL="postgresql://user:pass@master:5432/carrot_patch"
```

### **Caching Strategy**
```typescript
// Redis caching
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

const cacheKey = `discovery:${patchId}:${status}`;
const cached = await redis.get(cacheKey);

if (cached) {
  return JSON.parse(cached);
}

// Store in cache for 1 hour
await redis.setex(cacheKey, 3600, JSON.stringify(result));
```

## ✅ **Deployment Checklist**

- [ ] Environment variables configured
- [ ] Database migrations completed
- [ ] API keys obtained and configured
- [ ] SSL certificates installed
- [ ] Monitoring configured
- [ ] Backup strategy implemented
- [ ] Security measures in place
- [ ] Performance testing completed
- [ ] Documentation updated
- [ ] Team trained on deployment process

This deployment guide ensures a smooth and secure deployment of the Carrot Patch Discovery System.
