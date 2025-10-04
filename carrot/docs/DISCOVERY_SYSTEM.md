# Carrot Patch Discovery System

## Overview

The Carrot Patch Discovery System is a comprehensive content enrichment platform that transforms discovered URLs into rich, educational, and visually stunning content experiences. The system provides both substance (summaries, key points, quotes) and beauty (hero visuals, clean hierarchy) for every discovered item.

## 🎯 **Core Principles**

### **Two Non-Negotiables:**
1. **Every item has substance** - summary, key points, quote, or transcript excerpt
2. **Every item is beautiful** - hero visual, clean hierarchy, consistent chrome

### **Design Philosophy:**
- **Refactoring UI** principles applied throughout
- **Consistent paddings** (24–32px), no text hugging edges
- **Clear contrast** - title 600, summary 400; Slate for body; Ink for strong
- **Subtle shadows**, 2xl radii, Line #E6E8EC borders
- **Hover raises** card slightly; focus ring visible

## 🏗️ **System Architecture**

### **Backend Pipeline**
```
URL → Fetcher → Enricher → Moderation → Ranker → Ready
```

#### **1. Fetcher**
- Resolves redirects, computes `canonicalUrl`
- Pulls OG/Twitter tags
- Extracts full text using Readability algorithm
- For YouTube/Vimeo: fetches title, duration, thumb, captions

#### **2. Enricher**
- **Content Processing:**
  - `summary150`: ~120–180 chars single paragraph
  - `keyPoints`: 3–5 bullets (≤12 words each)
  - `notableQuote`: ≤160 chars, with who/where
  - `readingTime`: words/200
  - `entities`: top 5 (teams/people/places)
  - `tags`: from title/body/entities
  - `citation`: build via citation-js fields

- **Visual Processing:**
  - `hero`: prefer OG:image (min 800×450)
  - `gallery[]`: collect inline images (cap 4)
  - `videoThumb`: highest-res thumb
  - `pdfPreview`: first page thumb

#### **3. Moderation/Audit**
- Flags potential issues (NSFW, paywall, broken, duplicate canonical)
- Marks as `requires_review` when needed

#### **4. Ranker**
- `relevanceScore` (topic keywords + embeddings)
- `qualityScore` (length, media, author, domain)
- `freshnessScore` (recency)
- `diversityBucket` (domain/type)
- Final: `score = 0.4*rel + 0.25*qual + 0.2*fresh + 0.15*diversity`

### **Database Schema**

```sql
model DiscoveredContent {
  id              String   @id @default(cuid())
  patchId         String   @map("patch_id")
  type            String   // 'article' | 'video' | 'pdf' | 'post'
  title           String
  content         String   // Legacy field
  relevanceScore  Int      @map("relevance_score")
  sourceUrl       String?  @map("source_url")
  canonicalUrl    String?  @map("canonical_url")
  tags            String[]
  status          String   @default("queued") // 'queued' | 'fetching' | 'enriching' | 'ready' | 'failed' | 'requires_review'
  
  // Enriched content data
  enrichedContent Json?    @map("enriched_content")
  mediaAssets     Json?    @map("media_assets")
  metadata        Json?    @map("metadata")
  qualityScore    Float?   @map("quality_score")
  freshnessScore  Float?   @map("freshness_score")
  diversityBucket String?  @map("diversity_bucket")
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  patch Patch @relation(fields: [patchId], references: [id], onDelete: Cascade)
}
```

## 🎨 **Frontend Components**

### **DiscoveryCard Component**
Rich visual hierarchy with:
- **Hero Image** (16:9, rounded-xl)
- **Type Badge** (top-left)
- **Match Percentage** (top-right)
- **Content Block** (title, summary, key points, quote)
- **Metadata Row** (source, author, date, reading time)
- **Action Row** (Open, Attach →, Discuss, Save)

### **DiscoveringContent Component**
- **Section Header**: "Discovering content · LIVE"
- **Masonry/Grid Layout**: Two-column desktop, single column mobile
- **Sticky Right Rail**: Followers, AI Agents
- **Skeleton Loaders**: Beautiful loading states
- **Sorting/Filtering**: Top, New, Sources-only, Videos-only

## 🖼️ **Image Strategy**

### **5-Tier Fallback System**
1. **Janus AI** - Copyright-free generated images
2. **Free APIs** - Pexels, Unsplash, Pixabay
3. **Public Domain** - Wikimedia, NASA
4. **Safe Extraction** - CC-licensed only
5. **Generated Fallback** - UI Avatars

### **Legal Compliance**
- All sources verified for commercial use
- Automatic attribution handling
- License verification and tracking
- No copyright infringement risk

## 🔌 **API Endpoints**

### **Content Processing**
- `POST /api/patch/[handle]/discover/enrich` - Process queued items
- `GET /api/patch/[handle]/discover?status=ready&cursor=` - Paginated results
- `POST /api/patch/[handle]/discover/:id/attach` - Attach to timeline/facts/sources

### **Discovery**
- `GET /api/patches/[handle]/discovered-content` - Get discovered content
- `POST /api/patches/[handle]/discovered-content` - Start discovery

## 🎯 **Content Types**

### **Articles**
- Extract main content using readability
- Generate AI summary and key points
- Extract notable quotes
- Calculate reading time

