## Rename "StudioOS" → "PMStudio" Everywhere

Replace the app name in all user-facing locations while keeping split-logo styling where the brand currently uses two colors.

### Files & exact changes

1. **src/components/AppShell.tsx** (sidebar logo)
   - Split wordmark: `PM` white + `Studio` accent (replaces `Studio` white + `OS` accent)
   - Keep "Design Command Centre" tagline unchanged.

2. **src/components/AuthScreen.tsx**
   - Left-panel hero wordmark: `PM` white + `Studio` accent
   - Mobile header wordmark: same split styling
   - Toast: `Welcome to PMStudio`
   - Footer copyright: `© PMStudio 2026`

3. **src/routes/login.tsx** (head meta)
   - Title: `Sign in — PMStudio`
   - Description: `Sign in to your PMStudio design command centre.`

4. **src/routes/signup.tsx** (head meta)
   - Title: `Create your studio — PMStudio`
   - Description: `Create your PMStudio workspace and run your design practice from one place.`

5. **src/routes/__root.tsx** (fallback browser tab title)
   - Replace `Lovable App` with `PMStudio` in both `title` and `og:title` meta entries.

### Out of scope (left untouched)
- Generic "studio" labels ("Studio name" field, "Studio Settings", fallback `"Studio"`) — these refer to the user's own studio.
- Internal code identifiers (`studioName`, `studio-data.ts`, DB column `studio_name`).
