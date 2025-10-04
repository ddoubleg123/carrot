# Free Image APIs - Legal Commercial Use

## Overview

This document outlines the comprehensive free image API system that provides legally compliant images for Carrot Patch discovery content. The system uses a multi-tier approach to ensure we always have beautiful, relevant visuals.

## 🎯 **Multi-Tier Image Strategy**

### **Tier 1: AI-Generated Images (Janus)**
- **Source**: DeepSeek Janus API
- **License**: Copyright-free (AI-generated)
- **Quality**: High, brand-consistent
- **Cost**: API credits per generation

### **Tier 2: Free Commercial APIs**
- **Pexels**: No attribution required
- **Unsplash**: Attribution appreciated
- **Pixabay**: No attribution required
- **License**: Free for commercial use

### **Tier 3: Public Domain Sources**
- **Wikimedia Commons**: Creative Commons licenses
- **NASA Images**: Public domain
- **License**: Free for commercial use

### **Tier 4: Safe Extraction**
- **Creative Commons**: Only CC-licensed images
- **Public Domain**: Government works, etc.
- **License**: Verified free licenses

### **Tier 5: Generated Fallback**
- **UI Avatars**: Generated covers
- **License**: No restrictions
- **Quality**: Basic but consistent

## 🔑 **API Keys Required**

### **Pexels API**
```bash
PEXELS_API_KEY=your_pexels_api_key
```
- **Sign up**: [Pexels API](https://www.pexels.com/api/)
- **Rate limit**: 200 requests/hour (free)
- **License**: Pexels License (free commercial use)

### **Unsplash API**
```bash
UNSPLASH_ACCESS_KEY=your_unsplash_access_key
```
- **Sign up**: [Unsplash Developers](https://unsplash.com/developers)
- **Rate limit**: 50 requests/hour (free)
- **License**: Unsplash License (free commercial use)

### **Pixabay API**
```bash
PIXABAY_API_KEY=your_pixabay_api_key
```
- **Sign up**: [Pixabay API](https://pixabay.com/api/docs/)
- **Rate limit**: 5000 requests/hour (free)
- **License**: Pixabay License (free commercial use)

### **No API Key Required**
- **Wikimedia Commons**: Public API
- **NASA Images**: Public API
- **Janus**: Requires DeepSeek API key

## 📋 **Legal Compliance Summary**

| Source | Commercial Use | Attribution | License Type |
|--------|---------------|-------------|--------------|
| **Janus AI** | ✅ Yes | ❌ None | AI-Generated |
| **Pexels** | ✅ Yes | ❌ None | Pexels License |
| **Unsplash** | ✅ Yes | ⚠️ Appreciated | Unsplash License |
| **Pixabay** | ✅ Yes | ❌ None | Pixabay License |
| **Wikimedia** | ✅ Yes | ⚠️ Required | CC Licenses |
| **NASA** | ✅ Yes | ⚠️ Courtesy | Public Domain |

## 🚀 **Implementation Features**

### **Smart Search**
- **Content Analysis**: Extracts relevant keywords from titles and content
- **Multi-Source**: Searches all APIs in parallel
- **Deduplication**: Removes duplicate images across sources
- **Ranking**: Prioritizes best matches and preferred sources

### **Quality Assurance**
- **High Resolution**: Prefers large, high-quality images
- **Aspect Ratios**: Optimizes for 16:9 hero images
- **Relevance**: Matches images to content themes
- **Fallback Chain**: Ensures we always have an image

### **Performance Optimization**
- **Parallel Requests**: Searches multiple APIs simultaneously
- **Caching**: Stores results to avoid repeated API calls
- **Rate Limiting**: Respects API limits with delays
- **Error Handling**: Graceful fallbacks for failed requests

## 🔧 **Configuration Example**

```bash
# .env.local
# AI Image Generation
JANUS_API_BASE=https://api.deepseek.com
JANUS_API_KEY=your_janus_api_key

# Free Commercial APIs
PEXELS_API_KEY=your_pexels_api_key
UNSPLASH_ACCESS_KEY=your_unsplash_access_key
PIXABAY_API_KEY=your_pixabay_api_key

# Optional: DeepSeek fallback
DEEPSEEK_API_KEY=your_deepseek_api_key
```

## 📊 **Usage Analytics**

Track these metrics:
- **Success Rate**: How often we get images from each tier
- **API Usage**: Monitor rate limits and costs
- **User Engagement**: Do better images improve click-through rates?
- **Quality Scores**: Rate image relevance and quality

## 🛡️ **Legal Safeguards**

### **Attribution Handling**
- **Automatic Attribution**: System tracks and stores attribution data
- **Display Options**: Can show photographer credits when required
- **License Verification**: Validates licenses before use

### **Compliance Monitoring**
- **License Checking**: Verifies each image's license
- **Usage Tracking**: Monitors commercial use compliance
- **Audit Trail**: Logs all image sources and licenses

## 🎨 **Image Quality Standards**

### **Technical Requirements**
- **Minimum Resolution**: 800x450 (16:9 aspect ratio)
- **File Formats**: JPG, PNG, WebP
- **File Size**: Optimized for web (under 500KB)
- **Color Space**: sRGB for web compatibility

### **Content Standards**
- **Relevance**: Must relate to article content
- **Quality**: Professional, high-quality images
- **Appropriateness**: Safe for all audiences
- **Brand Consistency**: Fits Carrot's visual style

## 🔄 **Fallback Strategy**

1. **Try Janus AI** → Generate custom image
2. **Try Free APIs** → Search Pexels, Unsplash, Pixabay
3. **Try Public Domain** → Search Wikimedia, NASA
4. **Try Safe Extraction** → Extract CC-licensed images
5. **Use Generated Fallback** → Create cover with UI Avatars

## 📈 **Future Enhancements**

- **Custom Models**: Train AI on Carrot-specific content
- **User Preferences**: Allow users to choose image styles
- **A/B Testing**: Test different image sources for engagement
- **Local Caching**: Store images locally to reduce API calls
- **Batch Processing**: Process multiple items efficiently

## ⚠️ **Important Notes**

- **Always verify licenses** before using images
- **Respect API rate limits** to avoid service interruption
- **Monitor costs** for AI generation services
- **Keep attribution data** for required sources
- **Regular audits** of image usage and compliance

This comprehensive system ensures we always have beautiful, legally compliant images while maintaining high quality and performance standards.
