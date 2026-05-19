# Plan: Fix New Project form + Project Detail page

Two-part fix. Prompt 1 rebuilds the New Project flow and unifies the trigger across the app. Prompt 2 makes the Project Detail page fully editable and wires up phase completion + task creation with AI suggestions.

## Prompt 1 — New Project form

### 1.1 Database migration
The `projects.type` column is a `project_type` enum (`residential | commercial`). To support 8 property types without breaking existing rows, convert it to `text` with a CHECK constraint:

```text
ALTER TABLE projects ALTER COLUMN type TYPE text USING type::text;
ALTER TABLE projects ADD CONSTRAINT projects_type_check
  CHECK (type IN ('residential_apartment','independent_villa','penthouse',
                  'commercial_office','retail_shop','restaurant',
                  'hotel_room','other','residential','commercial'));
ALTER TABLE projects ALTER COLUMN type SET DEFAULT 'residential_apartment';
```
(Old `residential`/`commercial` values kept so existing data still loads.)

### 1.2 Replace `NewProjectWizard.tsx` with a single slide-in panel
- Slide-in from right (full-height drawer), used by BOTH the dashboard and the projects page. Remove the centered-modal version.
- Step 1 — Basics:
  - Property type dropdown: 8 new options listed above (display labels: "Residential Apartment" etc.).
  - Remove the **Design Style** field entirely (it doesn't exist as a column today but is referenced in copy/UI — remove any mention).
  - Keep name, location, phase, start date, budget, client name/email.
- Step 2 — Scope & BOQ:
  - Replace the scope-of-work checkbox grid with a single text input **"Rooms in scope"** (comma-separated). On save, split by comma → create one `project_rooms` row per name.
  - Add **"Upload BOQ or Quotation (Excel/PDF)"** file input (`.xlsx,.xls,.pdf`).
  - When a file is chosen: show **"AI reading your BOQ..."** spinner, call a new `parseBoq` server fn, then populate: total budget, budget breakdown rows, and a comma-joined rooms list. All fields remain editable.
- Step 3 — Budget breakdown:
  - If no file was uploaded → keep current slider/percentage editor.
  - If a file was uploaded → seed rows from AI extraction; editable.
- Submit unchanged (insert project + phases + budget_lines + rooms + welcome message).

### 1.3 New server function `parseBoq`
`src/lib/boq.functions.ts` — `createServerFn({ method: "POST" })` with `requireSupabaseAuth`. Accepts base64-encoded file + filename + mime. Sends to Lovable AI Gateway (`google/gemini-2.5-flash`, multimodal) with a strict JSON schema prompt requesting:
```json
{ "total_budget_lakhs": number,
  "breakdown": [{ "category": string, "percentage": number, "amount": number }],
  "rooms": [string] }
```
Returns parsed JSON. Handles PDF (gemini reads natively) and Excel (convert to text server-side via a lightweight xlsx-to-csv parse using `xlsx` npm package, then send text).

### 1.4 Fix "shows nothing" from dashboard
- Add a visible **+ New Project** button on the dashboard header and bind it directly to the same panel (lift open state into AppShell so any page can trigger via `openModal("new-project")`).
- Remove the legacy `NewProjectPanel` inside `AppShell.tsx` and route `openModal("new-project")` to render the rebuilt `<NewProjectPanel onClose={...} />` from `NewProjectWizard.tsx`.
- `projects.index.tsx` New Project button → also dispatches `openModal("new-project")` (single source of truth, no local state).

## Prompt 2 — Project Detail page

### 2.1 Edit Project button
- Top-right of `projects.$projectId.tsx` header: **Edit Project** button next to Share Portal.
- Opens the same slide-in panel from Prompt 1, but in **edit mode**: loads current project + budget_lines + rooms, pre-fills all fields, "Create Project" → "Save Changes". On save, updates row + replaces budget_lines / rooms (delete + reinsert) and invalidates `["project", id]` + `["projects"]`.

### 2.2 Delete Project
- Inside Edit panel footer, red **Delete Project** button. Confirm dialog: "Are you sure? This cannot be undone."
- On confirm: cascade delete `tasks`, `project_phases`, `budget_lines`, `project_rooms`, `room_scope_items`, `photos`, `invoices`, `vendor_deliveries`, `payment_requests`, `approvals` (all filtered by `project_id`), then delete `projects` row. Navigate to `/projects` and toast.

### 2.3 Mark Phase Complete
- Replace the toast stub at line 209. On click → confirmation dialog "Mark this phase as complete and unlock next phase?"
- On confirm, in a single mutation:
  - Update current `project_phases` row: `status='done'`, `end_date=today`.
  - Update next phase row (by `order_index+1`): `status='active'`.
  - Update `projects.phase` to next phase, increment `projects.completion` by `Math.round(100/6)` (capped at 100).
  - Insert draft invoice into `invoices` (`status='draft'`, `milestone=<current phase name>`, `amount = budget * phase_percentage` where phase_percentage = a simple lookup: Survey 5%, Design 15%, Procurement 20%, Execution 35%, Finishing 15%, Handover 10%).
- Invalidate `["project", id]`, `["projects"]`, `["invoices"]`.

### 2.4 Add Task slide-in panel
- Replace the toast stub at line 210 with a new `<AddTaskPanel projectId phase onClose />` slide-in.
- Fields: Title (required), Description (textarea — stored in `tasks.title` suffix or new field; reuse existing schema by appending to title since `tasks` has no description column today — acceptable since out-of-scope to migrate), Assigned to (text → `tasks.assignee`), Due date, Priority (High/Medium/Low — store in title prefix `[High]` for v1 since no column), Phase dropdown (6 phases — stored as note prefix for v1).
- On save: insert into `tasks`, invalidate `["tasks"]` + dashboard query.

### 2.5 AI Task Suggestions inside Add Task panel
- Top section: **AI Suggested Tasks for this Phase** with 3-4 chips.
- New server fn `suggestPhaseTasks({ phase, projectName })` calls Lovable AI (`google/gemini-2.5-flash-lite`) with a one-shot prompt: "Return 4 short concrete tasks for the {phase} phase of an interior design project. JSON array of strings." Returns array.
- Clicking a chip fills Title (and clears other fields). Caches result per-phase with React Query.

## Out of scope (v1)
- Real `tasks.description`, `tasks.priority`, `tasks.phase` columns (we encode in title for now to avoid schema churn; flag this in completion message).
- BOQ parsing for image-only scans (we rely on Gemini's PDF reading; pure-image PDFs may yield poor results).
- Undo for project deletion.

## Files touched
- **Migration**: convert `projects.type` to text + CHECK.
- **New**: `src/lib/boq.functions.ts`, `src/lib/tasks-ai.functions.ts`, `src/components/AddTaskPanel.tsx`, `src/components/DeleteProjectConfirm.tsx`.
- **Rewritten**: `src/components/NewProjectWizard.tsx` (slide-in, edit mode, file upload, new fields).
- **Edited**: `src/components/AppShell.tsx` (route `openModal("new-project")` to new panel, remove legacy `NewProjectPanel`), `src/routes/_authenticated/index.tsx` (add header New Project button), `src/routes/_authenticated/projects.index.tsx` (use `openModal`), `src/routes/_authenticated/projects.$projectId.tsx` (Edit/Delete buttons, Mark Phase Complete wiring, Add Task wiring).
- **Dependency**: `bun add xlsx` for server-side Excel→text in `boq.functions.ts`.

Ready to implement on approval.
