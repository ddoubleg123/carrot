# Reference Extraction Analysis - Zionism Page

## Key Findings

### Problem Identified
**We are NOT extracting all external URLs from the References section.**

### Current Situation

1. **REST API HTML Format**:
   - Has 23 `cite_note` items in References section
   - **0 external URLs found** in References section using standard regex patterns
   - External URLs appear to be stored in citation templates (not rendered as `<a href>` tags)
   - REST API format may not include external URLs in a parseable format

2. **External Links Section**:
   - Has **1,269 links** (many external)
   - We ARE extracting from this section (database has 1,236 citations, which matches)

3. **Further Reading Section**:
   - Has **27 links**
   - Not sure if we're extracting from this

4. **Database**:
   - Has **1,236 citations** total
   - **15 verified** external URLs
   - **1,221 failed** (mostly Wikipedia internal links that were incorrectly stored)

### Root Cause

The `extractWikipediaCitationsWithContext` function uses this regex:
```typescript
const urlMatch = refText.match(/<a[^>]*class=["'][^"']*external[^"']*["'][^>]*href=["']([^"']+)["']/i) ||
                refText.match(/href=["'](https?:\/\/[^"']+)["']/i)
```

**Problem**: The REST API HTML format doesn't render external URLs as `<a href>` tags in the References section. They're stored in citation templates (like `{{cite web}}`, `{{cite book}}`) that need to be parsed differently.

### What We're Missing

1. **References Section External URLs**: 
   - Citation templates contain external URLs in attributes like `url=`, `website=`, `access-url=`, `archive-url=`
   - These are not rendered as `<a href>` in REST API format
   - Need to parse citation template attributes

2. **Further Reading Section**: 
   - May not be extracted at all (need to verify)

3. **External Links Section**: 
   - ✅ We ARE extracting from this (1,236 citations match 1,269 links)

### Solution Required

1. **Parse Citation Templates**: 
   - Extract external URLs from citation template attributes (`url=`, `website=`, etc.)
   - Handle both REST API format and regular HTML format

2. **Extract from All Sections**:
   - References section (with citation template parsing)
   - Further reading section
   - External links section (already working)

3. **Fix Wikipedia Internal Link Filtering**:
   - Currently storing Wikipedia internal links (1,221 failed)
   - Should filter these out during extraction, not during verification

### Next Steps

1. Check if regular Wikipedia HTML (not REST API) has external URLs in references
2. Implement citation template parsing for REST API format
3. Update `extractWikipediaCitationsWithContext` to extract from all sections
4. Fix filtering to exclude Wikipedia internal links during extraction

