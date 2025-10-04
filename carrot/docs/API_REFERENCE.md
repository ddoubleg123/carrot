# Discovery System API Reference

## Overview

This document provides comprehensive API documentation for the Carrot Patch Discovery System, including endpoints, request/response formats, and usage examples.

## 🔌 **Core Endpoints**

### **Content Discovery**

#### `GET /api/patches/[handle]/discovered-content`
Get discovered content for a specific patch.

**Parameters:**
- `handle` (path): Patch handle identifier
- `status` (query, optional): Filter by status (`ready`, `queued`, `failed`, etc.)
- `cursor` (query, optional): Pagination cursor
- `limit` (query, optional): Number of items to return (default: 20)

**Response:**
```json
{
  "success": true,
  "items": [
    {
      "id": "clx1234567890",
      "title": "Article Title",
      "type": "article",
      "sourceUrl": "https://example.com/article",
      "canonicalUrl": "https://example.com/article",
      "relevanceScore": 85,
      "status": "ready",
      "enrichedContent": {
        "summary150": "Brief summary of the content...",
        "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
        "notableQuote": "Notable quote from the content",
        "fullText": "Full article text...",
        "readingTime": 5
      },
      "mediaAssets": {
        "hero": "https://example.com/hero-image.jpg",
        "gallery": ["https://example.com/image1.jpg"],
        "videoThumb": null,
        "pdfPreview": null
      },
      "metadata": {
        "author": "Author Name",
        "publishDate": "2024-01-15T10:30:00Z",
        "source": "example.com",
        "tags": ["technology", "innovation"],
        "entities": ["AI", "Machine Learning"],
        "citation": {
          "title": "Article Title",
          "url": "https://example.com/article",
          "type": "article"
        }
      },
      "qualityScore": 0.85,
      "freshnessScore": 0.92,
      "diversityBucket": "bucket_2",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:35:00Z"
    }
  ],
  "isActive": true,
  "totalItems": 1,
  "nextCursor": "eyJpZCI6ImNseDEyMzQ1Njc4OTAifQ=="
}
```

#### `POST /api/patches/[handle]/discovered-content`
Start discovery process for a patch.

**Request Body:**
```json
{
  "urls": [
    "https://example.com/article1",
    "https://example.com/article2"
  ],
  "topics": ["technology", "AI"],
  "maxItems": 50
}
```

**Response:**
```json
{
  "success": true,
  "message": "Discovery started",
  "batchId": "batch_1234567890",
  "queuedItems": 2
}
```

### **Content Enrichment**

#### `POST /api/patch/[handle]/discover/enrich`
Process queued content items for enrichment.

**Parameters:**
- `handle` (path): Patch handle identifier

**Response:**
```json
{
  "ok": true,
  "message": "Processed 5 items",
  "processed": 5,
  "results": [
    {
      "id": "clx1234567890",
      "status": "success"
    },
    {
      "id": "clx1234567891",
      "status": "failed",
      "error": "Content extraction failed"
    }
  ]
}
```

#### `GET /api/patch/[handle]/discover`
Get enriched content with pagination.

**Parameters:**
- `handle` (path): Patch handle identifier
- `status` (query): Filter by status (`ready`, `queued`, `failed`)
- `cursor` (query): Pagination cursor
- `limit` (query): Items per page (default: 20)

**Response:**
```json
{
  "success": true,
  "items": [
    {
      "id": "clx1234567890",
      "title": "Enriched Article Title",
      "type": "article",
      "status": "ready",
      "enrichedContent": {
        "summary150": "AI-generated summary...",
        "keyPoints": ["Point 1", "Point 2", "Point 3"],
        "notableQuote": "Important quote...",
        "fullText": "Full content...",
        "transcript": null
      },
      "mediaAssets": {
        "hero": "https://generated-image.jpg",
        "gallery": ["https://gallery1.jpg"],
        "videoThumb": null,
        "pdfPreview": null
      },
      "metadata": {
        "author": "Author Name",
        "publishDate": "2024-01-15T10:30:00Z",
        "source": "example.com",
        "readingTime": 5,
        "tags": ["AI", "Technology"],
        "entities": ["Machine Learning", "Innovation"],
        "citation": {
          "title": "Article Title",
          "url": "https://example.com/article",
          "type": "article",
          "domain": "example.com"
        }
      },
      "qualityScore": 0.87,
      "freshnessScore": 0.95,
      "diversityBucket": "bucket_1",
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:35:00Z"
    }
  ],
  "pagination": {
    "hasNext": true,
    "nextCursor": "eyJpZCI6ImNseDEyMzQ1Njc4OTAifQ==",
    "total": 25
  }
}
```

### **Content Attachment**

#### `POST /api/patch/[handle]/discover/:id/attach`
Attach discovered content to timeline, facts, or sources.

**Parameters:**
- `handle` (path): Patch handle identifier
- `id` (path): Discovered content ID

**Request Body:**
```json
{
  "target": "timeline", // "timeline" | "facts" | "sources"
  "metadata": {
    "date": "2024-01-15",
    "tags": ["important", "milestone"],
    "notes": "User notes about this content"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Content attached to timeline",
  "attachmentId": "attach_1234567890",
  "target": "timeline"
}
```

## 🖼️ **Image APIs**

### **Free Image Search**

#### `GET /api/images/search`
Search for free images across multiple APIs.

