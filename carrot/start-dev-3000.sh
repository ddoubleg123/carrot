#!/bin/bash
# Start the development server on port 3000
echo "Starting development server on port 3000..."
export NEXTAUTH_URL=http://localhost:3000
npx next dev -p 3000
