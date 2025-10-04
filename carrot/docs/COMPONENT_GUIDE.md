# Discovery System Component Guide

## Overview

This guide provides detailed documentation for all React components in the Carrot Patch Discovery System, including props, usage examples, and styling guidelines.

## 🎨 **Core Components**

### **DiscoveryCard**

The main component for displaying discovered content with rich visuals and metadata.

#### **Props**
```typescript
interface DiscoveryCardProps {
  id: string;
  title: string;
  type: 'article' | 'video' | 'pdf' | 'post';
  sourceUrl?: string;
  canonicalUrl?: string;
  relevanceScore?: number;
  status: 'queued' | 'fetching' | 'enriching' | 'ready' | 'failed' | 'requires_review';
  enrichedContent?: {
    summary150?: string;
    keyPoints?: string[];
    notableQuote?: string;
    fullText?: string;
    transcript?: string;
  };
  mediaAssets?: {
    hero?: string;
    gallery?: string[];
    videoThumb?: string;
    pdfPreview?: string;
  };
  metadata?: {
    author?: string;
    publishDate?: string;
    source?: string;
    readingTime?: number;
    tags?: string[];
    entities?: string[];
    citation?: any;
  };
  qualityScore?: number;
  onAttach?: (type: 'timeline' | 'fact' | 'source') => void;
  onDiscuss?: () => void;
  onSave?: () => void;
}
```

#### **Usage Example**
```tsx
import DiscoveryCard from '@/components/patch/DiscoveryCard';

<DiscoveryCard
  id="clx1234567890"
  title="AI Revolution in Healthcare"
  type="article"
  sourceUrl="https://example.com/article"
  relevanceScore={85}
  status="ready"
  enrichedContent={{
    summary150: "This article explores how AI is transforming healthcare...",
    keyPoints: [
      "AI improves diagnostic accuracy",
      "Reduces treatment costs",
      "Enhances patient outcomes"
    ],
    notableQuote: "AI will revolutionize healthcare in the next decade"
  }}
  mediaAssets={{
    hero: "https://example.com/hero-image.jpg",
    gallery: ["https://example.com/gallery1.jpg"]
  }}
  metadata={{
    author: "Dr. Jane Smith",
    publishDate: "2024-01-15T10:30:00Z",
    source: "example.com",
    readingTime: 5,
    tags: ["AI", "Healthcare", "Technology"]
  }}
  qualityScore={0.85}
  onAttach={(type) => handleAttach(id, type)}
  onDiscuss={() => handleDiscuss(id)}
  onSave={() => handleSave(id)}
/>
```

#### **Styling**
- **Card**: `rounded-2xl border border-[#E6E8EC] bg-white shadow-sm`
- **Hero**: `aspect-[16/9] overflow-hidden rounded-xl`
- **Title**: `text-base md:text-lg font-semibold leading-6`
- **Summary**: `text-slate-700 mt-2 line-clamp-3`
- **Chips**: `text-sm rounded-full border px-2.5 py-1`
- **Meta**: `text-sm text-slate-600 flex items-center gap-3`

### **DiscoveringContent**

Main container component for the discovery interface.

#### **Props**
```typescript
interface DiscoveringContentProps {
  patchHandle: string;
}
```

#### **Features**
- **Real-time Updates**: Polls for new content
- **Sorting**: Top, Newest, Quality
- **Filtering**: All Types, Articles, Videos, PDFs, Posts
- **Grid Layout**: Responsive 2-column desktop, 1-column mobile
- **Loading States**: Skeleton loaders during processing
- **Empty States**: Helpful messages when no content

#### **Usage Example**
```tsx
import DiscoveringContent from '@/components/patch/DiscoveringContent';

<DiscoveringContent patchHandle="my-patch" />
```

#### **State Management**
```typescript
const [items, setItems] = useState<DiscoveredItem[]>([]);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [isDiscovering, setIsDiscovering] = useState(true);
const [sortBy, setSortBy] = useState<'relevance' | 'newest' | 'quality'>('relevance');
const [filterType, setFilterType] = useState<'all' | 'article' | 'video' | 'pdf' | 'post'>('all');
```

## 🎛️ **Control Components**

### **Sorting Controls**
```tsx
<div className="flex items-center gap-2">
  <SortAsc size={16} className="text-gray-500" />
  <select
    value={sortBy}
    onChange={(e) => setSortBy(e.target.value as any)}
    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
  >
    <option value="relevance">Top</option>
    <option value="newest">Newest</option>
    <option value="quality">Quality</option>
  </select>
</div>
```