**Parameters:**
- `query` (query): Search term
- `perPage` (query, optional): Results per page (default: 10)
- `orientation` (query, optional): `landscape` | `portrait` | `square`
- `size` (query, optional): `small` | `medium` | `large`
- `color` (query, optional): Hex color code

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "id": "pexels_1234567890",
      "url": "https://images.pexels.com/photos/1234567890/pexels-photo-1234567890.jpeg",
      "thumbnail": "https://images.pexels.com/photos/1234567890/pexels-photo-1234567890.jpeg?auto=compress&cs=tinysrgb&w=400",
      "width": 1920,
      "height": 1080,
      "photographer": "Photographer Name",
      "source": "Pexels",
      "license": "Pexels License (Free for commercial use)",
      "attribution": "Photo by Photographer Name on Pexels"
    }
  ],
  "total": 1,
  "sources": ["Pexels", "Unsplash", "Pixabay"]
}
```

### **AI Image Generation**

#### `POST /api/images/generate`
Generate AI images using Janus.

**Request Body:**
```json
{
  "prompt": "Professional article header about AI technology",
  "style": "professional", // "realistic" | "illustration" | "minimal" | "professional"
  "aspectRatio": "16:9", // "16:9" | "4:3" | "1:1"
  "quality": "high"
}
```

**Response:**
```json
{
  "success": true,
  "image": {
    "url": "https://generated-image.jpg",
    "prompt": "Professional article header about AI technology",
    "style": "professional",
    "aspectRatio": "16:9",
    "generatedAt": "2024-01-15T10:30:00Z"
  }
}
```

## 📊 **Analytics Endpoints**

#### `GET /api/patches/[handle]/discover/analytics`
Get discovery analytics for a patch.

**Response:**
```json
{
  "success": true,
  "analytics": {
    "totalItems": 150,
    "readyItems": 120,
    "processingItems": 20,
    "failedItems": 10,
    "averageQualityScore": 0.82,
    "averageFreshnessScore": 0.78,
    "topSources": [
      { "domain": "example.com", "count": 25 },
      { "domain": "techcrunch.com", "count": 18 }
    ],
    "contentTypes": {
      "article": 80,
      "video": 35,
      "pdf": 20,
      "post": 15
    },
    "processingTime": {
      "average": 2.5,
      "median": 2.1,
      "p95": 5.2
    }
  }
}
```

## 🔧 **Configuration Endpoints**

#### `GET /api/config/discovery`
Get discovery system configuration.

**Response:**
```json
{
  "success": true,
  "config": {
    "features": {
      "aiImages": true,
      "freeAPIs": true,
      "safeExtraction": true,
      "batchProcessing": true
    },
    "limits": {
      "maxItemsPerBatch": 50,
      "maxProcessingTime": 300,
      "rateLimitPerHour": 1000
    },
    "apis": {
      "janus": {
        "enabled": true,
        "baseUrl": "https://api.deepseek.com"
      },
      "pexels": {
        "enabled": true,
        "rateLimit": 200
      },
      "unsplash": {
        "enabled": true,
        "rateLimit": 50
      }
    }
  }
}
```

## 🚨 **Error Responses**

### **Standard Error Format**
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional error details"
  }
}
```

### **Common Error Codes**
- `PATCH_NOT_FOUND`: Patch handle doesn't exist
- `INVALID_URL`: URL format is invalid
- `RATE_LIMIT_EXCEEDED`: API rate limit exceeded
- `PROCESSING_FAILED`: Content processing failed
- `IMAGE_GENERATION_FAILED`: AI image generation failed
- `UNAUTHORIZED`: Invalid or missing authentication
- `FORBIDDEN`: Insufficient permissions

### **HTTP Status Codes**
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `429`: Too Many Requests
- `500`: Internal Server Error
- `503`: Service Unavailable

## 🔐 **Authentication**

### **API Key Authentication**
```bash
Authorization: Bearer your_api_key_here
```

### **Rate Limiting**
- **Free Tier**: 100 requests/hour
- **Pro Tier**: 1000 requests/hour
- **Enterprise**: Custom limits

### **Headers**
```bash
Content-Type: application/json
Accept: application/json
User-Agent: CarrotPatch/1.0
```

## 📝 **Usage Examples**

### **Start Discovery Process**
```bash
curl -X POST "https://api.carrot.com/patches/my-patch/discovered-content" \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "urls": ["https://example.com/article"],
    "topics": ["technology"],
    "maxItems": 10
  }'
```

### **Get Enriched Content**
```bash
curl -X GET "https://api.carrot.com/patch/my-patch/discover?status=ready&limit=10" \
  -H "Authorization: Bearer your_api_key"
```

### **Search for Images**
```bash
curl -X GET "https://api.carrot.com/images/search?query=technology&perPage=5" \
  -H "Authorization: Bearer your_api_key"
```

### **Attach Content to Timeline**
```bash
curl -X POST "https://api.carrot.com/patch/my-patch/discover/123/attach" \
  -H "Authorization: Bearer your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "target": "timeline",
    "metadata": {
      "date": "2024-01-15",
      "tags": ["milestone"]
    }
  }'
```

## 🔄 **Webhooks**

### **Discovery Events**
```json
{
  "event": "discovery.completed",
  "data": {
    "patchId": "patch_123",
    "batchId": "batch_456",
    "totalItems": 25,
    "readyItems": 20,
    "failedItems": 5
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### **Content Events**
```json
{
  "event": "content.enriched",
  "data": {
    "contentId": "clx1234567890",
    "patchId": "patch_123",
    "status": "ready",
    "qualityScore": 0.85
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

This API reference provides comprehensive documentation for integrating with the Carrot Patch Discovery System.
