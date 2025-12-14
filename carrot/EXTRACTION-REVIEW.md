# Citation Extraction Review

## Current Status

**Processing Progress:**
- Total citations: 8,839
- Scanned: 219 (2.5%)
- Saved: 19 (0.2%)
- Denied: 200 (2.3%)
- Remaining: 8,582 (97.1%)

## Extraction Quality Analysis

### Recent Processed Citations (30 sample)

**Denied Citations Breakdown:**
1. **Archive.org URLs (web.archive.org)**: ~15 citations
   - Issue: Archive pages often fail to extract content (0 chars extracted)
   - These are historical snapshots, not primary sources
   - **Action**: These should be filtered out earlier or handled specially

2. **Library Catalog/Authority Pages**: ~8 citations
   - Examples: id.loc.gov, viaf.org, nli.org.il, libris.kb.se
   - Issue: These are metadata pages, not articles (0 chars extracted)
   - **Action**: Already filtered by `isLowQualityUrl()` - working correctly

3. **Citations with Content but Denied**: ~2 citations
   - "Palestine Action Italia homepage": 1,853 chars extracted, Score: 50.0
   - "Greece" (library catalog): 3,971 chars extracted, Score: 50.0
   - **Analysis**: Content was extracted but relevance score was too low (50.0 < threshold)
   - **Action**: These might need review - content extraction is working

### Extraction Improvements Made

1. **Enhanced Content Selectors**:
   - Added more selectors: article-content, article-body, post-body, section tags
   - Now picks the content block with the most text (not just first match)
   - Better fallback to largest div/section with substantial text

2. **Better HTML-to-Text Conversion**:
   - Preserves paragraph structure (converts `<p>` to newlines)
   - Better handling of block elements (divs, headings, lists)
   - Improved entity decoding (&nbsp;, &amp;, etc.)

3. **Improved Content Selection**:
   - Finds all matching content blocks and selects the one with most text
   - Better handling of body content when no semantic tags found

## Issues Identified

### 1. Archive.org URLs
- **Problem**: Many archive.org URLs fail to extract content (0 chars)
- **Reason**: Archive pages often have complex JavaScript or redirects
- **Solution**: 
  - Filter archive.org URLs earlier in the process
  - Or implement special handling for archive pages (try to extract from archive metadata)

### 2. Low Content Extraction for Some URLs
- **Problem**: Some URLs that should have content extract 0 chars
- **Possible Reasons**:
  - JavaScript-rendered content (needs headless browser)
  - Paywalls or access restrictions
  - Redirects or broken links
  - Complex page structures our selectors don't catch

### 3. Content Extracted but Low Relevance Score
- **Problem**: Some citations extract good content (1,000+ chars) but get denied due to low AI score
- **Example**: "Palestine Action Italia homepage" - 1,853 chars, Score: 50.0
- **Analysis**: This might be a false negative - content is relevant but AI scored it low
- **Action**: Review threshold (currently 50) or improve AI scoring prompt

## Recommendations

1. **Continue Processing**: The enhanced extraction is working for most extractable URLs
2. **Filter Archive URLs Earlier**: Add archive.org to low-quality URL filter
3. **Monitor Save Rate**: Currently 0.2% save rate - this might be too low
4. **Review Denied High-Content Citations**: Check if citations with 1,000+ chars but denied should be reviewed
5. **Improve Archive Handling**: Consider special extraction logic for archive.org URLs

## Next Steps

1. Continue processing all 8,582 remaining citations
2. Monitor extraction quality metrics
3. Review denied citations with substantial content (>1000 chars)
4. Consider adjusting relevance threshold if save rate is too low

