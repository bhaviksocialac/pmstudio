## Goal

Turn StudioOS from a mock-data prototype into a real multi-tenant app where each designer signs in, sees only their own data, and can create/edit projects, clients, and vendors backed by the database.

---

## 1. Authentication

**Login + Signup screens** at `/login` and `/signup`:
- Email + password fields with Zod validation
- "Continue with Google" button (uses Lovable's managed Google OAuth via `lovable.auth.signInWithOAuth("google", ...)`)
- Signup also collects **Full name** and **Studio name** (needed for the profile)
- Branded with StudioOS design tokens (Cormorant Garamond + DM Sans, terracotta `#c17f5a`)

**Auth wiring:**
- Enable Google provider via `configure_social_auth` (email stays enabled, email-confirm OFF for smoother demo unless you want it ON — tell me which)
- Pass session into router context; subscribe to `onAuthStateChange` at root to invalidate router + react-query
- Create `src/routes/_authenticated.tsx` layout with `beforeLoad` redirect to `/login`
- Move all current pages (`index.tsx`, `clients.tsx`, `vendors.tsx`, `projects.*`, `finance.tsx`, `messages.tsx`) under `src/routes/_authenticated/`
- `/login` redirects to `/` (dashboard) when already signed in; supports `?redirect=` param to bounce back after login

---

## 2. Database (one migration, all 10 tables + RLS)

All tables get: `id uuid pk`, `user_id uuid not null` (the designer who owns the row), `created_at`, `updated_at`, RLS enabled, and four policies (select/insert/update/delete) all scoped `auth.uid() = user_id`.

| Table | Key columns |
|---|---|
| `profiles` | `user_id` (unique, FK→auth.users), `full_name`, `email`, `studio_name`, `avatar_url` |
| `projects` | `name`, `client_id`, `location`, `phase` (enum), `completion`, `spent`, `budget`, `health`, `type`, `start_date`, `expected_handover`, `description` |
| `clients` | `name`, `phone`, `email`, `address`, `notes` |
| `vendors` | `name`, `category`, `phone`, `email`, `rating`, `payment_terms`, `notes` |
| `tasks` | `project_id`, `title`, `due_date`, `done`, `assignee` |
| `photos` | `project_id`, `room`, `caption`, `storage_path` |
| `invoices` | `project_id`, `client_id`, `number`, `milestone`, `amount`, `sent_at`, `due_at`, `status` |
| `approvals` | `project_id`, `title`, `status`, `approved_at` |
| `messages` | `thread_with` (client/vendor id), `kind`, `body`, `sent_at`, `from_me` |
| `payment_requests` | `vendor_id`, `project_id`, `scope`, `amount`, `submitted_at`, `status` |

**Auto-create profile on signup:** trigger `handle_new_user()` on `auth.users` insert that reads `raw_user_meta_data->>'full_name'` and `'studio_name'` (passed in `signUp({ options: { data: ... } })`) and inserts a row into `profiles`. For Google sign-in users, `full_name` comes from Google's metadata; `studio_name` defaults to `"My Studio"` and the user is prompted to update it on first dashboard visit.

`updated_at` trigger on every table.

---

## 3. Wire pages to live data

Use TanStack Query directly against the browser Supabase client (simpler than serverFns for CRUD against RLS-protected tables, and fits the existing client-side architecture):

- **Dashboard** (`/`) — `useQuery(['projects'])` → `supabase.from('projects').select()`. Header shows `profile.full_name`. Stat cards computed from rows. Empty state when no projects.
- **Projects index** — list from DB; "New Project" modal writes to `projects` (and creates/links a `clients` row)
- **Project detail** — loads single project by id
- **Clients** — list + "Add Client" writes to `clients`; client panel reads/updates
- **Vendors** — list + "Add Vendor" writes to `vendors`; vendor panel reads/updates
- Finance/Messages stay on mock data for now (not in scope per your list)

All mutations invalidate the matching query keys.

---

## 4. What stays mock vs goes live

| Live | Mock (unchanged) |
|---|---|
| profiles, projects, clients, vendors | finance page (invoices/payment requests UI still uses mock) |
| dashboard, projects pages, clients, vendors | messages page |

Tables for invoices/messages/etc. are created now so we can wire those pages in a follow-up without another migration.

---

## Technical notes

- Browser Supabase client (`@/integrations/supabase/client`) for all reads/writes — RLS enforces per-user scoping
- React Query for caching + invalidation; `QueryClientProvider` wraps `<Outlet />` in `__root.tsx`
- Auth state in router context; `_authenticated` layout uses `beforeLoad` for redirect (no flash)
- Sign-out button in sidebar profile dropdown calls `supabase.auth.signOut()` then navigates to `/login`
- Zod schemas for all forms (signup, login, new project, add client, add vendor)
- The existing `src/lib/studio-data.ts` mock arrays stay for finance/messages but `clients`/`vendors` references in `AppShell` search are switched to live queries

---

## One question before I build

**Email confirmation on signup:** off (instant sign-in, good for demo) or on (user must click verify link)? I'll default to **off** unless you say otherwise.