---
name: Type/syntax validation when tsc is too slow
description: How to validate client changes in this repl when full tsc never completes
---

Full-project `tsc --noEmit` (even with `--skipLibCheck`, even scoped to a few
files) does NOT complete within the available time budget in this repl — it
exceeds ~2 min and gets killed (exit 124/143). A scoped tsconfig still pulls the
whole RN/Expo type graph through imports, so it is not meaningfully faster.

**How to apply:** validate client edits by forcing a Metro bundle instead of
tsc. The entry is `client/index.js` (see `main` in package.json), so:

  curl -s -o /tmp/b.js -w "%{http_code} %{size_download}\n" \
    "http://localhost:8081/client/index.bundle?platform=ios&dev=true"

A 200 with a multi-MB body and no leading `{"type":"...Error"}` JSON means all
imports resolve and there are no syntax errors. Metro/Babel does NOT type-check,
so pair it with careful typing + the architect review for type-level confidence.
Also `npx` hangs (network) — call binaries directly: `./node_modules/.bin/tsx`,
`./node_modules/.bin/tsc`.
