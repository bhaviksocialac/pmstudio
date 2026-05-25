This is a large system. I'll ship it in 4 phases so each is testable before moving on. Reply `go` to start Phase 1, or `all` to run all phases back-to-back.

## Phase 1 — Morning Briefing card + Fasttrack Score (core shell)

On the dashboard (`/`), add a charcoal card at the top:
- "Good morning {first name}" in Cormorant Garamond + today's date
- **Fasttrack Score** (top-right): 0–100, green/amber/red, week-over-week arrow
- Three sections: **Do Today** (max 5), **Watch This Week** (max 3), **Order Now** (max 3)
- Each item: one-line summary + one-tap action button

Computed client-side from existing data (tasks, snags, vendor_deliveries, invoices, payment_requests, task_status_history). No new tables needed for v1.

Rules:
- Do Today: approvals pending >3d (IFA stale), invoices due today, overdue snags, IFC not issued after approval >2d, payments due today
- Watch This Week: idle-contractor risk (next task starts in ≤7d with undelivered material), vendor with prior delays + delivery this week, handover ≤7d with open snags
- Order Now: tasks starting in ≤ (vendor lead time + buffer) without a placed PO
- Fasttrack: weighted score from avg approval response, on-time deliveries, idle days, overdue payments

Action buttons (Phase 1): open relevant existing flow (message composer, invoice form, vendor PO). Pre-filled drafts come in Phase 2.

## Phase 2 — Action drafting + one-tap apply
- AI-drafted follow-up messages (uses existing `task-narrative` / `ai-drafts` pipeline) shown in a small confirm sheet
- "Create PO" pre-fills vendor + scope + quantity from the linked task
- Parallel-work suggestions ("Start Now — No Blockers") appear in Do Today

## Phase 3 — Project Health row + Evening Summary
- One card per active project under the briefing (completion %, days left, score, top risk, action)
- 6pm evening card variant: today's tasks done, approvals received, delays, tomorrow's critical, "good work" vs "X pending"
- Time-of-day toggle drives which card shows

## Phase 4 — Learning + Weekly Report
- Monday-morning weekly report card (last week vs this week + 1 insight)
- After 3 completed projects, learn per-client approval avg, per-vendor delay avg, work-type duration; persist to a new `studio_insights` table and apply as buffers to new task estimates
- "Based on your last N projects…" insight strip

---

Tech notes:
- New file `src/components/dashboard/MorningBriefing.tsx` mounted at top of `src/routes/_authenticated/index.tsx`
- New `src/lib/briefing.ts` (pure helpers, computes the 3 sections + score from already-cached query data)
- Phase 4 adds one migration (`studio_insights`) and a `compute_fasttrack` SQL view for cross-project trends
- No edge functions; AI drafting reuses existing `task-narrative.functions.ts`

Reply `go` for Phase 1, `all` to run straight through, or call out changes.