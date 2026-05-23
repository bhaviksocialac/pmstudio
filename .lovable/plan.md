# Milestones System — Implementation Plan

A Milestone is a task-driven achievement. Designer never marks it done — the system fires it when its trigger tasks are all `done`.

## 1. Database (new migration)

**Table `milestones`** (RLS: own-row, like other tables):
- `id`, `user_id`, `project_id`
- `name` (text), `description` (text)
- `kind` — `room` | `phase` | `work_type` | `custom`
- `trigger` (jsonb) — `{ room?: string, phase?: string, work_type?: string, task_ids?: string[] }`
- `invoice_amount` (numeric), `client_message_template` (text)
- `status` — `pending` | `triggered` | `invoice_sent` | `paid`
- `triggered_at` (timestamptz), `triggered_on_time` (bool)
- `invoice_id` (uuid, nullable), `approval_id` (uuid, nullable)
- `order_index` (int), timestamps

## 2. Server functions (`src/lib/milestones.functions.ts`)

- `suggestMilestones({ projectId })` — Reads tasks + BOQ subcategories, calls Lovable AI (`google/gemini-3-flash-preview`) with tool-calling to return room/phase/work-type milestone suggestions with amounts derived from budget_lines.
- `createMilestones({ projectId, milestones[] })` — bulk insert after designer confirms.
- `listMilestones({ projectId })` — returns milestones + computed `{ done, total, pct, blocking }` against current tasks.
- `evaluateMilestones({ projectId })` — central trigger fn: for each `pending` milestone, compute trigger task set; if all `done`, set `status='triggered'`, create draft `invoices` row + draft `ai_drafts` (kind=`client_update`) row, link IDs, return summary. Called after any task mutation.
- `updateMilestone`, `deleteMilestone`.

## 3. Trigger hook-in

In `task-narrative.functions.ts` `confirmNarrative` and anywhere tasks toggle done (TaskTable, TaskEditSheet), invoke `evaluateMilestones` after the write. Return fired milestone names so the AINarrativeBar can toast `"◆ Milestone reached — Living Room Complete. Invoice ₹50,000 drafted."`

## 4. Trigger matching logic (`src/lib/milestone-eval.ts`)

```ts
function tasksForTrigger(milestone, allTasks) {
  switch (milestone.kind) {
    case "room": return tasks.filter(t => roomsOf(t).includes(trigger.room));
    case "phase": return tasks.filter(t => phaseOfTask(t) === trigger.phase);
    case "work_type": return tasks.filter(t => workTypesOf(t).includes(trigger.work_type));
    case "custom": return tasks.filter(t => trigger.task_ids.includes(t.id));
  }
}
// fires when set non-empty AND every task isDone
```

Re-uses `phase-sync.ts` helpers (`isDone`, `roomsOf`, `workTypesOf`, `phaseOfTask`).

## 5. UI

**New tab `MilestonesTab.tsx`** (between Overview and Timeline in `projects.$projectId.tsx`):
- Header with "AI-suggest milestones" button (calls `suggestMilestones`, opens review modal).
- "Add custom milestone" button → modal.
- Vertical list of milestone cards: name, kind badge, trigger summary, progress bar (`done/total`), status pill, ◆ badge when triggered, amber warning if any trigger task is delayed, linked invoice status, "View invoice" / "Review client message" buttons.

**Overview tab additions** (`ProjectProgressPanels` or new `MilestonesOverview`):
- "Completed milestones: X of Y"
- "Next milestone: [name] — N tasks remaining"
- "Revenue triggered: ₹X of ₹Y"

**Timeline integration** (`GanttTimeline.tsx`):
- Render ◆ markers at `triggered_at` x-position; green if on time, red if `triggered_at > planned_end of last trigger task`. Tooltip with name + amount + delay.

**Dashboard notification**: hook into existing activity feed — `milestone_triggered` event.

## 6. Auto-generated artifacts

- Invoice: `invoices` insert with `milestone` = name, `amount`, `due_at` = trigger_date + 7d, `status='draft'`. Link `milestone.invoice_id`.
- Client message: `ai_drafts` insert with `kind='client_update'`, body from template + photo URLs from `photos` table filtered by room/phase. Link `milestone.approval_id`.

## 7. Files

**New:**
- `supabase/migrations/<ts>_milestones.sql`
- `src/lib/milestones.functions.ts`
- `src/lib/milestone-eval.ts`
- `src/components/milestones/MilestonesTab.tsx`
- `src/components/milestones/MilestoneCard.tsx`
- `src/components/milestones/SuggestMilestonesModal.tsx`
- `src/components/milestones/CustomMilestoneModal.tsx`
- `src/components/milestones/MilestonesOverview.tsx`

**Edited:**
- `src/routes/_authenticated/projects.$projectId.tsx` — add Milestones tab, wire overview block.
- `src/lib/task-narrative.functions.ts` — call `evaluateMilestones` after confirm, return fired list.
- `src/components/tasks/AINarrativeBar.tsx` — toast fired milestones.
- `src/components/tasks/TaskTable.tsx` / `TaskEditSheet.tsx` — call evaluate after status toggle.
- `src/components/tasks/GanttTimeline.tsx` — render ◆ markers.
- `src/components/BoqUploadButton.tsx` — after BOQ parse, auto-call `suggestMilestones` and open modal.

## 8. Test (your spec)

After implementation I'll seed the 3 milestones via the UI and walk through marking Mandir tiling Done → expect Milestone 3 fires, ₹3,40,000 invoice draft appears in Finance, client update draft in Pending Approvals, green ◆ on Gantt.

---

Approve and I'll start with the migration, then server functions, then UI in that order.