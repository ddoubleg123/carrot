@echo off
echo Starting development server on port 3000...
set NEXTAUTH_URL=http://localhost:3000
npx next dev -p 3000
