# Israel Patch - Wikipedia Pages Found

## 10 Wikipedia Pages Found

Based on tags: `["israel","palestine","apartheid","geopolitics","zionism"]`

### Zionism-Related Pages (5):
1. **"Zionism"** - https://en.wikipedia.org/wiki/Zionism
2. **"Zionism in Iraq"** - https://en.wikipedia.org/wiki/Zionism_in_Iraq
3. **"Zionism in the Age of the Dictators"** - https://en.wikipedia.org/wiki/Zionism_in_the_Age_of_the_Dictators
4. **"Zionism in Morocco"** - https://en.wikipedia.org/wiki/Zionism_in_Morocco
5. **"Zionism as settler colonialism"** - https://en.wikipedia.org/wiki/Zionism_as_settler_colonialism

### Geopolitics-Related Pages (5):
6. **"Geopolitics"** - https://en.wikipedia.org/wiki/Geopolitics
7. **"Geopolitics Quarterly"** - https://en.wikipedia.org/wiki/Geopolitics_Quarterly
8. **"Geopolitics (journal)"** - https://en.wikipedia.org/wiki/Geopolitics_(journal)
9. **"Geopolitics of the Roman Empire"** - https://en.wikipedia.org/wiki/Geopolitics_of_the_Roman_Empire
10. **"Geopolitics of the Arctic"** - https://en.wikipedia.org/wiki/Geopolitics_of_the_Arctic

## Status
- All pages: `pending` status
- Content Scanned: `false` (not scanned yet)
- Citations Extracted: `false` (not extracted yet)
- Citation Count: `0` (no citations yet)

## Why Discovery Didn't Auto-Start

**Current Behavior**: 
- Wikipedia monitoring is initialized automatically ✅
- Discovery is NOT started automatically ❌

**Issue**: The patch creation route (`/api/patches/route.ts`) only initializes Wikipedia monitoring but doesn't trigger discovery. Discovery must be manually started via `/api/patches/[handle]/start-discovery`.

**Solution**: Add auto-start discovery after patch creation (similar to test wizard).

