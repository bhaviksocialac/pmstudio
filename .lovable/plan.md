# WhatsApp Intelligence Module

A large module spanning 8 features. Single migration, several new components, edits to dashboard / messages / settings / projects pages.

## 1. Database migration (one)

New table `whatsapp_groups`:
- `id, user_id, label` (text: e.g. "Client Group"), `kind` (enum: `client|design|execution|accounts`), `phone` (text), `created_at, updated_at`
- RLS: own-user only. Unique (user_id, kind).

Add to existing `photos`:
- `status` (enum: `pending|approved|rejected`, default `pending`)
- (room column already exists)

Add to existing `tasks`:
- `delayed` (boolean, default false) — set by cron / on-read derivation

(Freshness tags are derived from existing `updated_at` — no schema change.)

## 2. New server functions (`src/lib/whatsapp.functions.ts`)

All `requireSupabaseAuth`:
- `listGroups()` / `upsertGroup({kind, label, phone})` / `deleteGroup({id})`
- `suggestRoute({messageBody})` — calls Lovable AI, returns `{ kind: "client"|"design"|"execution"|"accounts"|"dm", reason: string }`
- `translateToHindi({text})` — Lovable AI, returns Hindi text
- `approvePhoto({id})` / `rejectPhoto({id})` — sets status
- `listPendingPhotos()` — status='pending'
- `tagPhotoRoom({id, room})` — updates room
- `flagOverdueTasks()` — finds `due_date < today AND done=false AND delayed=false`, sets delayed=true, creates delay_notice draft per project (dedupe)

Add to cron endpoint: call `flagOverdueTasks` per user each hour (extend existing `ai-drafts-cron.ts`).

## 3. UI components (new)

- `src/components/WhatsAppGroupsSettings.tsx` — 4 group rows (Client/Design/Execution/Accounts), label + phone inputs, save.
- `src/components/RouteMessageModal.tsx` — modal listing 4 groups + "Individual DM", AI-suggested option highlighted with badge. Opens `wa.me/<phone>?text=<body>`.
- `src/components/PhotoStaging.tsx` — dashboard card listing pending photos (room, caption, project), Approve/Reject buttons + count badge.
- `src/components/FreshnessTag.tsx` — pure presentational, takes `updated_at`, renders green/yellow/red dot+label. Used in finance + budget.
- `src/components/HindiToggle.tsx` — toggle + preview panel rendering translated text; reused inside `DraftCard` and messages composer.
- `src/components/VoiceNoteUploader.tsx` — file input (audio/*), uploads to storage, inserts message with body "🎙 Voice note — Transcription pending (Whisper API required)".
- `src/components/PhotoRoomTagModal.tsx` — appears after photo insert; room dropdown (loads project_rooms), Save, includes "Auto-tagging available when Google Vision API is connected." note.

## 4. Page edits

- `src/routes/_authenticated/index.tsx` (Dashboard) — add `<PhotoStaging />` above Pending Approvals.
- Add a new Settings route `src/routes/_authenticated/settings.tsx` (if absent) hosting `WhatsAppGroupsSettings`. *(check first; if no settings route exists, add nav entry in AppShell.)*
- `src/routes/_authenticated/messages.tsx` — "Route Message" button on each thread → `RouteMessageModal`; Hindi toggle on composer; `VoiceNoteUploader` button.
- `src/routes/_authenticated/finance.tsx` — `FreshnessTag` on each invoice / payment row; block "Share with client" action when red until refreshed.
- `src/routes/_authenticated/projects.$projectId.tsx` — `FreshnessTag` on budget; show "Delayed" badge on overdue tasks in timeline; on photo upload show `PhotoRoomTagModal`; only `status=approved` photos shown to client portal.
- `src/components/DraftCard.tsx` — embed `HindiToggle` so any draft can translate before send.
- `src/routes/portal.$projectId.tsx` — filter photos by `status='approved'` only.
- `src/routes/api/public/hooks/ai-drafts-cron.ts` — add `flagOverdueTasks` step per user.

## 5. Out of scope (v1)

- Real WhatsApp Business API (use `wa.me` deeplinks)
- Real Whisper transcription (placeholder badge)
- Real Google Vision auto-tag (manual modal)
- Real-time Hindi quality tuning (single-pass Gemini)

## Files

**New**
- `supabase/migrations/<ts>_whatsapp_intel.sql`
- `src/lib/whatsapp.functions.ts`
- `src/components/WhatsAppGroupsSettings.tsx`
- `src/components/RouteMessageModal.tsx`
- `src/components/PhotoStaging.tsx`
- `src/components/FreshnessTag.tsx`
- `src/components/HindiToggle.tsx`
- `src/components/VoiceNoteUploader.tsx`
- `src/components/PhotoRoomTagModal.tsx`
- possibly `src/routes/_authenticated/settings.tsx`

**Edited**
- `src/routes/_authenticated/index.tsx`
- `src/routes/_authenticated/messages.tsx`
- `src/routes/_authenticated/finance.tsx`
- `src/routes/_authenticated/projects.$projectId.tsx`
- `src/routes/portal.$projectId.tsx`
- `src/routes/api/public/hooks/ai-drafts-cron.ts`
- `src/components/DraftCard.tsx`
- `src/components/AppShell.tsx` (nav entry for Settings if added)

Approve to proceed.
