#!/bin/bash

# Discovery System Deployment Script
# Automates the deployment of the Enhanced Discovery System

set -e  # Exit on error

echo "🚀 Starting Discovery System Deployment..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Check prerequisites
echo -e "${YELLOW}Step 1/6: Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 20.x${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js found: $(node --version)${NC}"

# Check Redis
if ! command -v redis-cli &> /dev/null; then
    echo -e "${RED}❌ Redis not found. Please install Redis${NC}"
    exit 1
fi

# Test Redis connection
if ! redis-cli ping &> /dev/null; then
    echo -e "${RED}❌ Redis not running. Please start Redis server${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Redis is running${NC}"

# Check npm packages
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing npm packages...${NC}"
    npm install
fi
echo -e "${GREEN}✓ npm packages installed${NC}"

echo ""

# Step 2: Install ioredis if not present
echo -e "${YELLOW}Step 2/6: Checking Redis client...${NC}"
if ! npm list ioredis &> /dev/null; then
    echo -e "${YELLOW}Installing ioredis...${NC}"
    npm install ioredis
fi
echo -e "${GREEN}✓ ioredis installed${NC}"

echo ""

# Step 3: Verify environment variables
echo -e "${YELLOW}Step 3/6: Verifying environment variables...${NC}"

if [ ! -f ".env.local" ]; then
    echo -e "${RED}❌ .env.local not found${NC}"
    echo "Creating .env.local with default values..."
    cat > .env.local << EOF
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=

# Discovery Configuration
ENABLE_DISCOVERY_STREAM_UI=true
EOF
fi

# Check for required variables
required_vars=("REDIS_HOST" "REDIS_PORT")
for var in "${required_vars[@]}"; do
    if ! grep -q "$var" .env.local; then
        echo -e "${RED}❌ Missing $var in .env.local${NC}"
        exit 1
    fi
done
echo -e "${GREEN}✓ Environment variables configured${NC}"

echo ""

# Step 4: Run database migration
echo -e "${YELLOW}Step 4/6: Running database migration...${NC}"
echo "This will add new fields and tables to the database..."

if npx tsx scripts/migrate-discovery.ts; then
    echo -e "${GREEN}✓ Database migration completed${NC}"
else
    echo -e "${RED}❌ Database migration failed${NC}"
    exit 1
fi

echo ""

# Step 5: Test Redis connection from Node
echo -e "${YELLOW}Step 5/6: Testing Redis connection...${NC}"

node -e "
const Redis = require('ioredis');
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  db: parseInt(process.env.REDIS_DB || '0')
});

redis.ping()
  .then(() => {
    console.log('✓ Redis connection successful');
    redis.quit();
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Redis connection failed:', error.message);
    process.exit(1);
  });
"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Redis connection test passed${NC}"
else
    echo -e "${RED}❌ Redis connection test failed${NC}"
    exit 1
fi

echo ""

# Step 6: Build and start the application
echo -e "${YELLOW}Step 6/6: Building application...${NC}"

if npm run build; then
    echo -e "${GREEN}✓ Build completed successfully${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Discovery System Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Start the development server: npm run dev"
echo "2. Open browser: http://localhost:3005/patch/chicago-bulls"
echo "3. Click 'Start Discovery' to test the system"
echo "4. Monitor console for metrics and logs"
echo ""
echo "Documentation:"
echo "- README: docs/DISCOVERY-SYSTEM-README.md"
echo "- Testing: docs/DISCOVERY-SYSTEM-TESTING.md"
echo ""
echo -e "${GREEN}Happy discovering! 🚀${NC}"
