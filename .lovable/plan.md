
## Goal

Make tasks the single source of truth. Every AI-bar entry updates the Tasks table, Phases checklist (per room × work type), Timeline Gantt, and Overview progress in one shot. All phases run in parallel.

## 1. Data model

New migration:
- Add `room` (text, nullable) to `tasks` — per-room granularity for partial completion.
- Add `completion_pct` (int, 0–100, default 0) to `tasks` — for "1 wall pending" style partials.
- Add `phase` (text, nullable) to `tasks` — denormalised from work_type, auto-filled, so phase grouping is O(1).
- Create `work_type_phase_map` constant in code (no table) mapping every WORK_TYPE → phase bucket: Civil Work, Electrical Work, Plumbing Work, Flooring Work, Painting Work, Furniture Installation.
- Drop the sequential-lock behaviour in `PhaseChecklistTab` (no schema change — code only).

## 2. Phase sync layer (`src/lib/phase-sync.ts`, new)

Pure helpers:
- `phaseGroupOfWorkType(wt)` → one of the 6 execution phase groups.
- `computePhaseRollup(tasks)` → per phase group: `{ total, done, partialPct, perWorkType: { perRoom: {status, pct, note} } }`.
- `overallProjectPct(tasks)` → weighted by task count + completion_pct.
- `canSignOff(phaseGroup, rollup)` → boolean + blocker message.

Used by Tasks tab, Phases tab, Timeline, Overview, Dashboard — one function, four readers.

## 3. AI narrative upgrade (`src/lib/task-narrative.functions.ts`)

Extend the extracted-task schema with `room`, `completion_pct`, and explicit fan-out:
- "Plaster done in Living Room, Kitchen, Bedroom" → 3 tasks (one per room), each work_type=Civil, status=done.
- "Plaster done except Mandir" → N done tasks for known rooms + 1 wip task for Mandir.
- "1 wall remaining" → completion_pct=80, notes="1 wall pending".
- AI prompt receives the project's room list so it can fan out "all rooms except X".

Also auto-fill `phase` server-side from work_type before insert.

## 4. Phases tab rewrite (`PhaseChecklistTab.tsx`)

- Remove sequential lock — every phase header expandable from day one, no "Lock" icon, no dependency on previous sign-off.
- Replace the static `checklist: [{text,done}]` model with a live render driven by tasks:
  - For each phase group, list its work types (Plaster, Demolition, Wiring…) inferred from tasks.
  - Under each work type, render a room-wise grid: Living Room ✅, Bedroom ✅, Mandir ⏳ 80% "1 wall pending".
- Phase header shows progress bar = `computePhaseRollup` percentage.
- Sign Off button enabled only when `canSignOff` returns true; otherwise shows blocker text.

## 5. Timeline sync (`GanttTimeline.tsx`)

- Bar colour driven by task status: not_started → grey, wip → amber, done → sage, delayed (`actual_end > planned_end` or overdue) → terracotta.
- Group headers already exist by phase + work type; pipe in the new `phase` column for instant grouping.

## 6. Overview tab (`ProjectProgressPanels.tsx`)

- Phase Progress section now uses the 6 execution-phase groups (not the high-level Survey/Design/… phases). Each bar clickable → navigates to that phase in the Phases tab via a query param.
- Reuses `computePhaseRollup`.

## 7. Dashboard card

- Project card completion % switches from `projects.completion` (manual) to `overallProjectPct(tasks)` fetched alongside the project list.

## 8. Cross-tab notification

- After `confirmNarrative` saves tasks, emit a `sonner` toast: "Civil Work updated — 85%. Plaster complete in 4 of 5 rooms." Computed from before/after rollup diff returned by the server fn.

## 9. Files touched

New
- `supabase/migrations/<ts>_tasks_room_completion_phase.sql`
- `src/lib/phase-sync.ts`

Edited
- `src/lib/task-narrative.functions.ts` (room + completion + fan-out + phase auto-fill + diff in response)
- `src/lib/task-flow.ts` (WORK_TYPE → phase-group map exported)
- `src/components/PhaseChecklistTab.tsx` (parallel phases, room-wise grid, dynamic from tasks)
- `src/components/tasks/AINarrativeBar.tsx` (show toast diff)
- `src/components/tasks/GanttTimeline.tsx` (status-driven bar colours)
- `src/components/tasks/ProjectProgressPanels.tsx` (new phase grouping)
- `src/components/tasks/TaskTable.tsx` + `TaskEditSheet.tsx` (room column/field)
- `src/routes/_authenticated/projects.index.tsx` (dashboard pct from tasks)

## 10. Out of scope (call out)

- No changes to auth, billing, vendors, messages.
- Existing `phase_subcategories` rows kept for back-compat but no longer the source of truth for checklists.

Once approved I'll ship the migration first, then code.