### **Filtering Controls**
```tsx
<div className="flex items-center gap-2">
  <Filter size={16} className="text-gray-500" />
  <select
    value={filterType}
    onChange={(e) => setFilterType(e.target.value as any)}
    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
  >
    <option value="all">All Types</option>
    <option value="article">Articles</option>
    <option value="video">Videos</option>
    <option value="pdf">PDFs</option>
    <option value="post">Posts</option>
  </select>
</div>
```

## 🎨 **Visual Components**

### **Status Indicators**

#### **Status Chips**
```tsx
const getStatusColor = (status: string) => {
  switch (status) {
    case 'ready': return 'bg-green-100 text-green-800';
    case 'enriching': return 'bg-blue-100 text-blue-800';
    case 'fetching': return 'bg-yellow-100 text-yellow-800';
    case 'queued': return 'bg-gray-100 text-gray-800';
    case 'failed': return 'bg-red-100 text-red-800';
    case 'requires_review': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

<Badge className={`${getStatusColor(status)} capitalize`}>
  {status.replace('_', ' ')}
</Badge>
```

#### **Progress Bars**
```tsx
{status === 'enriching' && (
  <div className="mt-3">
    <div className="w-full bg-gray-200 rounded-full h-1.5">
      <div className="bg-blue-500 h-1.5 rounded-full animate-pulse" style={{ width: '60%' }} />
    </div>
  </div>
)}
```

### **Type Badges**
```tsx
const getTypeIcon = () => {
  switch (type) {
    case 'video': return <Play size={16} />;
    case 'pdf': return <FileText size={16} />;
    case 'article': return <FileText size={16} />;
    default: return <ImageIcon size={16} />;
  }
};

<Badge className="bg-white/90 text-gray-900 border-0 flex items-center gap-1.5">
  {getTypeIcon()}
  {getTypeLabel()}
</Badge>
```

### **Match Percentage**
```tsx
{relevanceScore && (
  <div className="absolute top-3 right-3">
    <Badge className="bg-white/90 text-gray-900 border-0">
      {relevanceScore}% match
    </Badge>
  </div>
)}
```

## 🖼️ **Media Components**

### **Hero Image**
```tsx
<div className="aspect-[16/9] overflow-hidden rounded-t-2xl relative">
  <img
    src={getHeroImage()}
    alt={title}
    className="w-full h-full object-cover"
    loading="lazy"
  />
  
  {/* Type Badge */}
  <div className="absolute top-3 left-3">
    <Badge className="bg-white/90 text-gray-900 border-0 flex items-center gap-1.5">
      {getTypeIcon()}
      {getTypeLabel()}
    </Badge>
  </div>

  {/* Match Percentage */}
  {relevanceScore && (
    <div className="absolute top-3 right-3">
      <Badge className="bg-white/90 text-gray-900 border-0">
        {relevanceScore}% match
      </Badge>
    </div>
  )}
</div>
```

### **Fallback Image Generation**
```tsx
const generateFallbackCover = (title: string, type: string) => {
  const colors = {
    article: COLORS.civicBlue,
    video: COLORS.actionOrange,
    pdf: '#8B5CF6',
    post: '#10B981'
  };
  
  const color = colors[type as keyof typeof colors] || COLORS.slate;
  const encodedTitle = encodeURIComponent(title.substring(0, 50));
  
  return `https://ui-avatars.com/api/?name=${encodedTitle}&background=${color.replace('#', '')}&color=fff&size=800&format=png&bold=true`;
};
```

## 🎯 **Action Components**

### **Attach Menu**
```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button size="sm" variant="outline" className="h-8 px-3 text-xs">
      Attach →
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="start">
    <DropdownMenuItem onClick={() => onAttach('timeline')}>
      Timeline
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => onAttach('fact')}>
      Fact
    </DropdownMenuItem>
    <DropdownMenuItem onClick={() => onAttach('source')}>
      Source
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

