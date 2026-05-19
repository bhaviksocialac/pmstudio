## Scope

Two feature groups: **Dashboard insights** and **New Project flow overhaul**. Both need new database tables for tasks already exist plus new tables for phases, budget lines, and room scope. Health score becomes derived (not stored).

---

## 1. Database migration

New tables (all RLS scoped to `auth.uid() = user_id`):

- **project_phases** — `project_id`, `phase` (enum), `start_date`, `end_date`, `order_index`, `status` (planned/active/done)
- **budget_lines** — `project_id`, `category` (text), `percentage` (numeric), `amount` (numeric)
- **project_rooms** — `project_id`, `name`, `order_index`
- **room_scope_items** — `room_id`, `project_id`, `label`, `done` (bool)

Add to existing `projects` table:
- `start_date` is already nullable — keep
- No schema change needed for health (computed client-side)

Tasks table already exists with `due_date`, `done`, `project_id` — perfect for Today's Focus and Fire Alerts.

---

## 2. Dashboard (`src/routes/_authenticated/index.tsx`)

Add two sections above "Your Projects":

**Fire Alerts** — red-bordered card listing:
- Projects with `expected_handover` within 48h
- Projects with any task where `done=false` AND `due_date < today`
- Each row: project name → link, reason chip ("Handover in 36h", "3 overdue tasks")
- Hidden when empty

**Today's Focus** — card with 3 most urgent tasks:
- Query tasks: `done=false`, sorted by `due_date asc nulls last`, limit 3
- Each row: checkbox (toggles `done`), title, due date pill (red if overdue), project name
- Empty state: "Nothing urgent. Plan something."

**Health score (derived, not stored)** — small helper `computeHealth(project, tasks)`:
- Red: 3+ overdue tasks OR spent > budget
- Yellow: 1-2 overdue OR spent > 90% budget OR handover within 7 days
- Green: otherwise
- Used to override the stored `health` field in display only (or write back via mutation on dashboard load — go with display-only to keep it simple).

---

## 3. New Project flow (`src/routes/_authenticated/projects.index.tsx`)

Replace single-step modal with a multi-step `NewProjectWizard`:

**Step 1 — Basics** (existing fields + `start_date` date input, `client_name` + `client_email` for welcome message)

**Step 2 — Budget breakdown**
- Auto-fill 6 lines from total budget: Civil 25, Electrical 10, Flooring 20, Furniture 30, Painting 8, Miscellaneous 7
- Each row: category label, % input, ₹ amount input (kept in sync)
- Total bar at bottom showing sum vs budget

**Step 3 — Room scope**
- Default rooms shown as accordions: Living Room, Master Bedroom, Bedroom 2, Kitchen, Bathrooms, Dining, Balcony
- Each: 6 checkboxes (Flooring, Walls, Ceiling, Electrical, Furniture, Accessories), all checked by default
- "Add room" + "Remove" controls

**Step 4 — Create**
- Single mutation: insert project → insert 6 phases with computed dates → insert budget lines → insert rooms + room_scope_items → upsert client if email given → insert welcome message draft into `messages` table
- Phase durations (weeks): Survey 1, Design 3, Procurement 2, Execution 8, Finishing 2, Handover 1 — cumulative from `start_date`; project `expected_handover` = end of Handover

**Step 5 — Success screen** (in modal)
- "Project created in under 8 minutes" headline + checkmark
- Two buttons: "View Project" → navigate to `/projects/$id`, "Share Client Portal" → copies portal URL
- Welcome message preview card with editable textarea pre-filled:
  > "Hi {client name}, your project {project name} is now set up on PMStudio. You can track progress, approve designs, and view updates anytime at {portal link}. Looking forward to creating a beautiful home for you!"
- "Send to Client" button → marks the drafted message as sent (sets `sent_at`)

---

## 4. Project Detail page (`src/routes/_authenticated/projects.$projectId.tsx`)

Surface the new data:
- Timeline strip showing 6 phases with dates
- Budget breakdown table from `budget_lines`
- Room scope checklist (toggleable checkboxes that update `room_scope_items.done`)

(Light additions — main work is the wizard + dashboard.)

---

## Files to edit / create

- **Migration** (new tables + RLS + triggers)
- `src/lib/db-types.ts` — add new type exports + health helper
- `src/routes/_authenticated/index.tsx` — Fire Alerts + Today's Focus + health
- `src/routes/_authenticated/projects.index.tsx` — replace `NewProjectModal` with wizard
- `src/routes/_authenticated/projects.$projectId.tsx` — render phases, budget, rooms
- `src/components/NewProjectWizard.tsx` — new multi-step component

---

## Order of operations

1. Run migration (await user approval).
2. After migration approved, implement code changes in one pass.
