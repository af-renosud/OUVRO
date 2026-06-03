---
name: ARCHIDOC firewall blocks "assettype" -> use mediaCategory
description: ARCHIDOC's edge WAF 403s any request containing "assettype"; the asset-register field was renamed to mediaCategory.
---

# ARCHIDOC WAF blocks the substring "assettype" (use `mediaCategory`)

ARCHIDOC (`https://archidoc-app-archidoc.replit.app`) sits behind a Google edge
WAF (`via: 1.1 google`) that returns a minimal HTML `403 Forbidden` page for ANY
request whose body, query string, or URL path contains the case-insensitive
substring **`assettype`**. Value is irrelevant; only the full token trips it
(`assetTy` passes). It normalizes JSON `\u` escapes, so escaping the key does
not help. App-level ARCHIDOC errors are JSON; this HTML page is the edge firewall.

**Resolution (agreed with ARCHIDOC team):** ARCHIDOC renamed the asset-register
required field from `assetType` to **`mediaCategory`**. Our OUVRO server proxy
forwards `mediaCategory` (never the blocked token) to ARCHIDOC.

**Why it matters / current contract:**
- `/api/field-observations/upload-url` does NOT need the field at all — works
  with just `{ fileName, contentType }`. Our proxy must not forward `assetType`.
- `/api/field-observations/:id/assets` (register-asset) requires `mediaCategory`.
  Our proxy accepts `mediaCategory ?? assetType` from our own client (the
  client->our-server hop has no WAF) and ALWAYS forwards `mediaCategory`.

**Deploy ordering gotcha:** there is NO overlap window where both field names
work, because the WAF already blocks the old `assetType` outright. So OUVRO
sending `mediaCategory` only fully succeeds once ARCHIDOC has DEPLOYED its
`mediaCategory` validation. Until then, register-asset returns 400
`Missing required fields: assetType` (a 400, not the 403 WAF page — proof our
side cleared the firewall).

**How to apply:** Never send a body/URL containing "assettype" to ARCHIDOC. The
DQE path is unaffected (uses `/api/uploads/request-url` field `name` +
`/api/ouvro/dqe/capture`). `archidocJsonPost` detects HTML 403 firewall pages
and returns a clear "Blocked by the ARCHIDOC firewall" message.
