# Carrot Patch Redesign

A clean, minimal, repository-first design for the Carrot "Patch → Group Detail" page, transforming it into a Reddit/Wikipedia-style knowledge hub.

## 🎯 Design Philosophy

- **Clean & Minimal**: Sparse copy, timeless information over chatter
- **Repository-First**: Prioritizes facts, timeline, and sources over discussion
- **AI Agent Support**: Contextual tools for content creation and management
- **Performance-Focused**: Fast first paint, lazy loading, optimistic updates

## 🎨 Design System

### Color Tokens
```typescript
const tokens = {
  colors: {
    actionOrange: '#FF6A00',  // Primary actions, "Ending Soon" badges
    civicBlue: '#0A5AFF',     // Primary buttons, links
    ink: '#0B0B0F',           // Headings, primary text
    slate: '#60646C',         // Secondary text
    line: '#E6E8EC',          // Borders, dividers
    surface: '#FFFFFF',       // Card backgrounds
  }
}
```

### Background Variants
```typescript
const patchThemes = {
  light: "bg-[linear-gradient(180deg,#FFFFFF,rgba(10,90,255,0.03))]",
  warm:  "bg-[linear-gradient(180deg,#FFFFFF,rgba(255,106,0,0.04))]",
  stone: "bg-[linear-gradient(180deg,#FFFFFF,#F7F8FA)]",
}
```

### Typography & Spacing
- **Radii**: `lg` (8px), `xl` (16px), `2xl` (16px)
- **Motion**: Tap 120ms, Enter 180ms, Exit 160ms
- **Card Padding**: 16-24px
- **Section Gap**: 2rem

## 🏗️ Architecture

### Page Layout
```
┌─────────────────────────────────────────────────────────┐
│ Header (72-88px) - Name, tagline, tags, Join button    │
├─────────────────────────────────────────────────────────┤
│ Metric Bar - Members, Posts, Events, Sources           │
├─────────────────────────────────────────────────────────┤
│ Sticky Pill Nav - Overview · Timeline · Resources · Posts │
├─────────────────────────────────────────────────────────┤
│ Two-Column Layout                                      │
│ ┌─────────────────────┬─────────────────────────────┐   │
│ │ Main Column (3/4)   │ Sidebar (1/4)              │   │
│ │ - Tab Content       │ - Fact Sheet (infobox)     │   │
│ │ - Timeline/Posts    │ - Quick Actions            │   │
│ │ - Resources         │ - Top Contributors         │   │
│ └─────────────────────┴─────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Components

#### Core Components
- **`PatchHeader`**: Compact header with name, tagline, tags, and actions
- **`MetricBar`**: Statistics display below header
- **`PillNav`**: Sticky navigation with URL state management
- **`FactSheet`**: Wikipedia-style infobox sidebar
- **`Overview`**: Key facts grid and recent activity
- **`TimelineView`**: Chronological events with filters
- **`ResourcesList`**: Searchable sources with citation copying
- **`PostFeed`**: Discussion posts (reused from existing)
- **`AIAgentDock`**: Floating rail with contextual tools

#### UI Components
- **`Sheet`**: Radix-based modal/sidebar component
- **`Input`**: Styled form input
- **`Textarea`**: Multi-line text input
- **`Badge`**: Status and tag indicators
- **`Button`**: Action buttons with variants

## 📊 Data Models

### Patch Schema
```prisma
model Patch {
  id          String   @id @default(cuid())
  handle      String   @unique
  name        String
  tagline     String?  // Short one-liner for header
  description String
  rules       String?
  tags        String[]
  theme       String?  // 'light' | 'warm' | 'stone'
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Relations
  creator User @relation("PatchCreator", fields: [createdBy], references: [id])
  facts   Fact[]
  events  Event[]
  sources Source[]
  posts   PatchPost[]
  members PatchMember[]
}
```

### Supporting Models
- **`Fact`**: Key information with optional source attribution
- **`Event`**: Timeline entries with media and source references
- **`Source`**: References with citation metadata
- **`PatchPost`**: Discussion posts with engagement metrics
- **`PatchMember`**: User memberships with roles

## 🚀 Features

### Timeline View
- **Filters**: Search, tags, date range
- **View Modes**: Compact vs expanded
- **Media Support**: Images and videos
- **Source Attribution**: Linked references
- **Chronological Order**: Events sorted by date

### Resources List
- **Search**: Full-text search across titles, authors, URLs
- **Citation Copying**: One-click citation generation
- **Favicon Display**: Visual domain identification
- **Deduplication**: Canonical URL handling

### AI Agent Dock
- **Floating Rail**: Right-edge contextual tools
- **Agent Types**:
  - **Summarize**: Content summarization
  - **Add Fact**: Key information entry
  - **Add Event**: Timeline entry creation
  - **Find Sources**: Reference discovery
- **Sheet Forms**: Modal-based input interfaces
- **Mock Actions**: Server action placeholders

### Theme System
- **Background Variants**: Subtle gradients per patch
- **Card Contrast**: White cards on themed backgrounds
- **Consistent Spacing**: Design system compliance
- **Accessibility**: High contrast, reduced motion support

## 🛠️ Development

### Setup
```bash
# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev

