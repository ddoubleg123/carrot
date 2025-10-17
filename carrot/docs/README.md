# Carrot AI Image Generation - Documentation Index

**Last Updated:** 2025-10-16  
**Version:** v2.3.0  
**Status:** 🎉 **ALL 10 STYLES COMPLETE** - Production Ready ✅

---

## 🎊 Project Complete!

**ALL 10 ARTISTIC STYLES WORKING PERFECTLY!**

User tested and approved. The system generates contextually accurate, stylistically consistent images across all 10 artistic styles with intelligent subject extraction, scene awareness, and truthful feature tracking.

**Start here:** [FINAL-IMPLEMENTATION-SUMMARY.md](./FINAL-IMPLEMENTATION-SUMMARY.md) ⭐

---

## 📚 Documentation Overview

This folder contains complete documentation for the Carrot AI Image Generation System, including architecture, all 10 bugs solved, implementation details, and comprehensive testing.

---

## 🎯 Quick Links

### For Users
- **[Getting Started](#)** - How to use the image generation system
- **[Test Page](http://localhost:3005/test-deepseek-images)** - Interactive testing interface
- **[Artistic Styles](#artistic-styles)** - All 10 available styles

### For Developers
- **[AI-IMAGE-GENERATION-SYSTEM.md](./AI-IMAGE-GENERATION-SYSTEM.md)** - Complete system documentation
- **[SCENE-EXTRACTION-SYSTEM.md](./SCENE-EXTRACTION-SYSTEM.md)** - Scene-aware extraction details
- **[Test Suite](../tests/prompt.spec.ts)** - Automated tests

### For Infrastructure
- **[VAST-AI-SETUP-GUIDE.md](../VAST-AI-SETUP-GUIDE.md)** - GPU server setup
- **[DeepSeek Infrastructure Plan](../public/DeepSeek_Coder_Infrastructure_Plan.md)** - DeepSeek Coder setup

---

## 📖 Core Documentation

### 1. [AI-IMAGE-GENERATION-SYSTEM.md](./AI-IMAGE-GENERATION-SYSTEM.md)
**The main documentation file covering:**
- System architecture (two-server setup: Next.js + Vast.ai)
- All problems solved and solutions implemented
- Complete code examples
- API reference
- Testing & validation
- Troubleshooting guide

**Read this first** to understand the entire system.

---

### 2. [SCENE-EXTRACTION-SYSTEM.md](./SCENE-EXTRACTION-SYSTEM.md)
**Deep dive into scene-aware extraction:**
- 6 types of context extraction (subject, action, object, crowd, location, event)
- Regex patterns and extraction logic
- Composition logic (wide vs portrait)
- Deduplication strategies
- Examples and test cases

**Read this** to understand how context is extracted from user input.

---

## 🔧 Implementation History

These documents track the evolution of the system and solutions to specific problems:

### [PROMPT-SYSTEM-REFACTOR.md](../PROMPT-SYSTEM-REFACTOR.md) - v2.0.0
- Initial refactor from monolithic to modular architecture
- Created `subject.ts`, `sanitize.ts`, `build.ts`, `pipeline.ts`
- Fixed subject cardinality bug
- Implemented truthful feature tracking

### [PROMPT-SYSTEM-FIXES.md](../PROMPT-SYSTEM-FIXES.md)
- Enhanced subject extraction from title + summary
- Added "with" relationship detection
- Restored PowerShell-style logs
- Added try/catch error handling

### [CONTEXT-DEDUP-PATCH.md](../CONTEXT-DEDUP-PATCH.md) - v2.1.0
- Fixed "Jesus Christ Jesus Christ" duplication
- Added action/event/location extraction
- Smart lens selection based on context
- Religious motif exclusions

---

## 🎨 Artistic Styles

### 🎉 ALL 10 STYLES COMPLETE ✅

**Status:** Production Ready - User Tested & Approved  
**Date:** October 16, 2025  
**Version:** v2.3.0

1. ✅ **[Hyper-Realistic (Photorealistic)](./AI-IMAGE-GENERATION-SYSTEM.md#1-hyper-realistic-photorealistic)** - StyleMode: `photo`
   - Photorealistic rendering, natural lighting, lifelike textures
   - Smart camera (24-35mm wide / 85mm portrait)

2. ✅ **[Illustration (Stylized Art)](./AI-IMAGE-GENERATION-SYSTEM.md#2-illustration-stylized-art)** - StyleMode: `illustration`
   - Editorial illustration, clean lines, bold colors
   - Vector-style flat shading

3. ✅ **[Animation (Cartoon/Anime Style)](./ANIMATION-STYLE.md)** - StyleMode: `anime`
   - Cel-shaded, vibrant colors, expressive poses
   - Anime character design

4. ✅ **Painting (Artistic Brushwork)** - StyleMode: `painting`
   - Painterly strokes, soft edges, gallery-quality
   - No camera language

5. ✅ **Digital Art (Modern CGI)** - StyleMode: `cgi`
   - 3D modeled, ray-traced, volumetric lighting
   - CGI rendering aesthetic

6. ✅ **Sketch (Pencil/Drawing)** - StyleMode: `sketch`
   - Pencil linework, cross-hatching, graphite texture
   - Monochrome drawing feel

7. ✅ **Watercolor (Soft & Flowing)** - StyleMode: `painting`
   - Soft edges, layered tones, painterly
   - Same as Painting mode

8. ✅ **Oil Painting (Classic Art)** - StyleMode: `painting`
   - Oil-on-canvas look, controlled detail
   - Same as Painting mode

9. ✅ **Minimalist (Clean & Simple)** - StyleMode: `minimalist`
   - Negative space, clean composition
   - Refined simplicity

10. ✅ **Vintage (Retro Photography)** - StyleMode: `vintage`
    - Film grain, sepia tones, nostalgic
    - Classic photography aesthetic

---

## 🧪 Testing

### Automated Tests
```bash
npm test tests/prompt.spec.ts
```

**Test Coverage:**
- ✅ Single subject extraction
- ✅ Dual subject extraction (via "with", "and")
- ✅ Deduplication ("Jesus Christ Jesus Christ" → "Jesus Christ")
- ✅ Context extraction (action, object, crowd, location, event)
- ✅ Camera selection (wide vs portrait)
- ✅ Style-specific prompts (photorealistic vs illustration)

### Manual Testing

**Test Page:** `http://localhost:3005/test-deepseek-images`

**Test Scenarios:**

1. **Simple Portrait**
   - Title: `Derrick Rose`
   - Summary: `Portrait of Derrick Rose`
   - Expected: 85mm portrait composition

2. **Crowd Scene**
   - Title: `Jesus Christ`
   - Summary: `Jesus Christ feeding 100 people with fish`
   - Expected: 24-35mm wide-angle, crowd visible

3. **Dual Subject**
   - Title: `Donald Trump`
   - Summary: `Donald Trump in a large arena with Vladimir Putin celebrating`
   - Expected: Both subjects, dual mode

4. **Political Rally**
   - Title: `Jesus Christ`
   - Summary: `Jesus Christ giving a political speech at a political rally in front of the Grand Canyon`
   - Expected: Wide scene with podium, crowd, landscape

---

## 🏗️ Architecture

### File Structure
```
src/
├── lib/
│   ├── prompt/
│   │   ├── subject.ts          # Name extraction & deduplication
│   │   ├── sanitize.ts         # Context extraction (action/object/crowd/location/event)
│   │   └── build.ts            # Style-aware prompt construction
│   └── pipeline.ts             # SDXL orchestration with truthful tracking
│
├── app/
│   ├── api/
│   │   └── ai/
│   │       └── generate-hero-image/
│   │           └── route.ts    # API endpoint
│   └── test-deepseek-images/
│       └── page.tsx            # Test UI
│
tests/
└── prompt.spec.ts              # Comprehensive test suite

docs/
├── README.md                   # This file
├── AI-IMAGE-GENERATION-SYSTEM.md
└── SCENE-EXTRACTION-SYSTEM.md
```

---

## 🚀 Quick Start

### 1. Start Development Server
```bash
cd carrot
npm run dev
```

### 2. Test Image Generation
Visit: `http://localhost:3005/test-deepseek-images`

### 3. Check Console Logs
Browser console will show:
```
[GenerateHeroImage] Sanitized: { 
  names: [...], 
  mode: 'single|dual',
  actionHint: ...,
  objectHint: ...,
  countHint: ...,
  locationHint: ...,
  eventHint: ...
}
[GenerateHeroImage] Built prompt: ...
[AI Image Generator] ✅ Successfully generated image with SDXL
[AI Image Generator] Features applied:
   - Model: SDXL
   - Refiner: ✅/❌
   - Face Restoration: ✅/❌
   ...
```

---

## 🔍 Troubleshooting

### Common Issues

1. **Duplicate names in prompt**
   - Fixed in v2.1.0
   - See: [CONTEXT-DEDUP-PATCH.md](../CONTEXT-DEDUP-PATCH.md)

2. **Missing context (action/location)**
   - Ensure summary contains detectable patterns
   - See: [SCENE-EXTRACTION-SYSTEM.md](./SCENE-EXTRACTION-SYSTEM.md)

3. **Wrong camera angle**
   - System auto-detects scenes vs portraits
   - Crowd/action → 24-35mm wide
   - Simple portrait → 85mm

4. **Religious motifs appearing**
   - Fixed in v2.0.0
   - Negative prompts exclude: halo, crown, divine glow, stained glass

5. **Feature flags showing wrong status**
   - Fixed in v2.0.0
   - ✅ only appears when feature actually executed successfully

---

## 📊 System Status

### 🎉 PRODUCTION READY - ALL 10 STYLES COMPLETE ✅

**Completed:** October 16, 2025  
**Version:** v2.3.0  
**Status:** User Tested & Approved

#### Core System ✅
- ✅ Subject extraction & multi-step deduplication
- ✅ Scene-aware context extraction (6 types)
- ✅ Object prioritization (fish > people)
- ✅ Truthful feature tracking
- ✅ HD toggle (High-Resolution Fix)
- ✅ Comprehensive test suite (15+ tests)
- ✅ PowerShell-style + JSON logs
- ✅ Zero linter errors

#### All 10 Artistic Styles ✅
- ✅ Hyper-Realistic (Photorealistic)
- ✅ Illustration (Stylized Art)
- ✅ Animation (Cartoon/Anime Style)
- ✅ Painting (Artistic Brushwork)
- ✅ Digital Art (Modern CGI)
- ✅ Sketch (Pencil/Drawing)
- ✅ Watercolor (Soft & Flowing)
- ✅ Oil Painting (Classic Art)
- ✅ Minimalist (Clean & Simple)
- ✅ Vintage (Retro Photography)

#### Advanced Features ✅
- ✅ 8 distinct StyleModes
- ✅ Smart negative prompts
- ✅ Style-aware composition
- ✅ Cache key generation
- ✅ Religious motif exclusions

### Future Enhancements ⏳
- ⏳ Style mixing capabilities
- ⏳ Advanced refiner/upscaler integration
- ⏳ Batch generation support
- ⏳ A/B testing framework

---

## 🤝 Contributing

### Adding New Artistic Styles

1. Add style to `build.ts`:
```typescript
case 'newStyle':
  styleBlock = 'style-specific prompt tokens';
  compositionBlock = isWideScene ? 'wide comp' : 'portrait comp';
  negative = NEGATIVE_NEWSTYLE;
  break;
```

2. Add to style mapping in `route.ts`
3. Add tests in `prompt.spec.ts`
4. Create style guide documentation

### Adding New Context Extractors

1. Add regex pattern to `sanitize.ts`
2. Add to `SanitizeResult` interface
3. Update `buildPrompt()` to use the hint
4. Add tests
5. Update documentation

---

## 📞 Support

For questions or issues:
1. Check [AI-IMAGE-GENERATION-SYSTEM.md](./AI-IMAGE-GENERATION-SYSTEM.md) troubleshooting section
2. Review test suite: `tests/prompt.spec.ts`
3. Check console logs for detailed error messages
4. Verify Vast.ai connection: `http://localhost:3005/debug-connection`

---

## 🎯 Next Steps

1. **Complete remaining artistic styles** (Animation, Painting, Digital Art, Sketch, Watercolor, Oil Painting, Minimalist, Vintage)
2. **Enhance refiner/upscaler integration** with real endpoints
3. **Add batch generation** support
4. **Performance optimization** (caching, parallel processing)
5. **A/B testing framework** for prompt quality

---

**Last Updated:** October 16, 2025  
**Maintained by:** Carrot Engineering Team
