# Carrot Design Plan

Last updated: 2025-09-22

This plan provides an organization-wide UX/design scaffold. It captures product goals, system guidance, measurable criteria, and deliverables. The media preloading/playback module is specified in detail in [FEED_MEDIA_DESIGN.md](./FEED_MEDIA_DESIGN.md).

---

## 0) Product Goals & Success Criteria (Krug, Cooper)
- **Do**
  - Define top 3 JTBD, primary personas, and 5 core tasks.
  - Pick a North Star metric (e.g., Weekly Active Creators) + 3 guardrails (task success, time-on-task, error rate).
- **Don’t**
  - Start from UI; start from user goals and constraints.
- **Measures**
  - Task success ≥ 90% for top tasks; p50 time-on-task ≤ 60s per task.
- **Deliverables**
  - One-page brief, JTBD statements, metric definitions.

## 1) Information Architecture & Navigation (Krug, Tidwell)
- **Do**
  - Shallow IA; 1–2 primary nav levels; persistent search.
  - Labeled navigation (clear noun/verb).
- **Don’t**
  - Mega-menus with mixed semantics.
- **Measures**
  - First-click success ≥ 80% (tree tests); nav depth ≤ 3 for top tasks.
- **Deliverables**
  - Sitemap, nav label inventory, tree-test report.

## 2) Layout & Grid (Samara, Frost)
- **Do**
  - 4/8pt spacing; 12-col web grid; 4–6 col mobile.
  - Max text line length 45–75 chars.
- **Don’t**
  - Inconsistent spacing; centered long paragraphs.
- **Measures**
  - Baseline grid adherence ≥ 95% (linting).
- **Deliverables**
  - Grid spec, spacing tokens, layout templates.

## 3) Typography (Lupton)
- **Do**
  - Establish scale (16 base; ratio 1.25); ≤ 2 families.
  - Real hierarchy: H1–H6, lead, body, caption.
- **Don’t**
  - All-caps body; line-height < 1.4.
- **Measures**
  - Contrast ≥ 4.5:1; consistent heading/body ratios.
- **Deliverables**
  - Type ramp, usage rules, fallback stack.

