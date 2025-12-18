# Carrot Project - File Structure Analysis

**Analysis Date:** January 2025  
**Project Type:** Next.js Application with Discovery/Content Management System

## Executive Summary

The Carrot project is a complex Next.js application with extensive functionality for content discovery, AI agent management, media processing, and Wikipedia citation processing. The codebase shows active development with many features, but suffers from organizational issues including:

- **Root directory clutter** (200+ files in root)
- **Inconsistent naming conventions**
- **Mixed concerns** (scripts, docs, configs all in root)
- **Duplicate/outdated documentation**
- **Test files scattered** across multiple locations

## Overall Structure

### ✅ Well-Organized Directories

1. **`src/`** - Main application code
   - `app/` - Next.js App Router structure (well-organized)
   - `lib/` - Core business logic (230+ files, well-modularized)
   - `components/` - React components (organized by feature)
   - `hooks/` - Custom React hooks
   - `types/` - TypeScript type definitions

2. **`prisma/`** - Database schema and migrations
   - Clean migration structure
   - Proper versioning

3. **`docs/`** - Documentation (though some overlap with root .md files)

4. **`scripts/`** - Utility scripts (200+ scripts, needs organization)

### ⚠️ Problem Areas

1. **Root Directory Clutter**
   - 200+ files in root directory
   - Mix of: `.js`, `.ts`, `.md`, `.json`, `.sh`, `.bat`, `.csv`, `.html`
   - No clear organization

2. **Documentation Duplication**
   - 172+ `.md` files total
   - Many overlapping topics
   - Root has 100+ `.md` files
   - `docs/` has 50+ `.md` files
   - No clear distinction between root docs and `docs/` folder

3. **Script Organization**
   - 200+ scripts in root and `scripts/` folder
   - Many one-off scripts that may be obsolete
   - No clear categorization

4. **Test Files**
   - Tests in `src/lib/__tests__/`
   - Tests in `src/tests/`
   - Some test files in root (`test-*.js`)
   - Inconsistent naming

## Detailed Directory Analysis

### `/carrot` (Root Directory)

**Issues:**
- **200+ files** directly in root
- Mix of concerns: scripts, docs, configs, data files
- Many temporary/audit files (e.g., `bulls.audit-*.json` - 18 files)
- Test files mixed with production code
- No clear entry point documentation

**Files by Category:**

#### Documentation (100+ files)
- Status reports: `CITATION-PROCESSING-STATUS-*.md` (multiple versions)
- Analysis docs: `DISCOVERY_*_ANALYSIS.md` (many duplicates)
- Implementation guides: `AGENT-*.md`, `WIKIPEDIA-*.md`
- **Recommendation:** Consolidate into `docs/` with clear structure

#### Scripts (50+ files in root)
- `check-*.js` (15+ files)
- `debug-*.js` (5+ files)
- `fix-*.js` (5+ files)
- `backfill-*.js` (3+ files)
- `test-*.js` (5+ files)
- **Recommendation:** Move all to `scripts/` with subdirectories

#### Configuration Files
- `package.json`, `tsconfig.json` ✅ (correct location)
- `next.config.js`, `tailwind.config.js` ✅ (correct location)
- `firebase.json`, `firebase.rules` ✅ (correct location)
- `render.yaml` ✅ (correct location)
- `cors.json`, `cors-config.json` ⚠️ (duplicate? should be in config/)

#### Data/Audit Files
- `bulls.audit-*.json` (18 files) ⚠️ (should be in `reports/` or `temp/`)
- `storage.json` ⚠️ (should be in config or gitignored)
- `ts-errors.txt` ⚠️ (temporary, should be gitignored)

#### Test/HTML Files
- `extraction-test-page.html` ⚠️ (should be in `public/` or `tests/`)
- `test-*.js` files ⚠️ (should be in `scripts/` or `tests/`)

### `/carrot/src`

**Structure: ✅ Well-Organized**

```
src/
├── app/              # Next.js App Router (246 API routes, many pages)
├── components/       # React components (organized by feature)
├── lib/              # Core business logic (230+ files)
├── hooks/            # Custom React hooks
├── types/             # TypeScript definitions
├── styles/            # CSS/styling
└── utils/             # Utility functions
```

**Strengths:**
- Clear separation of concerns
- Follows Next.js conventions
- Good component organization
- Proper TypeScript usage

**Issues:**
- `src/lib/` has 230+ files - may need subdirectories
- Some components could be better organized
- Test files scattered (`__tests__/`, `tests/`)

### `/carrot/src/lib`

**Analysis:**
- **230+ TypeScript files** - Core business logic
- Well-modularized by feature:
  - `discovery/` - 65 files (content discovery system)
  - `ai-agents/` - 20+ files (AI agent management)
  - `media/` - 16 files (media processing)
  - `crawler/` - 8 files (web crawler)
  - `enrichment/` - 3 files (content enrichment)
  - `agent/` - 3 files (agent feeding)

