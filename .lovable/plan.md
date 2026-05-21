## Smart Task Intelligence System

A single coherent task engine across BOQ → tasks → status flow → dependencies → room progress → AI updates. Built on the existing `tasks` table (most fields already exist from prior work) plus targeted additions.

### 1. Schema additions (one migration)

Extend `public.tasks`:
- `work_type` text — Flooring / Tiling / Civil / Electrical / Painting / False Ceiling / Carpentry / Plumbing / HVAC / Other
- `action_required` boolean default false
- `action_label` text — short reason ("Client approval pending")
- `vendor_id` uuid — link to master vendor list (in addition to free-text `contractor`)
- Reuse existing: `status`, `priority`, `area`, `start_date`, `due_date`, `parent_task_id`, `depends_on` (jsonb array of task ids), `notes`, `attachments`.

Expand allowed status values (string column, no enum): `not_started`, `selection_pending`, `approval_pending`, `quotation_pending`, `order_placed`, `payment_pending`, `material_ordered`, `material_delivered`, `wip`, `done`, `blocked`.

Index: `(project_id, area)`, `(project_id, status)`.

### 2. BOQ → tasks (extend existing `boq-checklist.functions.ts`)

Upgrade the AI extractor prompt to return per item:
```
{ title, work_type, room, amount, initial_status }
```
- If "all rooms" / "complete flat" → set `area="All"` and create a single task (Option A) — designer can split later via "Split per room" button.
- If specific room → one task per room.
- Default `initial_status`:
  - Material-only line → `selection_pending`
  - Labour/service line → `quotation_pending`

Server fn returns the created task ids so UI can highlight them.

### 3. Status flow engine

Helper `src/lib/task-flow.ts` (pure):
- `STATUS_ORDER` array and `nextStatus(current)` / `prevStatus`
- `STATUS_META` with label + color tag (reusing existing warm palette: terracotta/amber/sage)
- `dependentsUnblocked(task, allTasks)` — when a task becomes `done` or `material_delivered`, returns dependents whose `depends_on` is now clear.

### 4. Dependencies

- `depends_on: uuid[]` (jsonb) already exists.
- Add small "Blocked by" picker in task detail (multi-select of other tasks in same project).
- Derived "Blocking" computed client-side by scanning all tasks.
- On status update to `done`, server fn `cascadeDependents` flips eligible dependents from `not_started` → `selection_pending` (or `material_ordered` → `wip` for laying tasks) and writes a notification row (reuse `app-bus` toast for now; persist via `ai_drafts` style if needed later).

### 5. AI Site Update (extend existing AI bar)

Reuse `phase-ai.functions.ts` pattern. New server fn `interpretTaskUpdate({ projectId, text })`:
- Loads all tasks for project.
- Sends to Gemini with tool-call schema: `{ task_id, new_status, confidence, clarification_question? }`.
- If confidence < 0.7 or multiple matches → returns `clarification_question` with candidate room/task names.
- On confirm → updates task, runs cascade, returns human summary.

Wire into existing AI input in project view.

### 6. Task page (rewrite `src/routes/_authenticated/tasks.tsx` + project tab)

Single shared component `<TaskTable>` used in both global and project views.

**Columns:** Task, Room, Work Type, Contractor, Status, Priority, Start, End, Blocked By, Action

**Row tint** (subtle bg, no color override of design tokens):
- Red tint: `priority="Urgent"` OR overdue (`due_date < today` and not done)
- Amber tint: `action_required=true`
- Green tint: `status="done"`
- Grey tint: `status="not_started"`

**Filters (chip bar, multi-active):** Room • Contractor • Status • Priority • Work Type. State stored in URL search params.

**Grouping toggle:** Status / Contractor / Room / Work Type.

**Expandable row:** sub-tasks, notes, attachments, dependencies editor.

### 7. Room-wise progress dashboard

New section on project overview: grid of rooms, each card lists work types with status dot (✅ done / ⏳ wip / ❌ pending). Click → opens task page filtered to that room.

Derived from existing `project_rooms` + tasks grouped by `area`.

### 8. Timeline (upgrade existing Gantt)

- Color by status (existing palette).
- Dependency arrows already added in prior prompt — extend to use actual `depends_on` ids instead of sequential heuristic.
- Add same chip filter bar above.

### 9. Action Required surfacing

- "Action Required" red badge in task row when `action_required=true`.
- Today's Focus widget on dashboard: top 5 `action_required` tasks across all projects, ordered by priority then due date.
- Auto-set `action_required=true` when:
  - status = `approval_pending` for >24h
  - status = `quotation_pending` and `created_at` > 3 days
  - status = `payment_pending`
  Computed client-side on read (no cron needed).

### 10. Partial completion

Native: one task per room is already the model. Add "Split per room" button on tasks where `area="All"` that clones the task per `project_rooms` entry and deletes the original.

### Technical notes

- All colors via existing tokens (`--terracotta`, `--amber`, `--sage`, `--muted`). No new palette.
- Fonts: Cormorant headings, DM Sans body — unchanged.
- RLS: existing `tasks_*_own` policies cover new columns.
- Realtime: enable `tasks` on `supabase_realtime` publication so cascades reflect immediately.
- AI calls use `google/gemini-2.5-flash-lite` via Lovable AI Gateway (already wired).

### Files (planned)

**New**
- `src/lib/task-flow.ts` — status order, metadata, cascade pure logic
- `src/lib/task-ai.functions.ts` — `interpretTaskUpdate`, `cascadeDependents`, `splitTaskPerRoom`
- `src/components/tasks/TaskTable.tsx` — shared table + filter bar + expandable rows
- `src/components/tasks/TaskFilters.tsx` — chip-based multi-filter
- `src/components/tasks/RoomProgressGrid.tsx` — room-wise status dots
- `src/components/tasks/TaskDetailDrawer.tsx` — full edit incl. dependencies + action required
- `src/components/tasks/TodayFocus.tsx` — dashboard widget

**Edited**
- `supabase/migrations/<ts>_task_intelligence.sql` — columns + index + realtime
- `src/lib/boq-checklist.functions.ts` — richer extraction (work_type, initial_status)
- `src/routes/_authenticated/tasks.tsx` — use shared TaskTable + filters
- `src/routes/_authenticated/projects.$projectId.tsx` — tab uses TaskTable; add RoomProgressGrid to overview; wire AI bar to `interpretTaskUpdate`
- `src/routes/_authenticated/index.tsx` — Today's Focus widget
- Gantt component — use real `depends_on`, color by status

This is a large build (~10 files, 1 migration, 2 AI server fns). I'll work through it section by section in order: migration → flow lib → BOQ upgrade → TaskTable/filters → Room grid → AI updater → Today's Focus → Gantt deps.