## 4) Color & Contrast (Refactoring UI, Lidwell)
- **Do**
  - **Carrot Orange System**: Primary orange (#f97316) with vibrant gradient schemes
  - 40+ curated gradient pairs for composer (Sunset Pop, Ocean Pop, Mint Pop, etc.)
  - Semantic roles (info/success/warn/error) with orange as primary action color
  - Duotone effects for hero images and portraits
- **Don't**
  - Color as sole meaning; static single-color schemes
- **Measures**
  - AA for text; 3:1 for non-text UI; color-blind sims pass
  - Gradient accessibility: maintain contrast ratios across gradient stops
- **Deliverables**
  - Orange-based palette with semantic mapping; gradient library; accessible pairs
  - **Key Colors**: #f97316 (primary), #ea580c (accent), vibrant gradient schemes

## 5) Visual Hierarchy & Spacing (Refactoring UI)
- **Do**
  - Deliberate contrast, size, weight, whitespace; group related items.
- **Don’t**
  - Equal weight on all buttons; zebra spacing.
- **Measures**
  - Five-second test: 80% identify the primary action.
- **Deliverables**
  - Component spacing rules; before/after examples.

## 6) Core Interaction Patterns (About Face, Tidwell)
- **Do**
  - **Composer Modal**: Full-screen overlay with gradient backgrounds and media previews
  - **Commitment Cards**: Carrot/stick text with gradient overlays and emoji indicators
  - **Video Players**: Thumbnail-first, 6s preroll, instant start when visible
  - **Media Upload**: Drag-and-drop with progress indicators and thumbnail generation
  - Primary action placement/labels consistent (e.g., "Create Post", "Create Group")
- **Don't**
  - Novel controls where standards exist; blocking modals for simple actions
- **Measures**
  - Pattern error rate < 2%; discoverability tests pass; media upload success > 95%
- **Deliverables**
  - Pattern library with do/don't and anti-patterns
  - **Key Patterns**: Composer modal, commitment cards, media players, gradient overlays

## 7) Forms & Input (Krug, Johnson)
- **Do**
  - Single-column; top-aligned labels; inline specific validation.
  - Progressive disclosure; sensible defaults.
- **Don’t**
  - Placeholder-as-label; required asterisks without legend.
- **Measures**
  - Completion ≥ 95%; avg corrections < 1.
- **Deliverables**
  - Form components; validation copy bank; error taxonomy.

## 8) Microinteractions (Saffer)
- **Do**
  - **Button Animations**: Scale transforms (hover:scale-105), shadow transitions, gradient shifts
  - **Media Interactions**: Thumbnail hover effects, video play/pause transitions, progress bars
  - **Form Feedback**: Real-time validation, upload progress with orange gradient fills
  - **Gradient Transitions**: Smooth color shifts in composer, card hover states
  - Subtle 200–300ms animations with proper easing curves
- **Don't**
  - Motion that blocks input; jarring transitions; excessive animation
- **Measures**
  - Feedback ≤ 100ms; animation ≤ 300ms; reduced-motion compliance
- **Deliverables**
  - Microinteraction specs (spinners, toasts, toggles, gradient transitions)
  - **Key Animations**: Button hover, media loading, gradient shifts, scale transforms

## 9) Content & Microcopy (Krug, Lidwell)
- **Do**
  - Action-first labels; plain-language help; examples near inputs.
  - Empty states: value + next step.
- **Don’t**
  - Blamey errors; vague “Something went wrong”.
- **Measures**
  - Readability ≤ Grade 8; error comprehension ≥ 90%.
- **Deliverables**
  - Voice & tone guide; empty/error/success copy kit.

## 10) Accessibility (Johnson)
- **Do**
  - Keyboard-first; focus outlines; skip links; ARIA roles.
  - Respect prefers-reduced-motion; captions/transcripts for media.
- **Don’t**
  - Pointer-only targets; hover-only reveals.
- **Measures**
  - WCAG 2.2 AA pass; keyboard audit 100%.
- **Deliverables**
  - A11y checklist; component ARIA specs; SR scripts.

## 11) Performance & Responsiveness
- **Do**
  - LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1; adaptive loading; skeletons for perceived speed.
- **Don’t**
  - Blocking webfonts without `font-display: swap`.
- **Measures**
  - Web Vitals p75 budgets met (RUM & Lighthouse CI).
- **Deliverables**
  - Perf budget; asset pipeline plan; critical-path CSS map.

## 12) Motion & Transitions (Saffer, Lidwell)
- **Do**
  - Motion to explain spatial relationships; reduced-motion alternatives.
- **Don’t**
  - Robotic easing; use standard ease-in-out.
- **Measures**
  - Users track continuity in tests.
- **Deliverables**
  - Motion guidelines: durations, easings, physics.

## 13) States: Loading, Empty, Error, Offline (Saffer)
- **Do**
  - Design as first-class screens with recovery paths.
- **Don’t**
  - Spinner-only beyond 2s.
- **Measures**
  - Recovery ≥ 90%; bounce from loading < 10%.
- **Deliverables**
  - State storyboard per core flow.

## 14) Search & Discovery (Tidwell)
- **Do**
  - Autosuggest, synonyms, recent queries, sticky filters.
  - Sort defaults match intent (e.g., relevance first).
- **Don’t**
  - Zero-result dead ends.
- **Measures**
  - Zero-result < 5%; refinement > 30%.
- **Deliverables**
  - Search schema; result card pattern; facet rules.

## 15) Onboarding & First-Run (Cooper)
- **Do**
  - Outcome-first; quick win in 60s; personalize defaults.
- **Don’t**
  - Long mandatory signups before value.
- **Measures**
  - Day-1 activation ≥ target; per-step drop-off < 15%.
- **Deliverables**
  - First-run flow; welcome scripts.

## 16) Notifications & Feedback Loops (Saffer)
- **Do**
  - Tiered urgency; user-tunable frequency and channels.
- **Don’t**
  - Red badges without meaning.
- **Measures**
  - Opt-out < 10%; engagement lift from relevant alerts.
- **Deliverables**
  - Notification matrix; copy library; throttle rules.

## 17) Trust, Security, & Consent UI
- **Do**
  - Plain-language permissions; progressive consent; visible privacy controls.
- **Don’t**
  - Dark patterns; pre-checked boxes.
- **Measures**
  - Permission comprehension ≥ 85%.
- **Deliverables**
  - Consent flows; data-use explainers; incident banner template.

## 18) Design System & Tokens (Atomic, Frost)
- **Do**
  - Tokens for color, type, spacing, radii, elevation; component API docs.
  - Versioned packages and deprecation policy.
- **Don’t**
  - Hard-coded style values in components.
- **Measures**
  - Token coverage 100% for style props; adoption ≥ 90% screens.
- **Deliverables**
  - Token JSON; component docs; Figma library; code package.

## 19) Internationalization & Localization
- **Do**
  - RTL, pluralization, date/number formats; 30% text expansion.
- **Don’t**
  - Strings in images; truncation without affordance.
- **Measures**
  - Pseudo-localization pass; RTL parity.
- **Deliverables**
  - i18n checklist; translation key map.

## 20) Data Visualization (Lidwell, Johnson)
- **Do**
  - Chart by question (compare, trend, distribution); direct labeling.
- **Don’t**
  - 3D effects; dual y-axes without context.
- **Measures**
  - Insight time ≤ 10s in tests.
- **Deliverables**
  - Chart styles; number formatting; a11y notes.

## 21) Media: Video/Audio, Captions, Transcripts (Saffer, Krug)
- **Do**
  - Thumbnail → 6s preroll sequencing; single-active playback; instant resume.
  - Always-on captions & transcripts (when available); picture-in-picture, speeds.
- **Don’t**
  - Autoplay with sound; black frames on pause.
- **Measures**
  - Time-to-first-frame (muted) near-instant; prefetch hit rate; no refetch storms.
- **Deliverables**
  - Player spec, transcript UI, chaptering guidelines.
  - Deep spec: see [FEED_MEDIA_DESIGN.md](./FEED_MEDIA_DESIGN.md).

## 22) Dark Mode (Refactoring UI)
- **Do**
  - Semantic roles separate from raw colors; test contrast in both modes.
- **Don’t**
  - Blindly invert brand colors.
- **Measures**
  - AA contrast preserved; bug parity.
- **Deliverables**
  - Dual palettes; theming tokens; dark-ready assets.

## 23) Offline & Resilience
- **Do**
  - Local cache for recent content; queue actions; reconcile on reconnect.
- **Don’t**
  - Silent failures.
- **Measures**
  - Successful retry ≥ 95%.
- **Deliverables**
  - Offline UX map; sync conflict patterns.

## 24) Analytics, Experimentation & Diagnostics
- **Do**
  - Event schema per journey; success & anti-success events; A/B with guardrails.
- **Don’t**
  - Vanity metrics disconnected from tasks.
- **Measures**
  - Experiment cadence; error rate trending down.
- **Deliverables**
  - Tracking plan; dashboards; experiment playbook.

## 25) Research & Usability Testing Cadence (Krug)
- **Do**
  - Monthly quick tests (n=5); quarterly deep studies; dogfood with instrumentation.
- **Don’t**
  - Ship major flows untested.
- **Measures**
  - Issues discovered per round; resolution SLA.
- **Deliverables**
  - Test scripts; scorecards; backlog integration.

## 26) Governance, Reviews & Checklists
- **Do**
  - Heuristics (10), A11y, Performance, Copy reviews; Definition of Done includes states, a11y.
- **Don’t**
  - Approve comps without component mapping.
- **Measures**
  - % tickets passing first review; defects pre-merge.
- **Deliverables**
  - PR checklist; design QA protocol; release checklist.

## 27) Explicit “Do Not Do” Anti-Patterns
- **Examples**: ambiguous CTAs; modal navigation; hover-only menus; placeholder-as-label; tiny targets (<44px); color-only validation; non-deterministic toasts; endless spinners; scroll-jacking.
- **Deliverables**: Living catalogue with examples and fixes.

## 28) Non-Negotiables (Ship-Blockers)
- Text contrast AA+; captions on all media; keyboard navigability.
- Primary action discoverable within 5s on key screens.
- LCP ≤ 2.5s p75 mobile; tap targets ≥ 44×44; visible focus always.

## 29) Carrot-Specific Design Patterns (From Home Page & Composer Analysis)
- **Hero Sections**: Large gradient backgrounds with duotone portrait overlays
  - Use real agent images from `/public/agents/` with grayscale + orange overlay effects
  - Quote text with gradient clipping and 45° highlight strokes
  - Responsive sizing: 40vh desktop, 36vh tablet, 34vh mobile
- **Composer Modal**: Full-screen overlay with gradient backgrounds
  - 40+ curated gradient schemes from `colorSchemes.ts`
  - Media preview with thumbnail generation and progress indicators
  - Carrot/stick text input with emoji indicators and gradient overlays
- **Button Design**: Orange gradient system with graphic elements
  - Primary: `from-orange-500 to-orange-600` with hover states
  - Scale transforms (hover:scale-105), shadow transitions, shine effects
  - Circular icon containers with background pattern overlays
- **Media Handling**: Thumbnail-first approach with instant playback
  - 6s video preroll for smooth feed experience
  - Duotone effects for portraits and hero images
  - Progress bars with orange gradient fills
- **Typography**: Gradient text effects for impact
  - Large hero quotes with gradient clipping and highlight strokes
  - Break-words for responsive text wrapping
  - Proper contrast ratios across gradient stops

---

## Appendix A: Component Blueprint (Template)
For each component (e.g., Post Card, Composer, Video Player):
- Purpose & user tasks
- States: default / hover / focus / active / disabled / loading / empty / error / success
- Anatomy & tokens used
- Behavior & microinteractions (triggers, rules, feedback, loops)
- A11y (roles, labels, keyboard map, SR text)
- Copy (labels, errors, hints)
- Performance budget & telemetry events
- Test cases (unit, visual, a11y, usability)

## Appendix B: Social Feed Module (Tailored)
- **Do**
  - Post cards with clear hierarchy: author → content → actions; locked media aspect; transcripts collapsed with “Expand (00:42)” and keyword jump.
  - Inline actions (like/comment/share) always visible; secondary actions in menu.
- **Don’t**
  - Truncate text without “Read more”; mix destructive and primary actions.
- **Measures**
  - Feed engagement lift; dwell time; scroll depth vs. action rate.
- **Deliverables**
  - Post card spec; composer spec (autosave, counters, media rules); moderation/reporting flows; share sheet.
