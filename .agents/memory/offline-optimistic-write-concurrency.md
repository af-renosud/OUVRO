---
name: Offline optimistic-write concurrency rules (offline-* services)
description: Versioning + sequencing rules so optimistic offline writes never lose latest user intent or regress to stale server reads
---

OUVRO has several offline-first services (offline-sync, offline-tasks,
offline-dqe, offline-annotations, offline-reminders) built on DurableQueueStore.
Any of them that does optimistic local mutation + later server reconcile must
obey two rules, or it silently loses data:

1. **Per-op versioning.** Each user mutation gets a fresh monotonic `opSeq`. The
   in-flight sync snapshots the opSeq it sent; on completion (success OR error)
   it re-reads the current queue entry and bails out if the opSeq changed —
   otherwise a slow request deletes/clobbers a newer toggle the user just made.
   The batch sync loop should re-attempt an entry whose opSeq changed (superseded)
   but defer a same-opSeq transient failure to the next interval/reconnect pass
   (track attempts by localId→opSeq), so failures don't hammer.

2. **Read/write sequencing.** A GET (list refresh) started before a PATCH commit
   can return after it and overwrite the reconciled value. Guard with a
   per-project monotonic refresh token: bump on refresh-start AND on toggle
   reconcile; a refresh refuses to commit if its captured token is stale.

**Why:** the architect flagged a HIGH "in-flight sync clobbers newer toggle" race
and a stale-GET regression in the Site Reminders build; these are the standard
offline-first hazards, not one-offs.

**Also:** retry ceilings must be terminal. At MAX retries set state `failed`
(not perpetual `pending`) so it leaves the pending count and surfaces a manual
retry; `failed` still overlays its optimistic value (apply all states !=
`complete`) and `retryToggle` resets count + assigns a new opSeq.

**RN note:** the brief's "Dexie" is web-only — on React Native use AsyncStorage
via DurableQueueStore. Strip ephemeral fields (e.g. attachment `url`) before
durable caching; keep a volatile in-memory copy that retains them for display.