### **Action Buttons**
```tsx
<div className="flex items-center gap-2">
  <Button
    size="sm"
    variant="outline"
    className="h-8 px-3 text-xs"
    onClick={() => sourceUrl && window.open(sourceUrl, '_blank')}
    disabled={!sourceUrl}
  >
    <ExternalLink size={14} className="mr-1.5" />
    Open
  </Button>

  {/* Attach Menu */}
  {onAttach && <AttachMenu onAttach={onAttach} />}
</div>

<div className="flex items-center gap-1">
  {onDiscuss && (
    <Button
      size="sm"
      variant="ghost"
      className="h-8 w-8 p-0"
      onClick={onDiscuss}
    >
      <MessageCircle size={14} />
    </Button>
  )}
  {onSave && (
    <Button
      size="sm"
      variant="ghost"
      className="h-8 w-8 p-0"
      onClick={onSave}
    >
      <Bookmark size={14} />
    </Button>
  )}
</div>
```

## 📱 **Responsive Design**

### **Grid Layout**
```tsx
{/* Desktop: 2 columns, Mobile: 1 column */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {getSortedAndFilteredItems().map((item) => (
    <DiscoveryCard key={item.id} {...item} />
  ))}
</div>
```

### **Responsive Typography**
```tsx
{/* Title: responsive font size */}
<h3 className="text-base md:text-lg font-semibold leading-6 text-gray-900 mb-2 line-clamp-2">
  {title}
</h3>

{/* Summary: responsive line clamp */}
<p className="text-slate-700 mt-2 line-clamp-3 text-sm leading-relaxed">
  {enrichedContent?.summary150}
</p>
```

### **Responsive Spacing**
```tsx
{/* Card padding: responsive */}
<CardContent className="p-5 md:p-6">
  {/* Content */}
</CardContent>

{/* Controls: responsive layout */}
<div className="flex items-center justify-between mb-6">
  <div className="flex items-center gap-3">
    {/* Controls */}
  </div>
  <div className="text-sm text-gray-500">
    {getSortedAndFilteredItems().length} items
  </div>
</div>
```

## 🎨 **Design Tokens**

### **Colors**
```typescript
const COLORS = {
  actionOrange: '#FF6A00',
  civicBlue: '#0A5AFF',
  ink: '#0B0B0F',
  slate: '#60646C',
  line: '#E6E8EC',
  surface: '#FFFFFF',
};
```

### **Spacing**
```typescript
const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  '2xl': '48px',
};
```

### **Typography**
```typescript
const TYPOGRAPHY = {
  heading: 'text-lg font-semibold leading-6',
  body: 'text-sm leading-relaxed',
  caption: 'text-xs',
  label: 'text-sm font-medium',
};
```

## 🔧 **Utility Functions**

### **Content Formatting**
```tsx
// Format reading time
const formatReadingTime = (minutes?: number) => {
  if (!minutes) return null;
  if (minutes < 1) return '< 1 min';
  if (minutes === 1) return '1 min';
  return `${Math.round(minutes)} min`;
};

// Format date
const formatDate = (dateString?: string) => {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  } catch {
    return null;
  }
};
```

### **Image Handling**
```tsx
// Get hero image with fallback
const getHeroImage = () => {
  if (mediaAssets?.hero) return mediaAssets.hero;
  if (mediaAssets?.videoThumb) return mediaAssets.videoThumb;
  if (mediaAssets?.pdfPreview) return mediaAssets.pdfPreview;
  if (mediaAssets?.gallery?.[0]) return mediaAssets.gallery[0];
  return generateFallbackCover(title, type);
};
```

## 🚀 **Performance Optimizations**

### **Lazy Loading**
```tsx
<img
  src={getHeroImage()}
  alt={title}
  className="w-full h-full object-cover"
  loading="lazy"
/>
```

### **Memoization**
```tsx
const getSortedAndFilteredItems = useMemo(() => {
  let filtered = items.filter(item => {
    if (filterType === 'all') return true;
    return item.type === filterType;
  });

  filtered.sort((a, b) => {
    switch (sortBy) {
      case 'relevance':
        return (b.relevanceScore || 0) - (a.relevanceScore || 0);
      case 'newest':
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case 'quality':
        return (b.qualityScore || 0) - (a.qualityScore || 0);
      default:
        return 0;
    }
  });

  return filtered;
}, [items, filterType, sortBy]);
```

### **Error Boundaries**
```tsx
<ErrorBoundary fallback={<ErrorFallback />}>
  <DiscoveryCard {...props} />
</ErrorBoundary>
```

This component guide provides comprehensive documentation for building and customizing the discovery system components.
