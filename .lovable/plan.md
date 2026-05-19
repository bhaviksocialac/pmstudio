# Client Portal (Module 3)

A public, no-login portal accessible via shareable URL `/portal/$projectId`. Mobile-first, warm terracotta + charcoal theme, English/Hindi toggle.

## Architecture

- **Public route**: `src/routes/portal.$projectId.tsx` — outside `_authenticated` layout, no auth gate.
- **Server fn (admin)**: `src/lib/portal.functions.ts` using `supabaseAdmin` to read project data by id without auth. Returns only client-safe fields (no user_id, no internal notes).
- **Approve mutation**: server fn `submitApproval` writes to `approvals` table (admin client, scoped by approval id + project id).
- **i18n**: small `src/lib/portal-i18n.ts` map (en/hi) consumed via local `useState` + URL `?lang=hi`.

## Page layout (mobile-first)

```text
┌─────────────────────────────────┐
│ PMStudio · [EN|HI] · [Share]    │  sticky header
├─────────────────────────────────┤
│ Project name (Cormorant)        │
│ Client · phase tag · ▓▓▓░ 62%   │
├─────────────────────────────────┤
│ ⚠ Pending approvals (if any)    │
├─────────────────────────────────┤
│ 🌅 Morning update (dark card)   │
├─────────────────────────────────┤
│ Timeline · 6 phases vertical    │
├─────────────────────────────────┤
│ Progress photos by room         │
│   Before/After slider per room  │
├─────────────────────────────────┤
│ Budget overview + categories    │
├─────────────────────────────────┤
│ Document vault grid             │
└─────────────────────────────────┘
```

## Sections

1. **Header** — PMStudio wordmark, language toggle, Share button (clipboard + toast).
2. **Hero** — project name, client name, phase chip, animated progress bar (CSS keyframe to width).
3. **Pending Approvals** — pulls `approvals` where `project_id=? and status='pending'`. Approve flow opens dialog requiring typed "I approve" / "मैं स्वीकार करता हूँ" → updates row to `approved` + `approved_at=now()`.
4. **Morning AI update** — dark card. v1: derived deterministically from yesterday/today task titles (no LLM call) — "Yesterday: <done tasks>. Today: <tasks due today>." Refreshes on load.
5. **Live Timeline** — 6 phases from `project_phases`. Completed = green tick + end_date. Current = pulsing amber dot + "In progress". Future = grey ring + estimated end_date.
6. **Progress Photos** — group `photos` by `room`. 3 most recent per room. First chronologically tagged BEFORE, latest tagged LATEST. Tap → fullscreen lightbox. Below grid: per-room before/after draggable comparison slider (pure CSS clip-path + range input).
7. **Live Budget** — total budget vs spent bar (green/amber/red). Category list from `budget_lines` (approved % → amount vs spent — spent per category derived from `payment_requests` joined to category if available, else show approved only).
8. **Document Vault** — grid of `photos` rows where storage_path ends in `.pdf` or a new lightweight read. v1: stub with empty state + categories chips (Contracts, Floor Plans, Invoices, Warranties) — wire to storage when documents table exists. Mark as "coming soon" if empty.
9. **Language toggle** — switches all visible strings via i18n map. Persisted in `?lang=` query.

## Share button integration

- New `<SharePortalButton projectId>` component using `navigator.clipboard.writeText(\`${origin}/portal/${id}\`)` + sonner toast.
- Added to:
  - Project card in `src/routes/_authenticated/projects.index.tsx`
  - Project detail header in `src/routes/_authenticated/projects.$projectId.tsx`
  - Wizard success screen (already has "Share Client Portal" — wire to same util).

## Data exposure & security

- Portal data fetched via `getPortalData({ projectId })` server fn using `supabaseAdmin`. Returns: project (name, phase, completion, budget, spent, expected_handover), client (name only), phases, budget_lines, tasks (title/due/done only — no assignee), photos, pending approvals.
- Never returns: user_id, vendor contacts, internal notes, invoice numbers, profile data.
- `submitApproval({ approvalId, projectId, phrase })` validates phrase, updates approval row scoped by both ids.

## Files

- New: `src/routes/portal.$projectId.tsx`, `src/lib/portal.functions.ts`, `src/lib/portal-i18n.ts`, `src/components/SharePortalButton.tsx`, `src/components/portal/*` (Timeline, PhotosByRoom, BeforeAfterSlider, BudgetView, ApprovalsList, MorningCard, DocumentVault).
- Edit: `src/routes/_authenticated/projects.index.tsx` (share btn on card), `src/routes/_authenticated/projects.$projectId.tsx` (share btn in header), `src/components/NewProjectWizard.tsx` (wire success-screen share button).
- No DB migrations needed — schema already supports it.

## Out of scope (v1)

- Real LLM-generated morning update (stub from task data).
- Actual document uploads (vault shows categorized empty state until storage bucket added — flag for follow-up).
- PWA manifest/service worker (page is already mobile-responsive HTML; can be added in a follow-up if user wants installability).
