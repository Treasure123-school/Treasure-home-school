---
name: Split deployment — getApiUrl for all fetch calls
description: All raw fetch('/api/...) calls must use getApiUrl() or they hit Vercel (not Render) in production and return 405 for POST.
---

# Rule
Every `fetch('/api/...')` call in the React client MUST be wrapped with `getApiUrl(path)` from `@/config/api`.

**Why:** The app uses a split deployment: Vercel (frontend static) + Render (backend API).
In production, `VITE_API_BASE_URL` is set to the Render backend URL.  `getApiUrl()` prepends
that base when set, or returns a relative URL in dev (same-origin).  Raw relative fetch calls
bypass this and go to Vercel, which rewrites all paths to `index.html` and returns:
  - **405 Method Not Allowed** for POST/PUT/DELETE to static files
  - **200 with HTML** (not JSON) for GET requests — silent data failure

**Symptom seen:** POST /api/admin/force-resync-all-exams → Vercel → 405.

**How to apply:**
- Import: `import { getApiUrl } from '@/config/api';`
- Usage: `await fetch(getApiUrl('/api/whatever'), { ... })`
- This is safe in all environments: returns relative URL when API_BASE_URL is empty (dev).
- Fixed in a batch audit (July 2026): all portal pages, hooks, and components updated.
- `apiRequest()` from queryClient already calls `getApiUrl` internally — that's fine as-is.
