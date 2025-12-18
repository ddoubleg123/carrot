# Citation Storage Fixes

## Issues Fixed

### 1. ✅ Wikipedia Links Being Stored as Citations
**Problem**: 8,521 relative Wikipedia links (like `./Prime_Minister`) were being stored as citations
**Fix**: Modified `wikipediaCitation.ts` to skip Wikipedia internal links entirely - they are NOT citations
**Result**: Only external URLs (http/https) are now stored as citations

### 2. ✅ Missing Citations (55/258 stored)
**Problem**: Only 55 out of 258 external citations were being stored for Israel page
**Root Cause**: Duplicate detection was using `sourceNumber` (sequential index) instead of URL
**Fix**: 
- Changed duplicate detection to check by URL (more reliable)
- Added logic to handle sourceNumber conflicts (find next available number)
- This ensures all unique external URLs are stored

### 3. ✅ Improved Deduplication
**Fix**: Now checks for existing citations by URL, not by sourceNumber
- If URL exists, updates the existing record
- If URL is new, finds next available sourceNumber to avoid unique constraint violations

## Code Changes

### `wikipediaCitation.ts`

1. **Removed Wikipedia link storage**:
   ```typescript
   // OLD: Combined external + Wikipedia links
   const prioritized = [...prioritizedExternal, ...prioritizedWikipedia]
   
   // NEW: Only external citations
   const prioritized = prioritizedExternal
   console.log(`Skipping ${wikipediaCitations.length} Wikipedia internal links (not citations)`)
   ```

2. **Fixed duplicate detection**:
   ```typescript
   // OLD: Check by sourceNumber (unreliable)
   const existing = await prisma.wikipediaCitation.findUnique({
     where: { monitoringId_sourceNumber: { monitoringId, sourceNumber } }
   })
   
   // NEW: Check by URL (reliable)
   const existing = await prisma.wikipediaCitation.findFirst({
     where: { monitoringId, citationUrl: citation.url }
   })
   ```

3. **Handle sourceNumber conflicts**:
   ```typescript
   // If sourceNumber is taken, find next available
   let finalSourceNumber = sourceNumber
   const check = await prisma.wikipediaCitation.findUnique({
     where: { monitoringId_sourceNumber: { monitoringId, sourceNumber: finalSourceNumber } }
   })
   if (check) {
     // Find next available sourceNumber
     const max = await prisma.wikipediaCitation.findFirst({
       where: { monitoringId },
       orderBy: { sourceNumber: 'desc' }
     })
     finalSourceNumber = (max?.sourceNumber || 0) + 1
   }
   ```

## Expected Results

After these fixes:
- **Israel page**: Should store all 258 external citations (not just 55)
- **All pages**: Should store ALL external citations, not Wikipedia links
- **Database**: No more Wikipedia links cluttering the citations table

## Next Steps (TODO)

1. **Test the fix**: Re-extract citations from Israel page and verify all 258 are stored
2. **Create separate table** (if needed): For tracking Wikipedia page relationships
3. **Clean up database**: Remove existing Wikipedia links from citations table
4. **Verify extraction**: Ensure all Wikipedia pages extract all external citations
5. **Monitor**: Watch for any edge cases or issues

## Testing

To test the fix:
```bash
# Re-extract citations from Israel page
npx tsx scripts/check-israel-wikipedia-citations.ts --patch=israel

# Check database
# Should see ~258 external citations, 0 Wikipedia links
```

## Notes

- Wikipedia internal links (`./PageName`) are **NOT citations** - they're internal references
- If we need to track Wikipedia page relationships, we should use a separate table
- The extraction function (`extractWikipediaCitationsWithContext`) already filters out Wikipedia links correctly
- The issue was in the storage logic, not the extraction logic