# Seed sample data
npx tsx prisma/seed-patch-redesign.ts

# Start development server
npm run dev
```

### File Structure
```
src/
├── app/(app)/patch/
│   ├── [handle]/page.tsx          # Main patch page
│   └── page.tsx                   # Patch listing
├── components/patch/
│   ├── PatchHeader.tsx            # Header component
│   ├── PillNav.tsx                # Sticky navigation
│   ├── FactSheet.tsx              # Sidebar infobox
│   ├── Overview.tsx               # Overview tab
│   ├── TimelineView.tsx           # Timeline with filters
│   ├── ResourcesList.tsx          # Sources management
│   └── AIAgentDock.tsx            # AI tools rail
├── lib/
│   └── patch-theme.ts             # Theme system
└── styles/
    └── cards.ts                   # Card styling utilities
```

### Key Dependencies
- **Next.js 14**: App Router, Server Components
- **TypeScript**: Type safety
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: Component library
- **Radix UI**: Accessible primitives
- **Prisma**: Database ORM
- **PostgreSQL**: Database with pgvector

## 🎯 Usage Examples

### Switching Background Themes
```typescript
// In patch creation/editing
const patch = await prisma.patch.create({
  data: {
    // ... other fields
    theme: 'warm', // 'light' | 'warm' | 'stone'
  }
})

// In component
const themeClass = getPatchThemeClass(patch.theme)
<div className={`min-h-screen ${themeClass}`}>
```

### Adding Facts with Sources
```typescript
// Create fact with source attribution
await prisma.fact.create({
  data: {
    patchId: patch.id,
    label: 'Population',
    value: '8.1 million residents',
    sourceId: source.id, // Optional source reference
  }
})
```

### Timeline Event Creation
```typescript
// Create timeline event
await prisma.event.create({
  data: {
    patchId: patch.id,
    title: 'Constitutional Amendment Ratified',
    dateStart: new Date('1951-02-27'),
    summary: 'The 22nd Amendment was ratified...',
    tags: ['constitutional', 'presidential'],
    sourceIds: [source1.id, source2.id],
  }
})
```

## 🚀 Deployment

### Database Migration
```bash
# Push schema changes
npx prisma db push

# Or create migration
npx prisma migrate dev --name patch-redesign
```

### Environment Variables
```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="..."
```

### Build & Deploy
```bash
# Build for production
npm run build

# Start production server
npm start
```

## 🎨 Customization

### Adding New Themes
```typescript
// In lib/patch-theme.ts
export const patchThemes = {
  light: "bg-[linear-gradient(180deg,#FFFFFF,rgba(10,90,255,0.03))]",
  warm:  "bg-[linear-gradient(180deg,#FFFFFF,rgba(255,106,0,0.04))]",
  stone: "bg-[linear-gradient(180deg,#FFFFFF,#F7F8FA)]",
  // Add new theme
  ocean: "bg-[linear-gradient(180deg,#FFFFFF,rgba(0,150,255,0.02))]",
} as const;
```

### Customizing Card Styles
```typescript
// In styles/cards.ts
export const cardVariants = {
  default: cn(cardStyles.base, cardStyles.padding),
  interactive: cn(cardStyles.base, cardStyles.padding, cardStyles.interactive),
  compact: cn(cardStyles.base, "p-4"),
  sidebar: cn(cardStyles.base, "p-4"),
  // Add custom variant
  featured: cn(cardStyles.base, "p-6 border-2 border-[#0A5AFF]"),
} as const;
```

## 📈 Performance

### Optimizations
- **Server Components**: Reduced client-side JavaScript
- **Lazy Loading**: Timeline and resources lists
- **Image Optimization**: Next.js Image component
- **Database Indexing**: Optimized queries
- **Caching**: Redis for frequently accessed data

### Metrics
- **Lighthouse Score**: 90+ target
- **First Paint**: < 1.5s
- **Time to Interactive**: < 3s
- **Bundle Size**: < 500KB gzipped

## 🔧 Troubleshooting

### Common Issues

1. **Theme not applying**: Check `getPatchThemeClass()` function
2. **Timeline filters not working**: Verify event data structure
3. **AI dock not opening**: Check Radix UI Sheet component
4. **Citation copying fails**: Ensure HTTPS context

### Debug Mode
```typescript
// Enable debug logging
const DEBUG = process.env.NODE_ENV === 'development'
if (DEBUG) console.log('Patch data:', patch)
```

## 📝 License

This patch redesign is part of the Carrot project and follows the same licensing terms.

---

**Built with ❤️ for the Carrot community**
