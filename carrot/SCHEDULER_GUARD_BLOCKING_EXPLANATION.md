# Scheduler Guard Blocking Explanation

## How Guards Work

The scheduler evaluates candidates in **strict order**. If ANY guard blocks a candidate, it's requeued and the next candidate is tried. Only if ALL guards pass does the candidate get accepted.

## Guard Check Order (Stops at First Block)

### 1. **Wiki Guard** (Blocks Wikipedia items)
- **Condition**: `wikiGuardActiveUntil > now` AND host is `wikipedia.org`
- **Why it triggers**: If Wikipedia attempts exceed 30% of total attempts in a 30-second window
- **Duration**: Active for 120 seconds (2 minutes) after trigger
- **Result**: ALL Wikipedia items blocked until guard expires

### 2. **Host Cap Guard** (Blocks specific hosts)
- **Condition**: Host has reached its attempt cap (default: 40 attempts per host)
- **Default Cap**: 40 attempts per host
- **Result**: ALL items from that host are blocked permanently (until reset)

### 3. **Wiki Low Diversity Guard** ⚠️ **MOST LIKELY CULPRIT**
- **Condition**: Host is `wikipedia.org` AND unique hosts seen < 3
- **Logic**: Prevents Wikipedia-heavy processing until diversity is established
- **Requirement**: Must see at least 3 unique hosts before processing ANY Wikipedia items
- **Problem**: If frontier is mostly Wikipedia items, they're ALL blocked, preventing diversity from increasing
- **Result**: ALL Wikipedia items blocked until 3+ non-Wikipedia hosts are processed

### 4. **Host Success Bias** (Blocks hosts with poor performance)
- **Condition**: Host has success rate EMA < 0.45 (45% success rate)
- **Logic**: Temporarily deprioritizes hosts with poor track records
- **Result**: Items from that host get lower priority (but may still pass if other guards allow)

### 5. **Contested Bias Guard** ⚠️ **LIKELY CULPRIT**
- **Condition**: `needsContestedBias() === true` AND candidate is NOT contested
- **Triggers when**: 
  - At least 5 items processed
  - AND (contested attempt ratio < 50% OR contested save ratio < 40%)
- **Logic**: Forces processing of controversial content when ratio is too low
- **Result**: ALL non-contested items blocked until contested ratio improves

### 6. **QPS Throttle Guard** (Rate limiting)
- **Condition**: Host was accessed less than `1000/qpsPerHost` milliseconds ago
- **Default QPS**: 0.5 per host (max 1 request per 2 seconds per host)
- **Logic**: Prevents hammering the same host too quickly
- **Result**: Items from that host temporarily blocked (unblocks after throttle period)

---

## Most Likely Scenarios Blocking Your Run

Based on your logs showing:
- 51 items in frontier
- 3 items processed (2 failures)
- All items being requeued

### Scenario 1: **Wiki Low Diversity Guard** (Most Likely)

**What's happening:**
1. Frontier has 51 items, mostly Wikipedia citations/pages
2. Engine processed 3 items (probably all from same or < 3 hosts)
3. Wiki Low Diversity guard requires 3+ unique hosts before processing Wikipedia items
4. Since most frontier items are Wikipedia, they're ALL blocked
5. Engine can't process non-Wikipedia items because there aren't enough, or they're also blocked
6. **Deadlock**: Can't increase diversity because items needed to increase diversity are blocked

**Check**: How many unique hosts have been seen? If < 3, this is the blocker.

### Scenario 2: **Contested Bias Guard**

**What's happening:**
1. Engine processed 3 items
2. None were contested (or < 50% contested ratio)
3. Contested bias guard activates (needs contested content)
4. ALL non-contested items in frontier are blocked
5. If frontier has no/few contested items, everything is blocked

**Check**: Are items marked as contested? Is the controversy ratio too low?

### Scenario 3: **Host Cap Reached**

**What's happening:**
1. Engine processed 3 items from the same host
2. That host hit its cap (40 attempts) very quickly (unlikely but possible)
3. ALL items from that host are blocked
4. If frontier is all from that one host, everything is blocked

**Check**: Which hosts were processed? Did any hit 40 attempts?

---

## Why This Creates a Deadlock

The guards are designed to prevent:
- Wikipedia-heavy processing (diversity guard)
- Non-controversial content domination (contested bias)
- Host hammering (QPS throttle, host cap)

But if the frontier composition doesn't match guard requirements, **all items can be blocked simultaneously**, creating a deadlock where:
- No items can be processed
- Guards can't be satisfied
- Engine spins in a loop

---

## Solutions

1. **Increase retry limit** in `pullCandidateWithBias` (currently 12 attempts)
2. **Add fallback logic** - After N failed attempts, accept the best candidate anyway
3. **Relax guards temporarily** when stuck
4. **Better frontier seeding** - Ensure diversity from the start
5. **Logging** - Track which specific guard is blocking to diagnose

---

## Diagnosis Needed

To determine the exact blocker, check:
1. **Host diversity count** - How many unique hosts seen?
2. **Wiki guard state** - Is it active? When does it expire?
3. **Contested bias state** - Is it active? What's the contested ratio?
4. **Host attempt counts** - Which hosts hit their caps?
5. **Frontier composition** - What types of items are in the frontier?

