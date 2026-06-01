# Plan — Frappe Gantt Timeline + Shared Work Types

## Part 1 — Frappe Gantt Timeline (replaces `GanttTimeline.tsx`)

### Setup
- `bun add frappe-gantt` (use npm package, not CDN — required by Worker bundler / Vite).
- Import CSS in `src/styles.css` via `@import "frappe-gantt/dist/frappe-gantt.css";`.
- Add PMStudio overrides in `styles.css` under a `.pmstudio-gantt` scope:
  - phase bars `#c17f5a`, task bars `#e8b99a`, done `#6b9e82`, delayed `#c4685a`, today line `#c4685a`, milestones `#1a1612`, arrows `#c17f5a`, grid `#faf8f5`, weekend `#f0ece6`, font DM Sans.

### New component `src/components/tasks/FrappeGanttTimeline.tsx`
Replaces existing `GanttTimeline.tsx` (kept file path consumers untouched by re-exporting from same name, or update import in `ProjectTasksTab.tsx`).

State / structure:
- Props: `rows: TaskRow[]`, `projectId`, `onSelect(id)`.
- Local state: `viewMode` (`'Day'|'Week'|'Month'|'Quarter'|'Year'`, default `Month`, `Week` on mobile via `useIsMobile`), `groupBy` (`'all'|'agency'|'work_type'|'room'`), `collapsed: Set<string>` (groups), `pendingMove` (dep warning dialog state).
- Load milestones via `supabase.from('milestones')` (same as today).

Row building:
1. Group tasks by `groupBy`. For `all` → phase from `phaseOfTask`. For others → bucket key.
2. For each group, compute span = min(start) → max(end). If no dated tasks → render a placeholder dashed bar "No dates set — add tasks to see timeline" (custom_class on a synthetic task).
3. Build Frappe task array:
   - Parent (group) task: `id=grp:<key>`, custom_class `pms-phase`, name = group label, dates from span.
   - Child tasks (only if not collapsed): `id=task:<uuid>`, parent set via `dependencies` for arrow only when real deps exist, `custom_class` based on status (`pms-done`, `pms-wip`, `pms-delayed`, `pms-planned`, `pms-blocked`).
   - Milestone synthetic tasks: `id=ms:<id>`, single-day, `custom_class` `pms-milestone pms-ms-ontime|delayed|upcoming`, placed on the phase row by inserting in same group.
4. Dependency arrows: include `dependencies: predecessorIds.join(',')` for tasks where DB has `blocked_by` (TaskRow may already track this — fallback to none if unavailable).

Gantt instance:
- Init in `useEffect` after refs ready, destroy & re-init on `rows`, `groupBy`, `collapsed`, `viewMode` change.
- Options: `view_mode: viewMode`, `bar_height: 24`, `padding: 14`, `custom_popup_html`, `on_click`, `on_date_change`, `on_view_change`.
- After init: scroll today into view (`gantt.scroll_current()` if available, else manual `scrollLeft` calc via today minus container start × column width).
- Stagger entrance: add CSS class with `animation-delay: calc(var(--i) * 50ms)` set via `bar.setAttribute('style', ...)` after render. Ease-out only.

Interactions:
- `on_click(task)`:
  - If `id` starts with `grp:` → toggle collapsed for that group.
  - If `ms:` → open milestone popover (simple `Dialog` with name/date/amount/status).
  - Else → `onSelect(taskId)` to open existing task edit sheet.
- `on_date_change(task, start, end)`:
  - Persist via `supabase.from('tasks').update({ planned_start, planned_end, start_date, due_date }).eq('id', taskId)`.
  - If task has dependents (look up in current rows by `blocked_by` array containing id), open AlertDialog "Moving this task affects N dependent tasks. Update them too?" Yes → cascade-shift dependents by same delta and update DB; No → leave.
  - Toast success/error.

Toolbar (above chart, sticky):
- Zoom button group Day/Week/Month/Quarter/Year — active state uses bg `#c17f5a` text white.
- Group-by dropdown (`Select`): All / Agency / Work Type / Room.
- Legend chips unchanged.

Mobile:
- Default `viewMode = 'Week'`.
- `touch-action: pan-x pinch-zoom` on scroll container.
- Wrap chart in horizontal scroll container (Frappe handles internally; just ensure parent overflow-x auto with momentum `-webkit-overflow-scrolling: touch`).

Empty / dedupe:
- Only one row per group key (Map-based). Skip rendering placeholder if group already shown.

Wiring:
- Update `src/components/tasks/ProjectTasksTab.tsx` to import the new component (or repurpose `GanttTimeline.tsx` filename — pick rename to keep imports stable: replace file contents).

## Part 2 — Shared custom work types

### Migration (single)
```sql
CREATE TABLE public.work_types (
  id uuid PK default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  hidden_default boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  UNIQUE(user_id, lower(name))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_types TO authenticated;
GRANT ALL ON public.work_types TO service_role;
ALTER TABLE public.work_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY work_types_own ON public.work_types FOR ALL TO authenticated
  USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
```
Backfill: insert distinct existing `tasks.work_type` values per user that aren't in defaults (incl. "Bosch") via a one-shot SQL in the migration.

### Code
- New hook `src/hooks/useWorkTypes.ts`:
  - Loads defaults (existing constant list) + `work_types` rows for current user.
  - Filters out defaults marked `hidden_default=true` (defaults rows stored with `hidden_default=true` flag and special `name` matching default).
  - Exposes `add(name)`, `rename(id,name)`, `remove(id)`, `toggleHidden(name)`.
- Update Work Type combobox (in `TaskInlineEditors.tsx` and `AddTaskPanel.tsx` and `TaskEditSheet.tsx`) to:
  - Use the hook for suggestions.
  - When user creates a new value not in list, call `add()` then save.
- Settings page (`src/routes/_authenticated/settings.tsx`): new "Work Types" section listing defaults (with hide toggle) + customs (rename/delete inline).

### Out of scope
- No changes to existing tasks data model beyond work_type strings (already free-text).
- No re-skin of task edit sheet beyond ensuring the new combobox.

## Rollout
1. Migration (single approval).
2. Install `frappe-gantt`, add CSS overrides, build new Gantt component, swap import.
3. Build work-types hook + settings UI + combobox wiring.
4. Verify build, smoke check Timeline tab and Tasks dropdown.

~10–14 files touched.