**Strengths:**
- Clear feature-based organization
- Good separation of concerns
- Proper TypeScript typing

**Recommendations:**
- Consider splitting very large directories (e.g., `discovery/` with 65 files)
- Add index files for cleaner imports
- Document module boundaries

### `/carrot/src/app/api`

**Analysis:**
- **246 API route files** - Extensive API surface
- Well-organized by feature:
  - `agents/` - AI agent APIs
  - `ai/` - AI processing APIs
  - `patches/` - Patch management
  - `media/` - Media handling
  - `discovery/` - Discovery system
  - `crawler/` - Crawler APIs

**Strengths:**
- RESTful structure
- Clear route organization
- Proper Next.js App Router usage

**Issues:**
- Very large API surface (246 routes) - may indicate need for microservices
- Some routes may be redundant
- No clear API versioning strategy

### `/carrot/scripts`

**Analysis:**
- **200+ script files** - Utility and maintenance scripts
- Mix of:
  - `check-*.ts` (30+ files) - Status checking scripts
  - `backfill-*.ts` (20+ files) - Data backfill scripts
  - `test-*.ts` (15+ files) - Test scripts
  - `analyze-*.ts` (10+ files) - Analysis scripts
  - `fix-*.ts` (5+ files) - Fix scripts

**Issues:**
- No subdirectory organization
- Many scripts may be obsolete
- No clear documentation of what each script does
- Mix of `.js` and `.ts` files

**Recommendations:**
- Organize into subdirectories:
  - `scripts/check/` - Status checking
  - `scripts/backfill/` - Data backfill
  - `scripts/test/` - Test scripts
  - `scripts/analysis/` - Analysis scripts
  - `scripts/fix/` - Fix scripts
  - `scripts/maintenance/` - Maintenance scripts
- Add README.md explaining each script
- Mark obsolete scripts or move to `scripts/archive/`

### `/carrot/prisma`

**Structure: ✅ Well-Organized**

```
prisma/
├── schema.prisma          # Main schema
├── schema_clean.prisma    # Clean version?
├── migrations/            # Database migrations (properly versioned)
└── seed-*.ts              # Seed scripts
```

**Strengths:**
- Proper migration structure
- Versioned migrations
- Clear schema organization

**Issues:**
- `schema_clean.prisma` - unclear purpose
- Multiple seed files - could be consolidated

### `/carrot/docs`

**Analysis:**
- **50+ documentation files**
- Mix of:
  - Architecture docs
  - Implementation guides
  - API references
  - Setup guides

**Issues:**
- Overlaps with root `.md` files
- No clear organization structure
- No index/navigation

**Recommendations:**
- Create clear subdirectories:
  - `docs/architecture/`
  - `docs/guides/`
  - `docs/api/`
  - `docs/setup/`
- Create `docs/README.md` with navigation
- Consolidate with root `.md` files

## Critical Issues

### 1. Root Directory Clutter ⚠️ **HIGH PRIORITY**

**Problem:** 200+ files in root directory makes navigation difficult

**Impact:**
- Hard to find files
- No clear project structure
- Difficult for new developers
- Git diffs are cluttered

**Solution:**
```
carrot/
├── README.md              # Main project README
├── package.json           # Keep in root
├── tsconfig.json          # Keep in root
├── next.config.js         # Keep in root
├── .env.example           # Keep in root
├── docs/                  # All documentation
│   ├── README.md          # Documentation index
│   ├── architecture/
│   ├── guides/
│   ├── api/
│   └── setup/
├── scripts/               # All scripts
│   ├── README.md          # Scripts index
│   ├── check/
│   ├── backfill/
│   ├── test/
│   └── maintenance/
├── config/                # Configuration files
│   ├── cors.json
│   └── storage.json
├── reports/               # Audit/report files
│   └── bulls.audit-*.json
└── temp/                  # Temporary files (gitignored)
```

### 2. Documentation Duplication ⚠️ **MEDIUM PRIORITY**

**Problem:** Same topics documented in multiple places

**Examples:**
- Citation processing: 10+ files
- Discovery system: 15+ files
- Agent system: 8+ files

**Solution:**
- Consolidate related docs into single authoritative sources
- Use cross-references instead of duplication
- Archive outdated versions
- Create documentation index

### 3. Script Organization ⚠️ **MEDIUM PRIORITY**

**Problem:** 200+ scripts with no organization

**Solution:**
- Organize into subdirectories by purpose
- Add README.md explaining each script
- Mark obsolete scripts
- Create script registry/index

### 4. Test File Scattering ⚠️ **LOW PRIORITY**

**Problem:** Tests in multiple locations

