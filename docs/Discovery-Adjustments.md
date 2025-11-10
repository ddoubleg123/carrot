## Discovery Adjustments (Planner/Vetter V2.1 refinements)

- Planner prompt tightened with 10-seed (5 establishment / 5 contested) split, verification targets, quote hints, and domain cap enforcement.
- Vetter prompt updated to require citation anchors and enforce the two-quote/150-word fair-use limit.
- Planner seeds now persist on patch creation/backfill; orchestrator seeds frontier from stored guide and falls back only when planner fails.
- Redis frontier prioritises planner priorities/stances; skip counters exposed in the UI with streaming skeleton tile occupying first slot.
- Hero generation route now returns AI-only results (Wikimedia/SVG handled by pipeline) and run stop produces `suspended` status with audit summary maintained.

