# AI Communication Engine — Plan

A single unified system: every AI-generated message becomes a row in a new `ai_drafts` table with status `pending → sent | discarded`. The dashboard "Pending Approvals" hub is the one place the designer reviews/sends/edits/discards. All 7 features feed into this hub.

## 1. Database (1 migration)

New table `ai_drafts`:
- `id, user_id, project_id, kind` (enum: `weekly_report | vendor_followup | delay_notice | holding | event_notification | smart_reply`)
- `recipient_kind` (`client | vendor`), `recipient_id`, `recipient_name`, `recipient_phone`
- `subject`, `body` (text), `meta` (jsonb — e.g. photos for weekly report, related task/delivery id)
- `status` (`pending | sent | discarded`), `sent_at`, `created_at`, `updated_at`
- RLS: `auth.uid() = user_id` for all CRUD (same pattern as existing tables)

New table `vendor_deliveries` (needed for #3 follow-up automation; currently no delivery dates exist):
- `id, user_id, project_id, vendor_id, item text, expected_date date, status (pending|delivered|delayed), created_at, updated_at`
- RLS: own-user only
- (Alternative: reuse `tasks` with an `assignee` matching a vendor — simpler but less precise. **Decision: add `vendor_deliveries` for clarity.**)

Add `last_client_message_at` is derivable from `messages` — no schema change needed for #7.

## 2. Server functions (`src/lib/ai-drafts.functions.ts`)

All `requireSupabaseAuth`-protected:
- `listPendingDrafts()` — drafts where status='pending'
- `sendDraft({id})` — inserts into `messages` (from_me=true, kind matches recipient), sets draft.status='sent', sent_at=now
- `updateDraftBody({id, body})` — edit
- `discardDraft({id})` — status='discarded'
- `generateSmartReplies({messageId})` — calls Lovable AI gateway with project context, returns 3 short reply strings (no DB write; client uses inline)
- `generateWeeklyReport({projectId})` — assembles completed/planned tasks + last 3 photos, calls AI, inserts draft
- `generateVendorFollowup({deliveryId})` — template-based, inserts draft
- `generateDelayNotice({taskId | deliveryId})` — template-based, inserts draft
- `generateHoldingMessage({clientId})` — template, inserts draft
- `generateEventNotification({kind, payload})` — WhatsApp-style template, inserts draft

AI calls use `google/gemini-3-flash-preview` via `https://ai.gateway.lovable.dev` with `LOVABLE_API_KEY`.

## 3. Public cron endpoint (`src/routes/api/public/hooks/ai-drafts-cron.ts`)

Single POST handler dispatched by `pg_cron` with `apikey` header:
- **Sunday 09:00** — generate weekly reports for every active project per user
- **Every hour** — scan vendor_deliveries with `expected_date = today + 3 days` and no existing follow-up draft → generate one
- **Every hour** — scan tasks `due_date < today AND done=false` and deliveries `status='delayed'` → generate delay notice (dedupe by meta)
- **Every hour** — scan latest inbound client message per thread; if `> 6h` since arrival and no outgoing reply and no pending holding draft → generate holding message

Uses `supabaseAdmin` to iterate all users. Single cron job hits this endpoint hourly; weekly-report branch self-gates on `dayOfWeek===0 && hour===9`.

## 4. Frontend

### Dashboard (`_authenticated/index.tsx`)
- New **Pending Approvals** section (above Fire Alerts): list of drafts with `[kind tag] [recipient → project]`, full body preview, **Send Now / Edit / Discard** buttons
  - Edit → inline textarea + "Send Edited Message"
  - Discard → AlertDialog confirm
  - Send Now → toast "Message sent to {name}" + green Sent tag (then row falls out of pending query)
- **Weekly Report cards** = drafts where `kind='weekly_report'`, rendered with the same approve-and-send action

### Messages page (`_authenticated/messages.tsx`)
- Below each inbound message, fetch & display 2–3 smart-reply chips
- Click chip → fills the composer textarea (editable before send)

### New components
- `src/components/PendingApprovals.tsx` — the hub list (reused on dashboard)
- `src/components/DraftCard.tsx` — single draft row with the 3 buttons
- `src/components/SmartReplies.tsx` — inline chips

## 5. WhatsApp Push (#5)
Triggered in-app when key events happen (new photo, approval needed, invoice sent, milestone): the relevant mutation calls `generateEventNotification` so a draft lands in Pending Approvals with a "WhatsApp" tag. Send Now opens `wa.me/<phone>?text=<body>` in a new tab AND records into `messages`.

## 6. Out of scope (v1)
- Actual WhatsApp Business API integration (we use `wa.me` deeplinks + record-keeping)
- Real-time push to designer's phone (in-app only)
- Multi-language drafts (English only)
- Editing weekly report photo selection (auto-picks last 3)

## Files

**New**
- `supabase/migrations/<ts>_ai_drafts.sql`
- `src/lib/ai-drafts.functions.ts`
- `src/routes/api/public/hooks/ai-drafts-cron.ts`
- `src/components/PendingApprovals.tsx`
- `src/components/DraftCard.tsx`
- `src/components/SmartReplies.tsx`

**Edited**
- `src/routes/_authenticated/index.tsx` — add PendingApprovals + weekly report cards
- `src/routes/_authenticated/messages.tsx` — wire SmartReplies + 6h holding fires server-side via cron
- `src/routes/_authenticated/vendors.tsx` — add "Add delivery" UI (minimal) so #3 has data to drive
- `src/routes/_authenticated/projects.$projectId.tsx` — call `generateEventNotification` on photo upload / approval creation / invoice send / milestone complete

## Cron setup
After migration approval, run one `cron.schedule` insert hitting `/api/public/hooks/ai-drafts-cron` hourly with the project's anon key.

Approve to proceed.
