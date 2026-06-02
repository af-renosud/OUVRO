---
name: ARCHIDOC firewall blocks "assettype"
description: ARCHIDOC's edge WAF 403s any request containing the substring "assettype"; affects field-observation media registration.
---

# ARCHIDOC WAF blocks the substring "assettype"

ARCHIDOC (`https://archidoc-app-archidoc.replit.app`) sits behind a Google edge
WAF (`via: 1.1 google`) that returns a minimal HTML `403 Forbidden` page for ANY
request whose body, query string, or URL path contains the case-insensitive
substring **`assettype`**. The value is irrelevant (`assetType:"audio"`,
`assetTypeX`, `foo:"assettype"` all 403); only the full token trips it
(`assetTy` passes). It even normalizes JSON `\u` escapes, so escaping the key
does not help. An app-level rejection from ARCHIDOC is JSON; this HTML page is
purely the edge firewall.

**Why this matters:**
- `/api/field-observations/upload-url` does NOT need `assetType` — works with
  just `{ fileName, contentType }`. Our proxy used to forward `assetType`,
  tripping the WAF and breaking ALL observation + DQE media uploads. Fixed by
  not forwarding it (see `server/routes/archidoc.ts`).
- `/api/field-observations/:id/assets` (register-asset) genuinely REQUIRES a
  field literally named `assetType` (no alias: type/kind/category/mediaType/
  assetKind all rejected) AND is blocked by the same WAF. This is unfixable on
  our side — the ARCHIDOC team must narrow/remove the WAF rule or rename the
  required field.

**How to apply:** Never send a body/URL containing "assettype" to ARCHIDOC. The
DQE path works because it uses `/api/uploads/request-url` (field `name`) +
`/api/ouvro/dqe/capture`, neither of which contains the token. `archidocJsonPost`
detects HTML 403 firewall pages and returns a clear "Blocked by the ARCHIDOC
firewall" message instead of leaking raw HTML.
