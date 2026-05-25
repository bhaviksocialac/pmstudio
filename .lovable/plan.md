# Task Audit Trail & Delay Attribution

This is a large system (5 interlocking features). Building it all in one turn would be shallow and buggy. I'll ship it in 4 sequenced phases, each independently usable and testable. Confirm the order, or tell me to start at phase 1.

---

## Phase 1 — Timestamp foundation + audit log (the backbone)

Everything else depends on this. Without it, nothing can be measured.

**Database (new migration):**
- Add columns to `tasks`: `assigned_at`, `response_at`, `started_at`, `completed_at` (`created_at`, `ifr_date`, `ifa_date`, `ifc_date`, `planned_end`, `actual_end` already exist).
- New table `task_status_history`: `id`, `task_id`, `project_id`, `user_id`, `from_status`, `to_status`, `changed_at`, `effective_date` (the user-confirmed date), `changed_by_name`, `notes`. RLS owner-scoped.
- Trigger on `tasks` UPDATE: when `status` changes, insert a history row and auto-stamp the matching column (`wip` → `started_at`, `done` → `completed_at` + `actual_end`, etc.). Designer-supplied `effective_date` overrides `now()`.

**UI:**
- Wrap every status change (TaskTable inline, TaskEditSheet, AI bar) in a "When did this happen?" mini-prompt → Today / pick date. Default Today, one click to confirm.
- Server fn `changeTaskStatus({ taskId, newStatus, effectiveDate, note })` that writes both the task and the history row.

## Phase 2 — Task timeline view + AI duplicate detection

**Timeline panel** inside TaskEditSheet: vertical list of history rows with computed gaps ("7 days"), stages above the project average tinted amber.

**Duplicate-aware AI bar:** before `interpretTaskUpdate` creates anything, it fetches candidate tasks matching {room, work_type, item keywords} and asks the model to pick "update existing" vs "create new" vs "ambiguous → ask". On update, it calls the same `changeTaskStatus` fn with today's date and returns a confirmation string ("Updated — previously Pending for 5 days").

## Phase 3 — Delay attribution + Overview Delays section

**Pure helper** `attributeDelay(task, history)` → returns `{ party: 'client'|'vendor'|'designer'|'contractor'|'external', days }` based on which stage's gap exceeded plan.

**Overview tab — Delays card:** total delay days, per-party breakdown list, donut chart (recharts is already in the project). Auto-computes from tasks + history; no manual input.

## Phase 4 — Accountability dashboard + notifications

- Per-client / per-vendor / per-designer metric aggregator (server fn over `task_status_history`).
- Studio-level insights card (only shown after 3+ projects): hard-coded thresholds vs industry benchmarks.
- Dashboard reminders: scan tasks with `status='approval_pending' AND now() - status_changed_at > 5d` → toast/badge. Same for overdue vendor deliveries and IFC-not-issued.

---

## What I'd build first if you say "go"

Phase 1 only, in this turn. It's the prerequisite for every other piece and is itself shippable (every status change becomes auditable, with the "when did this happen?" prompt). Phases 2–4 in subsequent turns.

**Reply with:**
- `go` — I start Phase 1 now.
- `all at once` — I'll build all four but expect rough edges; you'll need to iterate.
- Or pick a different starting phase.
