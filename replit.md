# OUVRO - Mobile Companion App

## Overview
OUVRO is a responsive mobile companion app (iOS/Android) built with Expo and React Native, designed for architects and project managers to capture media-rich site observations. It features annotation capabilities, automatic transcription, translation, and dual branding (OUVRO + Architects-France). The app integrates with the ARCHIDOC system for project data and file management, streamlining on-site documentation and communication.

## User Preferences
I prefer simple language and iterative development. Ask before making major changes. I prefer detailed explanations.

## System Architecture
The application uses an Expo SDK 54, React Native frontend with React Navigation 7. The backend is an Express.js server with TypeScript, utilizing PostgreSQL with Drizzle ORM. AI capabilities for transcription and translation are powered by Gemini AI. The UI/UX adheres to an iOS 26 Liquid Glass design aesthetic with a specific color palette (Primary Dark Blue: #0B2545, Accent: #319795, Error: #EA526F, Success: #10B981, Background: #F8F9FA, Text: #2D3748) and ensures touch targets of 48-56pt minimum.

Key features include:
- **4-tab navigation**: Projects, Queue, Files, Settings.
- **Floating capture button**: Central FAB for quick observation capture.
- **Media Capture**: Photo, video, and audio capture with device permissions, retake options, and waveform visualization for audio.
- **Observation Workflow**: Capture media, add title/description, transcribe audio (English), translate to French.
- **Sync Queue**: Manual sync control, view pending observations, share via WhatsApp/SMS.
- **Project Management**: Browse projects, view details, observation count.
- **Dual Branding**: ARCHIDOC and Architects-France branding in the header.
- **File Management**:
    - **6-button menu** per project (PLANS, DQE, DOCS, LINKS, FICHES, DRIVE).
    - **PlansScreen**: Browse plans & drawings (category: "plans").
    - **DQEBrowserScreen**: Scrollable DQE item list with lot and contractor filtering.
    - **DocsScreen**: Browse general documents (category: "general").
    - **Links**: Modal with external links (Photos du Site, Modèles 3D, Visite 3D).
    - **FichesScreen**: View all DQE item attachments.
    - **Drive**: Opens project Google Drive folder.
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

## Recent Changes (January 2, 2026)
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
- **Added PDF Clip-to-Annotate**: FileViewerScreen now shows a "Capture for Annotation" button when viewing PDFs, allowing architects to pinch/zoom and capture the current view for annotation

**Note:** Files uploaded before January 2, 2026 may have empty `category`/`projectId` and won't appear in filtered queries.