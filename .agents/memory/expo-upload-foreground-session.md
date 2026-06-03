---
name: Expo Go uploads must use FOREGROUND session
description: expo-file-system legacy uploadAsync/createUploadTask default to a BACKGROUND URLSession that is cancelled mid-upload in Expo Go.
---

# Expo Go media uploads must set sessionType: FOREGROUND

`expo-file-system/legacy` `createUploadTask` / `uploadAsync` default
`sessionType` to `FileSystemSessionType.BACKGROUND` (enum value 0). On iOS the
background session runs in a separate process (`nsurlsessiond`) and is
unreliable in Expo Go — uploads are cancelled mid-flight and surface as
`Error: Upload cancelled` (NSURLErrorCancelled), then retry forever.

**Fix:** always pass `sessionType: FileSystem.FileSystemSessionType.FOREGROUND`
in the upload options for any active, user-initiated upload.

**Why:** the user is watching sync progress, so a foreground session tied to the
app process is correct; background sessions only matter for true
background-while-suspended uploads, which Expo Go does not support reliably.

**How to apply:** every PUT-to-GCS upload site in the client needs it —
observation media (`offline-sync.ts`), DQE video (`offline-dqe.ts`), and
annotations (`offline-annotations.ts`). The server/GCS presigned-PUT path is
fine (verified: curl PUT to the signed URL returns 200); "Upload cancelled" is
purely a client-side native session issue, not a server/contract problem.
