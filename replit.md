# OUVRO - Mobile Companion App

## Overview
OUVRO is a responsive mobile companion app (iOS/Android) built with Expo and React Native, designed for architects and project managers to capture media-rich site observations. It features annotation capabilities, automatic transcription, translation, and dual branding (OUVRO + Architects-France). The app integrates with the ARCHIDOC system for project data and file management, streamlining on-site documentation and communication.

## User Preferences
I prefer simple language and iterative development. Ask before making major changes. I prefer detailed explanations.

## System Architecture
The application uses an Expo SDK 54, React Native frontend with React Navigation 7. The backend is an Express.js server with TypeScript, utilizing PostgreSQL with Drizzle ORM. AI capabilities for transcription and translation are powered by Gemini AI. The UI/UX adheres to an iOS 26 Liquid Glass design aesthetic with a specific color palette (Primary Dark Blue: #0B2545, Accent: #319795, Error: #EA526F, Success: #10B981, Background: #F8F9FA, Text: #2D3748) and ensures touch targets of 48-56pt minimum.

Key features include:
- **3-tab navigation**: Projects, Queue, Settings (simplified from 4 tabs).
- **Floating capture button**: Central FAB for quick observation capture.
- **Media Capture**: Photo, video, and audio capture with device permissions, retake options, and waveform visualization for audio.
- **Observation Workflow**: Capture media, add title/description, transcribe audio (English), translate to French.
- **Sync Queue**: Manual sync control, view pending observations, share via WhatsApp/SMS.
- **Project Management**: Browse projects, tap to access Project Asset Hub directly.
- **Dual Branding**: ARCHIDOC and Architects-France branding in the header.
- **Project Asset Hub**: Tap a project to see a 2x3 grid with 6 large buttons:
    - **PLANS**: Browse plans & drawings (category: "plans").
    - **DQE**: DQE item list with lot and contractor filtering.
    - **DOCS**: Browse general documents (category: "general").
    - **LINKS**: Modal with external links (Photos du Site, Modèles 3D, Visite 3D).
    - **FICHES**: View all DQE item attachments.
    - **DRIVE**: Opens project Google Drive folder.
- **File Viewer**: View PDFs and images with zoom.
- **Annotations**: Draw markups on images (pen, arrow, shapes, text, measurement) with French construction standard colors, saving annotations by flattening them onto the image.
- **PDF Clip-to-Annotate**: While viewing PDFs, architects can pinch/zoom to the desired area, tap "Capture for Annotation" to capture the current view as an image, annotate it, and save. Supports taking multiple clips from a single PDF.

The application structure separates client (navigation, screens, components, constants, lib), server (routes, storage, index), and shared (schema) concerns.

## External Dependencies
- **ARCHIDOC API**: `https://archidoc.app` for project data, file listing, file download URLs, and observation syncing. Configurable via `EXPO_PUBLIC_ARCHIDOC_API_URL`.
    - `GET /api/projects`
    - `GET /api/archive/files?projectId={id}&category={cat}`
    - `GET /api/archive/files/{objectId}`
    - `POST /api/uploads/request-url`
    - `POST /api/archive/files`
    - `POST /api/field-observations` (for syncing observations)
- **Gemini AI**: Integrated for audio transcription (English to text) and text translation (to French).
- **PostgreSQL**: Database used with Drizzle ORM.
- **Expo**: For development and building mobile applications.
- **React Native**: For UI development.
- **React Navigation**: For screen navigation.
- **expo-mail-composer**: For email sharing functionality.
- **expo-sharing**: For sharing files via WhatsApp/SMS.
- **react-native-svg**: For vector graphics.
- **react-native-webview**: For displaying PDFs.
- **react-native-view-shot**: For capturing views as images (used in annotations).

## ARCHIDOC API Field Mappings

### File API (snake_case → camelCase)
ARCHIDOC `/api/archive/files` returns snake_case. OUVRO transforms in `fetchProjectFiles()`:
- `object_id` → `objectId`
- `object_name` → `objectName`
- `original_name` → `originalName`
- `content_type` → `contentType`
- `project_id` → `projectId`
- `uploaded_at` → `createdAt`

Response format: `{ files: [...] }` (wrapped array)

### DQE Item Fields (ARCHIDOC → OUVRO mapping in `archidoc-api.ts`)
- `lotNumber` → `lotCode` - lot identifier (e.g., "GO", "VRD", "SO")
- `lotName` - full lot name (e.g., "GROS OEUVRE MAÇONNERIE")
- `description` or `title` → `description` - work item description
- `category` → `zone` - building location/category
- `tags` - array of tag strings
- `internalNotes` → `notes` - optional notes (array of `{ text }`)
- `projectAttachments` → `attachments` - actual file attachments (ARCHIDOC uses `projectAttachments`, not `attachments`)
  - Format: `{ id, name, url, type }`
- Project-level `lotContractors` maps lot codes to contractor IDs (items don't have individual contractor assignments)

### File Category Values
| Screen | Category Query |
|--------|---------------|
| PlansScreen | `plans` |
| DocsScreen | `general` |
| ProjectFilesScreen | `00` - `08` (Loi MOP phases) |

## Recent Changes (January 3, 2026)
- **Pinch-to-zoom for image annotations**: Added zoom functionality to AnnotationScreen for image files:
  - Tap the zoom icon (magnifying glass) in the toolbar to toggle zoom mode
  - In zoom mode: pinch to zoom (0.5x-5x), drag to pan, double-tap to reset
  - Tool buttons are dimmed and disabled in zoom mode - tap any tool to exit zoom mode
  - Zoom is automatically reset before saving to ensure full image is captured
- **iOS PDF Screenshot-to-Annotate**: Enabled PDF annotation on iOS using native screenshot detection:
  - When viewing PDFs on iOS, users see a hint: "Pinch to zoom, then take a screenshot to annotate"
  - Uses `expo-screen-capture` to detect when user takes a native screenshot (Power + Volume Up)
  - Uses `expo-media-library` to retrieve the screenshot from the camera roll
  - Automatically navigates to Annotation screen with the captured image
  - Requires photo library permission (requested on first use)
- **Pre-deployment audit completed**: All critical issues resolved for production release
- **CrossPlatformImage component**: Created to handle expo-image web compatibility issues, forwards onLoad/onError callbacks
- **Shadow props updated**: Platform-specific implementation using boxShadow for web and native shadow* props for iOS/Android
- **Debug logging production-safe**: All console.log statements gated with __DEV__ to prevent production logging
- **Simplified navigation to 3 tabs**: Removed Files tab, now Projects/Queue/Settings only
- **New ProjectAssetHubScreen**: Tapping a project now opens a 2x3 grid with 6 large buttons (PLANS, DQE, DOCS, LINKS, FICHES, DRIVE)
- **Removed FilesScreen**: No longer needed with new direct-access Asset Hub design
- **Updated ProjectsScreen routing**: Now navigates directly to ProjectAssetHub on project tap

## Changes (January 2, 2026)
- **Fixed DQE Browser contractor display**: Contractor chips now show company names (fetched from `/api/contractors` endpoint) instead of UUID codes
- **Fixed DQE lot filtering**: Selecting different lots (GO, SO, VRD) now correctly shows items for each lot - fixed by applying only the active filter (lot OR contractor) instead of both simultaneously
- Fixed file access: snake_case → camelCase field mapping for `/api/archive/files`
- Fixed DQE Browser: `designation` → `description` field name
- Added DQE fields: `zone`, `stageCode`, `tags`, `assignedContractorId`
- Contractor lookup uses `lotContractors` mapping from project data
- Fixed iOS dictation duplicate text bug with smart detection algorithm
- Fixed React key warnings in DQE Browser list items
- **Fixed DQE attachment (Fiches) stale URL issue**: Now fetches fresh signed URLs via `/api/archive/files/{objectId}` before opening files, with fallback to stored `fileUrl` if fresh URL unavailable
- **Extended annotation tools**: Now available across all usage points:
  - FichesScreen: Images open directly in annotation screen
  - ObservationDetailsScreen: Captured photos can be annotated with tap-to-annotate UI
  - PlansScreen/DocsScreen: Images open directly in annotation screen
  - FileViewerScreen: Images have annotate button in header
  - ProjectFilesScreen: Routes through FileViewer with annotation access
- **Fixed iOS annotation tool crash**: Wrapped gesture handler state updates with `runOnJS` from react-native-reanimated to prevent cross-thread violations
- **Fixed annotation save failure**: Updated `expo-file-system` import to use legacy API for SDK 54 compatibility
- **Added PDF Clip-to-Annotate**: FileViewerScreen now shows a "Capture for Annotation" button when viewing PDFs, allowing architects to pinch/zoom and capture the current view for annotation. Uses `captureScreen()` with status bar and UI chrome hidden during capture for clean PDF-only screenshots. Note: Feature disabled on iOS due to Quick Look rendering limitations.
- **Fixed annotation save API**: Updated ARCHIDOC upload API call to use correct field names (`name` instead of `fileName`, `uploadURL` instead of `uploadUrl`) and use dynamic `bucketName`/`objectName` from response.

**Note:** Files uploaded before January 2, 2026 may have empty `category`/`projectId` and won't appear in filtered queries.