### **Videos**
- Extract YouTube metadata
- Generate video-specific summaries
- Extract thumbnails and captions
- Calculate duration and engagement

### **PDFs**
- Extract first page preview
- Generate document summaries
- Extract metadata and citations
- Calculate page count and complexity

### **Posts**
- Extract social media content
- Generate engagement summaries
- Extract media attachments
- Calculate social metrics

## 📊 **Quality Metrics**

### **Content Quality**
- **Length**: Minimum 200 words or transcript
- **Media**: Hero image, gallery, thumbnails
- **Metadata**: Author, date, source, tags
- **Engagement**: Reading time, key points

### **Visual Quality**
- **Resolution**: Minimum 800×450 (16:9)
- **Format**: JPG, PNG, WebP optimized
- **Size**: Under 500KB for web
- **Relevance**: Matches content theme

### **User Experience**
- **Loading**: Skeleton states during processing
- **Progress**: Status chips and progress bars
- **Actions**: Open, Attach, Discuss, Save
- **Responsive**: Mobile-first design

## 🚀 **Performance Optimization**

### **Backend**
- **Parallel Processing**: Multiple items simultaneously
- **Caching**: Store processed results
- **Rate Limiting**: Respect API limits
- **Error Handling**: Graceful fallbacks

### **Frontend**
- **Lazy Loading**: Images load on demand
- **Virtual Scrolling**: Handle large lists
- **Optimistic Updates**: Immediate feedback
- **Progressive Enhancement**: Works without JS

## 🔧 **Configuration**

### **Environment Variables**
```bash
# AI Image Generation
JANUS_API_BASE=https://api.deepseek.com
JANUS_API_KEY=your_janus_api_key

# Free Image APIs
PEXELS_API_KEY=your_pexels_api_key
UNSPLASH_ACCESS_KEY=your_unsplash_access_key
PIXABAY_API_KEY=your_pixabay_api_key

# Content Processing
DEEPSEEK_API_KEY=your_deepseek_api_key
```

### **Feature Flags**
- `ENABLE_AI_IMAGES`: Toggle Janus image generation
- `ENABLE_FREE_APIS`: Toggle free image APIs
- `ENABLE_SAFE_EXTRACTION`: Toggle safe image extraction
- `ENABLE_BATCH_PROCESSING`: Toggle batch enrichment

## 📈 **Analytics & Monitoring**

### **Key Metrics**
- **Processing Success Rate**: Items successfully enriched
- **Image Quality Score**: Visual relevance and quality
- **User Engagement**: Click-through rates, time spent
- **API Usage**: Rate limits, costs, performance

### **Error Tracking**
- **Processing Failures**: Content extraction errors
- **Image Failures**: Generation and extraction errors
- **API Errors**: Rate limits, authentication, network
- **User Errors**: Invalid inputs, permissions

## 🛡️ **Security & Compliance**

### **Data Protection**
- **URL Sanitization**: Clean and validate inputs
- **Content Filtering**: Remove malicious content
- **Rate Limiting**: Prevent abuse
- **Authentication**: Secure API access

### **Legal Compliance**
- **Copyright**: All images legally compliant
- **Attribution**: Proper credit where required
- **Privacy**: No personal data collection
- **Terms**: Respect source site terms

## 🔄 **Workflow**

### **Discovery Process**
1. **URL Submission** → Queue for processing
2. **Content Fetching** → Extract text and metadata
3. **AI Enrichment** → Generate summaries and images
4. **Quality Check** → Verify content and media
5. **Ranking** → Score and prioritize
6. **Display** → Show in discovery interface

### **User Interaction**
1. **Browse** → View discovered content
2. **Filter** → By type, date, relevance
3. **Sort** → By score, date, quality
4. **Interact** → Open, attach, discuss, save
5. **Engage** → Read, share, bookmark

## 🎨 **Design System**

### **Colors (Carrot Tokens)**
- **Action Orange**: #FF6A00
- **Civic Blue**: #0A5AFF
- **Ink**: #0B0B0F
- **Slate**: #60646C
- **Line**: #E6E8EC
- **Surface**: #FFFFFF

### **Typography**
- **Headings**: 600 weight, clear hierarchy
- **Body**: 400 weight, readable line height
- **Captions**: 12px, subtle color
- **Labels**: 14px, medium weight

### **Spacing**
- **Card Padding**: 24-32px
- **Element Spacing**: 16px base unit
- **Grid Gaps**: 24px desktop, 16px mobile
- **Section Margins**: 48px vertical

## 🚀 **Future Enhancements**

### **AI Improvements**
- **Custom Models**: Train on Carrot-specific content
- **Better Summaries**: More accurate and engaging
- **Smart Tagging**: Automatic categorization
- **Sentiment Analysis**: Content tone and mood

### **Visual Enhancements**
- **Lightbox Gallery**: Full-screen image viewing
- **Video Modals**: Inline video playback
- **PDF Preview**: Document viewing
- **Interactive Elements**: Hover effects, animations

### **User Experience**
- **Personalization**: Custom content preferences
- **Collaboration**: Share and discuss content
- **Bookmarking**: Save for later
- **Recommendations**: AI-powered suggestions

This comprehensive discovery system transforms simple URLs into rich, educational, and visually stunning content experiences that users will love to explore and engage with.
