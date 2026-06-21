---
name: Detecting un-deployed ARCHIDOC routes at the BFF proxy
description: How to tell "ARCHIDOC route not deployed" from "resource genuinely not found" when a proxied OUVRO BFF call returns 404
---

OUVRO BFF routers proxy to ARCHIDOC (`EXPO_PUBLIC_ARCHIDOC_API_URL`, the
published host `https://archidoc-app-archidoc.replit.app`). When a proxied call
404s, inspect the upstream BODY the BFF logs, not just the status:

- **`<!DOCTYPE html> … <pre>Cannot GET /api/ouvro/...</pre>`** = Express default
  no-matching-route page → the route is **NOT deployed** on the ARCHIDOC host
  (their repl may have it, but it isn't published). This happens *before* auth,
  so a valid Bearer key won't change it.
- **A JSON error body** (e.g. `{"error":"..."}`) with 404 = the route EXISTS and
  is returning a genuine not-found for that resource. Contract is fine.

**Why:** an ARCHIDOC agent confirming "endpoints match the contract" only proves
their workspace, not the published deployment OUVRO actually calls. Always smoke
the live host before trusting a go-live.

**How to apply:** quick verify after any ARCHIDOC-side deploy —
`curl -s -w '\nHTTP %{http_code}\n' http://localhost:5000/api/<bff-path>/<id>`
with `SITE_REMINDERS_MODE=live` (or the equivalent live flag). 200 + expected
JSON envelope, or a JSON-bodied 4xx, means deployed; an HTML "Cannot GET" means
it isn't. The base host being healthy (projects load) does NOT imply a specific
new route is live.
