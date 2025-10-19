# 🗑️ Cleanup Checklist - Delete After Testing

## ⚠️ **DO NOT DELETE UNTIL TESTING CONFIRMS SYSTEM WORKS**

Test the enhanced discovery system first:
1. Visit: https://carrot-app.onrender.com/patch/chicago-bulls
2. Click "Start Discovery"
3. Verify no duplicates appear
4. Check console for batched log summary (not spam)
5. Confirm items stream correctly

---

## ✅ **KEEP THESE FILES** (Currently in use)

### **Utilities** (Actively used by enhanced system):
- ✅ `carrot/src/lib/discovery/canonicalization.ts` - **IN USE** by start-discovery route
- ✅ `carrot/src/lib/discovery/logger.ts` - **IN USE** by start-discovery route
- ✅ `carrot/src/lib/discovery/simhash.ts` - **KEEP** for future content fingerprinting

### **Documentation** (Reference):
- ✅ `carrot/docs/DISCOVERY-COMPARISON.md` - Explains our approach
- ✅ `carrot/docs/ENHANCED-DISCOVERY-READY.md` - Testing guide
- ✅ `carrot/docs/DISCOVERY-SYSTEM-README.md` - Architecture reference
- ✅ `carrot/docs/DISCOVERY-SYSTEM-TESTING.md` - Test procedures
- ✅ `carrot/docs/DISCOVERY-SYSTEM-SUMMARY.md` - Summary

---

## ❌ **DELETE THESE FILES** (Unused / Duplicate)

### **Unused New System Files**:

```bash
# Delete unused discovery components
rm carrot/src/lib/discovery/deduplication.ts
rm carrot/src/lib/discovery/discovery-loop.ts
rm carrot/src/lib/discovery/frontier.ts
rm carrot/src/lib/discovery/providers.ts
rm carrot/src/lib/discovery/redis.ts
rm carrot/src/lib/discovery/sse.ts
rm carrot/src/lib/discovery/migration.ts

# Delete duplicate API route
rm carrot/src/app/api/patches/[handle]/discovery/stream/route.ts

# Delete duplicate frontend components
rm carrot/src/app/patch/[handle]/hooks/useDiscoveryStream.ts
rm carrot/src/app/patch/[handle]/components/DiscoveryHeader.tsx
rm carrot/src/app/patch/[handle]/components/DiscoveryList.tsx
# NOTE: DiscoveryCard.tsx and ContentModal.tsx already existed, check if duplicates

# Delete unused scripts
rm carrot/scripts/migrate-discovery.ts
rm carrot/scripts/deploy-discovery-system.sh

# Delete accidental nested prisma folder (if it exists)
rm -rf carrot/carrot/prisma
```

---

## 📋 **Cleanup Script** (Run after testing)

```bash
#!/bin/bash
# cleanup-unused-discovery.sh

cd carrot

echo "🗑️ Cleaning up unused discovery system files..."

# Discovery library files (keep only canonicalization, logger, simhash)
rm -f src/lib/discovery/deduplication.ts
rm -f src/lib/discovery/discovery-loop.ts
rm -f src/lib/discovery/frontier.ts
rm -f src/lib/discovery/providers.ts
rm -f src/lib/discovery/redis.ts
rm -f src/lib/discovery/sse.ts
rm -f src/lib/discovery/migration.ts

# Duplicate API route
rm -f src/app/api/patches/[handle]/discovery/stream/route.ts

# Duplicate frontend hooks
rm -f src/app/patch/[handle]/hooks/useDiscoveryStream.ts

# Duplicate frontend components (check first if they're actually duplicates)
rm -f src/app/patch/[handle]/components/DiscoveryHeader.tsx
rm -f src/app/patch/[handle]/components/DiscoveryList.tsx

# Unused scripts
rm -f scripts/migrate-discovery.ts
rm -f scripts/deploy-discovery-system.sh

# Accidental nested folder
rm -rf carrot/prisma

echo "✅ Cleanup complete!"
echo ""
echo "Files kept (in use):"
echo "  ✓ src/lib/discovery/canonicalization.ts"
echo "  ✓ src/lib/discovery/logger.ts"
echo "  ✓ src/lib/discovery/simhash.ts"
echo ""
echo "Commit the deletions:"
echo "  git add -A"
echo "  git commit -m 'cleanup: remove unused discovery system files'"
echo "  git push"
```

---

## 🎯 What to Keep for Future

If we ever need advanced features, we can recreate them from the docs:

### **Redis Caching** (If DB queries become slow):
- Docs: `DISCOVERY-SYSTEM-README.md` has full Redis implementation
- Code: Git history has full `redis.ts` file

### **Search Frontier** (If we need multi-source rotation):
- Docs: `DISCOVERY-SYSTEM-README.md` has frontier algorithm
- Code: Git history has full `frontier.ts` file

### **Content Fingerprinting** (If near-duplicates appear):
- We kept `simhash.ts` for this exact reason
- Can add to start-discovery route in ~20 lines

---

## ✅ **Action Plan**

### **NOW:**
1. Test enhanced system on production
2. Verify no regressions
3. Confirm duplicate detection works

### **AFTER TESTING PASSES:**
1. Run cleanup script
2. Commit deletions
3. Push to git
4. Update main README

### **IF ISSUES:**
1. Debug specific problem
2. Fix in existing route (not new system)
3. Keep it simple

---

**Remember**: We're enhancing a WORKING system, not debugging a NEW one. Much safer! 🎯
