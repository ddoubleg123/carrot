# Carrot App Documentation

Welcome to the Carrot application documentation. This folder contains comprehensive guides for understanding, developing, and maintaining the Carrot social platform.

## 📚 Documentation Index

### 🎨 Design & UI
- **[DESIGN_PLAN.md](./DESIGN_PLAN.md)** - Complete design system, color tokens, typography, and component patterns
- **[STYLES_README.md](./STYLES_README.md)** - Design token system, CSS custom properties, and styling guidelines
- **[FEED_MEDIA_DESIGN.md](./FEED_MEDIA_DESIGN.md)** - Media preloading, video playback, and feed optimization

### 🤖 AI & Automation
- **[AGENT_AUTO_JOIN_LOGIC.md](./AGENT_AUTO_JOIN_LOGIC.md)** - Smart agent matching system for the Rabbit AI Council

### 🔧 Services & Infrastructure
- **[TRANSCRIPTION_SERVICE.md](./TRANSCRIPTION_SERVICE.md)** - Vosk speech-to-text service deployment and configuration

### 📋 Project Management
- **[ONBOARDING_MILESTONE.md](./ONBOARDING_MILESTONE.md)** - Onboarding flow implementation milestones

## 🚀 Quick Start

### Development Setup
```bash
# Install dependencies
npm ci

# Start development server
npm run dev

# Health checks
curl http://localhost:3000/api/healthz
```

### Key Endpoints
- **Health**: `/api/healthz`
- **Media Health**: `/api/healthz/media`
- **Schema Health**: `/api/dev/admin/schema-health` (dev-only)
- **User Avatar**: `/api/me/avatar`
- **Session**: `/api/auth/session`

## 🏗️ Architecture Overview

### Core Technologies
- **Next.js 15** - React framework with App Router
- **Prisma** - Database ORM with SQLite (dev) / PostgreSQL (prod)
- **Firebase** - Authentication, Storage, and Firestore
- **Cloudflare Stream** - Video processing and delivery
- **Vosk** - Speech-to-text transcription service

### Key Features
- **Social Feed** - Video posts with automatic transcription
- **AI Council** - Smart agent matching and conversation system
- **Media Management** - Automatic video processing and optimization
- **Design System** - Consistent UI with orange-focused branding

## 📁 Project Structure

```
carrot/
├── docs/                    # 📚 All documentation
├── src/
│   ├── app/                # Next.js App Router pages
│   ├── components/         # Reusable UI components
│   ├── lib/               # Utility functions and services
│   ├── styles/            # Design tokens and CSS
│   └── types/             # TypeScript type definitions
├── public/
│   ├── agents/            # AI agent avatars
│   └── flags/             # Country flag SVGs
├── prisma/                # Database schema and migrations
└── transcription-service/ # Vosk transcription service
```

## 🎯 Key Pages & Features

### Main Application
- **Home Feed** (`/`) - Video posts with transcription
- **Carrot Patch** (`/patch`) - Knowledge sharing with Plato hero
- **Rabbit AI Council** (`/rabbit`) - AI agent conversations
- **Settings** (`/settings`) - User preferences and configuration

### AI System
- **20 AI Agents** - Historical figures with specialized expertise
- **Smart Matching** - Fuse.js-powered agent selection
- **Conversation Threads** - Multi-agent discussions
- **Learning System** - User interaction tracking for improvement

## 🔧 Development Workflow

### Database Management
```bash
# Generate Prisma client
npx prisma generate

# Run migrations (SQLite dev)
npx prisma migrate dev

# Deploy migrations (PostgreSQL prod)
npx prisma migrate deploy
```

### Design System
- Use design tokens from `src/styles/design-tokens.css`
- Follow component patterns in `DESIGN_PLAN.md`
- Maintain orange-focused color scheme
- Ensure accessibility compliance (WCAG 2.2 AA)

### AI Agent Development
- Add new agents to `src/lib/agentMatching.ts`
- Expand keyword arrays for better matching
- Test with various query types
- Monitor user interaction logs

## 🚀 Deployment

### Production Environment
- **Database**: PostgreSQL on Render
- **Hosting**: Render Node.js service
- **Storage**: Firebase Storage
- **Transcription**: Google Cloud Run (Vosk)
- **Video**: Cloudflare Stream

### Environment Variables
```bash
DATABASE_URL=postgresql://...
NEXTAUTH_URL=https://your-app.onrender.com
NEXTAUTH_SECRET=your-secret
FIREBASE_PROJECT_ID=your-project
TRANSCRIPTION_SERVICE_URL=https://vosk-service.run.app
```

## 📊 Monitoring & Health

### Health Endpoints
- **App Health**: `/api/healthz`
- **Media Health**: `/api/healthz/media`
- **Database Health**: `/api/dev/admin/schema-health`

### Key Metrics
- **Performance**: LCP, INP, CLS scores
- **Transcription**: Success rate, processing time
- **AI Matching**: Agent selection accuracy
- **User Engagement**: Feed interactions, agent usage

## 🤝 Contributing

### Code Standards
- **TypeScript** for type safety
- **ESLint** for code quality
- **Prettier** for formatting
- **Design tokens** for consistent styling

### Documentation Updates
- Update relevant docs when adding features
- Follow the established documentation structure
- Include examples and usage patterns
- Test all code examples

## 📞 Support

For questions about:
- **Design System** → See `DESIGN_PLAN.md` and `STYLES_README.md`
- **AI Agents** → See `AGENT_AUTO_JOIN_LOGIC.md`
- **Transcription** → See `TRANSCRIPTION_SERVICE.md`
- **General Development** → Check this README and individual component docs

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Maintainer**: Development Team
