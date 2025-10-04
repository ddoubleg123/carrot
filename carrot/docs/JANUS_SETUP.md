# Janus AI Image Generation Setup

## Overview

We're using [DeepSeek's Janus](https://github.com/deepseek-ai/Janus) for legally compliant AI-generated images. This approach eliminates copyright concerns by generating original images based on content analysis.

## Legal Compliance Benefits

✅ **No Copyright Issues** - AI-generated images are copyright-free  
✅ **Original Content** - Each image is unique and generated for specific content  
✅ **No Attribution Required** - AI-generated content doesn't require attribution  
✅ **Commercial Use Safe** - Can be used commercially without restrictions  

## Setup Instructions

### 1. Get Janus API Access

1. Visit [DeepSeek's Janus GitHub](https://github.com/deepseek-ai/Janus)
2. Follow their API access instructions
3. Obtain your API key

### 2. Environment Configuration

Add these environment variables to your `.env.local`:

```bash
# DeepSeek Janus API Configuration
JANUS_API_BASE=https://api.deepseek.com
JANUS_API_KEY=your_janus_api_key_here

# Alternative: Use DeepSeek's existing API if Janus is integrated
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_API_BASE=https://api.deepseek.com
```

### 3. API Usage

The system will automatically:

1. **Analyze Content** - Extract key concepts from titles and content
2. **Generate Prompts** - Create specific prompts for each content type
3. **Generate Images** - Use Janus to create relevant visuals
4. **Fallback Strategy** - Use safe image extraction if AI generation fails

## Image Generation Strategy

### Content Types & Styles

- **Articles**: Professional, clean design with typography space
- **Videos**: Dynamic thumbnails with play button overlay
- **PDFs**: Minimal document preview style
- **Posts**: Modern illustrations with clear hierarchy

### Prompt Engineering

The system creates intelligent prompts based on:

- **Content Analysis** - Key concepts and themes
- **Domain Detection** - Technology, business, health, etc.
- **Style Matching** - Appropriate visual style for content type
- **Aspect Ratios** - 16:9 for heroes, 4:3 for gallery

### Quality Assurance

- **High Resolution** - 1024x1024 base resolution
- **Professional Quality** - Optimized for web display
- **Consistent Branding** - Carrot color palette integration
- **Fallback System** - Generated covers if AI fails

## Cost Considerations

- **API Calls** - Each image generation costs API credits
- **Batch Processing** - Process multiple items efficiently
- **Caching** - Store generated images to avoid re-generation
- **Rate Limiting** - Respect API limits with delays

## Monitoring & Analytics

Track:
- **Generation Success Rate** - How often AI generation succeeds
- **Fallback Usage** - When safe extraction is needed
- **User Engagement** - Do AI images improve click-through rates?
- **Cost per Image** - Monitor API usage costs

## Troubleshooting

### Common Issues

1. **API Key Invalid** - Check environment variables
2. **Rate Limiting** - Implement proper delays between requests
3. **Generation Failures** - Fallback to safe image extraction
4. **Quality Issues** - Adjust prompt engineering

### Debug Mode

Enable debug logging:

```bash
DEBUG=content-enrichment:*
```

## Future Enhancements

- **Custom Models** - Train Janus on Carrot-specific content
- **Style Consistency** - Maintain visual brand consistency
- **A/B Testing** - Test different prompt strategies
- **User Preferences** - Allow users to choose image styles

## Legal Notes

- ✅ AI-generated images are copyright-free
- ✅ No attribution required for AI-generated content
- ✅ Safe for commercial use
- ✅ No risk of copyright infringement
- ✅ Original content created specifically for each article

This approach ensures we have beautiful, relevant visuals while maintaining complete legal compliance.