**Current:**
- `src/lib/__tests__/` - Unit tests
- `src/tests/` - Integration tests
- Root `test-*.js` - Ad-hoc tests

**Solution:**
- Consolidate test structure
- Use consistent naming
- Document test organization

## Recommendations by Priority

### 🔴 High Priority

1. **Clean Root Directory**
   - Move all scripts to `scripts/` with subdirectories
   - Move all docs to `docs/` with structure
   - Move config files to `config/`
   - Move audit files to `reports/`
   - Update all imports/references

2. **Create Project README**
   - Replace minimal README.md
   - Add project overview
   - Link to key documentation
   - Add getting started guide

3. **Documentation Index**
   - Create `docs/README.md` with navigation
   - Consolidate duplicate docs
   - Archive outdated versions

### 🟡 Medium Priority

4. **Script Organization**
   - Organize scripts into subdirectories
   - Add script documentation
   - Create script registry

5. **API Documentation**
   - Document all 246 API routes
   - Create API reference
   - Add versioning strategy

6. **Code Organization**
   - Split large directories (e.g., `lib/discovery/`)
   - Add index files for cleaner imports
   - Document module boundaries

### 🟢 Low Priority

7. **Test Organization**
   - Consolidate test structure
   - Standardize naming
   - Document test strategy

8. **Configuration Management**
   - Consolidate config files
   - Document configuration options
   - Add validation

## File Naming Conventions

### Current Issues

- **Inconsistent casing:**
  - `CITATION-PROCESSING-*.md` (uppercase)
  - `discovery-*.md` (lowercase)
  - `AGENT-*.md` (uppercase)

- **Inconsistent separators:**
  - `CITATION-PROCESSING-*.md` (hyphens)
  - `DISCOVERY_*_ANALYSIS.md` (underscores)
  - `AGENT-*.md` (hyphens)

- **Inconsistent prefixes:**
  - `check-*.js` vs `check-*.ts`
  - `test-*.js` vs `test-*.ts`
  - `backfill-*.js` vs `backfill-*.ts`

### Recommended Conventions

**Documentation:**
- Use kebab-case: `citation-processing-guide.md`
- Use descriptive names: `agent-feed-implementation.md`
- Group by topic: `discovery/`, `agents/`, `api/`

**Scripts:**
- Use kebab-case: `check-citation-status.ts`
- Use consistent prefixes: `check-`, `backfill-`, `test-`, `fix-`
- Use `.ts` for TypeScript, `.js` for JavaScript (prefer `.ts`)

**Components:**
- Use PascalCase: `CitationProcessor.tsx`
- Match file name to export name

**API Routes:**
- Use kebab-case: `citation-processing/route.ts`
- Follow REST conventions

## Statistics

### File Counts

- **Total files:** ~2,000+
- **TypeScript files:** ~800+
- **JavaScript files:** ~300+
- **Markdown files:** ~172
- **JSON files:** ~50+
- **Test files:** ~30+

### Directory Sizes

- `src/lib/`: 230+ files
- `src/app/api/`: 246 route files
- `scripts/`: 200+ script files
- `src/components/`: 100+ component files
- Root directory: 200+ files (⚠️ problem)

### Code Organization

- **Well-organized:** `src/`, `prisma/`, `docs/`
- **Needs work:** Root directory, `scripts/`, documentation structure
- **Good practices:** TypeScript usage, component organization, API structure

## Migration Plan

### Phase 1: Documentation (Week 1)
1. Create `docs/` structure
2. Move and organize all `.md` files
3. Create documentation index
4. Consolidate duplicates

### Phase 2: Scripts (Week 2)
1. Create `scripts/` subdirectories
2. Move and organize all scripts
3. Add script documentation
4. Update references

### Phase 3: Root Cleanup (Week 3)
1. Move config files to `config/`
2. Move audit files to `reports/`
3. Update all imports/references
4. Update `.gitignore`

### Phase 4: Code Organization (Week 4)
1. Split large directories
2. Add index files
3. Document module boundaries
4. Update imports

## Conclusion

The Carrot project has a solid codebase with good TypeScript usage and clear feature organization in `src/`. However, the root directory clutter and documentation duplication significantly impact maintainability and developer experience.

**Key Strengths:**
- ✅ Well-organized `src/` directory
- ✅ Good TypeScript usage
- ✅ Clear feature separation
- ✅ Proper Next.js structure

**Key Weaknesses:**
- ❌ Root directory clutter (200+ files)
- ❌ Documentation duplication
- ❌ Script organization
- ❌ Inconsistent naming

**Priority Actions:**
1. Clean root directory (high impact, medium effort)
2. Organize documentation (high impact, low effort)
3. Organize scripts (medium impact, medium effort)
4. Standardize naming (low impact, high effort)

With focused effort, these issues can be resolved in 3-4 weeks, significantly improving the project's maintainability and developer experience.

