## Discovery V2 Adjustments

This checklist captures the env knobs, rollout steps, and acceptance gates for the DISCOVERY_V2 launch. Keep it alongside the sign‑off doc; update the flag column or checkboxes as you land follow‑up work.

### Feature Flags

| Flag | Default | Notes |
| --- | --- | --- |
| `DISCOVERY_V2` | `false` | Master enable for the v2 pipeline. Must be `true` to run any of the new code paths. |
| `DISCOVERY_V2_SHADOW_MODE` | `false` | When `true`, discovery v2 runs alongside legacy but persists results to shadow storage only. |
| `DISCOVERY_V2_WRITE_MODE` | `false` | Flip **after** shadow SLOs are green; enables write mode for flagged patches. |
| `DISCOVERY_V2_GUARD_STRICT_SEEDS` | `false` | Optional hard guard that fails runs if planner seeds do not meet coverage requirements. |
| `DISCOVERY_V2_FORCE_STOP_PATCHES` | `''` | CSV of patch handles or IDs that should be blocked (pauses engine + backfill). |

> Tip: flags are read once per boot. Restart the worker after changing values.

### Rollout Steps

1. **Shadow mode**  
   - Enable `DISCOVERY_V2=true` and `DISCOVERY_V2_SHADOW_MODE=true`.  
   - Target a single staging patch (or use `DISCOVERY_V2_FORCE_STOP_PATCHES` to fence others).  
   - Monitor SLOs (time-to-first, controversy ratio, wiki share) for ≥3 days.

2. **Go/No-Go**  
   - All shadow SLOs green.  
   - Audit UI shows seeds vs queries, coverage, and operator controls.  
   - Legacy path confirmed unaffected for unflagged patches.

3. **Write Mode**  
   - Flip `DISCOVERY_V2_WRITE_MODE=true` for the staged patch.  
   - Verify zero duplicate inserts, working `View Source`, hero coverage.  
   - Expand to additional patches gradually (remove from force-stop list).

### Rollback

1. Set `DISCOVERY_V2_WRITE_MODE=false` (immediate stop to writes).  
2. Optionally set `DISCOVERY_V2=false` to drop back to legacy everywhere.  
3. Clear v2 Redis keys if you need a clean restart:
   - `frontier:patch:{id}`
   - `plan:run:{id}*`
   - `seen:patch:{id}`
   - `hashes:patch:{id}`
   - `discovery:counters:{id}`
4. Monitor audit feed to confirm the engine is paused; legacy path should resume automatically.

### Acceptance Gates (Shadow → Write)

- Time-to-first-save ≤ 4s median (warm topic).  
- First 20 dequeues contain ≥6 distinct hosts, ≤2 per host.  
- First 20 saves include ≥5 `isControversy=true`.  
- Wikipedia share ≤30% per 30s window (alert at >45%).  
- No duplicate inserts (DB unique + Redis seen).  
- Each saved card: working `View Source`, hero image (AI → Wikimedia → skeleton), Why It Matters, 3–6 facts w/ citations.

### Backfill Endpoint

- `POST /api/admin/discovery/backfill-plan?patch=:handle`  
- Requires DISCOVERY_V2 on and kill switch off.  
- Generates and persists the plan if missing, then warms the frontier (seeds + planner queries).  
- Response includes plan hash, seeds queued, and host summary.  
- Use this when onboarding new patches or refreshing stale plans.

### Operational Notes

- Shadow runs should keep legacy cards visible—ensure UI toggles and audit banner reflect run state.  
- Use `DISCOVERY_V2_FORCE_STOP_PATCHES` during incidents; the engine checks both handle and patch ID.  
- Operator controls are log-only in v1; review audit feed for every action.  
- `render.yaml` now runs `npm run lint:v2 && npm run test:v2` before build; keep the scoped suites green.  
- Update this doc if we add new knobs or change SLO thresholds.

## Discovery Adjustments (Planner/Vetter V2.1 refinements)

- Planner prompt tightened with 10-seed (5 establishment / 5 contested) split, verification targets, quote hints, and domain cap enforcement.
- Vetter prompt updated to require citation anchors and enforce the two-quote/150-word fair-use limit.
- Planner seeds now persist on patch creation/backfill; orchestrator seeds frontier from stored guide and falls back only when planner fails.
- Redis frontier prioritises planner priorities/stances; skip counters exposed in the UI with streaming skeleton tile occupying first slot.
- Hero generation route now returns AI-only results (Wikimedia/SVG handled by pipeline) and run stop produces `suspended` status with audit summary maintained.

### Follow-Up Actions

- Prepare a follow-up PR that splits Jest into distinct projects (`legacy` default, `v2` opt-in via flag) so the pipeline can expand coverage without impacting deploys.
- Open and track a ticket to re-enable the full Jest suite (legacy + v2) once the legacy hook/lint failures across non-discovery components are resolved.

