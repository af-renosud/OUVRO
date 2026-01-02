# OUVRO - Mobile Companion App

## Overview
OUVRO is a responsive mobile companion app (iOS/Android) for site observations with media capture. Built with Expo and React Native, it enables architects and project managers to capture media-rich site observations with annotation capabilities, automatic transcription, and translation features. Features dual branding (OUVRO + Architects-France).

## Current State
The app is functional with the following features implemented:
- **4-tab navigation**: Projects, Queue, Files, Settings
- **Floating capture button**: Central camera FAB for quick access to observation capture
- **Media capture**: Photo, video, and audio capture screens with device camera/microphone permissions
- **Observation workflow**: Capture media, add title/description, transcribe audio, translate to French
- **Sync queue**: View pending observations, sync manually, share via WhatsApp/SMS
- **Project management**: Browse projects, view project details with observation count
- **Dual branding**: ARCHIDOC and Architects-France branding in header

## Tech Stack
- **Frontend**: Expo SDK 54, React Native, React Navigation 7
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI Integration**: Gemini AI (via Replit AI Integrations) for transcription and translation
- **Styling**: iOS 26 Liquid Glass design aesthetic

## Project Structure
```
client/
├── navigation/         # React Navigation setup
│   ├── RootStackNavigator.tsx
│   └── MainTabNavigator.tsx
├── screens/           # All app screens
│   ├── ProjectsScreen.tsx
│   ├── QueueScreen.tsx
│   ├── FilesScreen.tsx
│   ├── ProjectFilesScreen.tsx
│   ├── FileViewerScreen.tsx
│   ├── AnnotationScreen.tsx
│   ├── SettingsScreen.tsx
│   ├── CaptureModalScreen.tsx
│   ├── PhotoCaptureScreen.tsx
│   ├── VideoCaptureScreen.tsx
│   ├── AudioCaptureScreen.tsx
│   ├── ObservationDetailsScreen.tsx
│   └── ProjectDetailScreen.tsx
├── components/        # Reusable UI components
├── constants/         # Theme and brand colors
└── lib/              # API utilities

server/
├── routes.ts         # Express API routes
├── storage.ts        # Database operations
└── index.ts          # Server entry point

shared/
└── schema.ts         # Drizzle database schema
```

## Key Features
1. **Photo Capture**: Take photos or select from gallery, with retake option
2. **Video Recording**: Record site videos with duration timer
3. **Audio Recording**: Record narration with waveform visualization
4. **Transcription**: Convert English audio to text using Gemini AI
5. **Translation**: Translate text to French for contractor communication
6. **Share Options**: WhatsApp and SMS sharing of observations
7. **Sync Queue**: Manual sync control with WiFi/cellular preferences
8. **Project Files**: Browse project documents by Loi MOP category
9. **File Viewer**: View PDFs and images from ARCHIDOC Asset Hub
10. **Annotations**: Draw markups on images (pen, arrow, shapes, text) with French construction standard colors

## External API Integration
The app connects to the live ARCHIDOC system at https://archidoc.app to fetch project data. The ARCHIDOC API URL is configurable via the `EXPO_PUBLIC_ARCHIDOC_API_URL` environment variable.

### ARCHIDOC API (External)
- `GET /api/projects` - Fetch projects from ARCHIDOC (projectName, clientName, address, status)
- `GET /api/archive/files?projectId={id}&category={cat}` - List files by project and category
- `GET /api/archive/files/{objectId}` - Get signed download URL for file
- `POST /api/uploads/request-url` - Request signed upload URL
- `POST /api/archive/files` - Archive uploaded file to project

### Local API Endpoints
- `GET /api/observations/pending` - Get pending sync queue
- `POST /api/observations` - Create observation
- `POST /api/sync-observation/:id` - Sync observation
- `DELETE /api/observations/:id` - Delete observation
- `POST /api/transcribe` - Transcribe audio (Gemini AI)
- `POST /api/translate` - Translate text (Gemini AI)

### Field Mapping (ARCHIDOC → Field App)
- `projectName` → `name`
- `clientName` → `clientName`
- `address` → `location`
- `status` → `status`

## Design System
- **Primary Dark Blue**: #0B2545 (headers, buttons, key actions)
- **Medium Blue**: #4299E1
- **Light Blue**: #63B3ED
- **Accent**: #319795 (Teal)
- **Error/Delete**: #EA526F (Coral Red - use sparingly)
- **Success**: #10B981 (Green)
- **Background**: #F8F9FA (Light Gray)
- **Text**: #2D3748 (Dark Gray)
- **Touch Targets**: 48-56pt minimum for field use
- **Style**: iOS 26 Liquid Glass effect
- **App Logo**: assets/images/archidoc-logo.png

## Running the App
The app runs on port 8081 (Expo dev server) with Express backend on port 5000.
Users can scan the QR code with Expo Go to test on physical devices.

## Pre-Deployment Audit Command
To run a comprehensive pre-deployment audit, prompt the agent with: **"RUN PREDEPLOYMENT AUDIT"**

This will execute the following checks:
1. **LSP Diagnostics**: Check all TypeScript files for errors
2. **Database Schema**: Verify all tables exist and schema is correct
3. **Security Audit**: Scan client code for exposed secrets/API keys
4. **API Endpoints**: Verify all routes have proper error handling
5. **Environment Config**: Check required environment variables are set
6. **App Configuration**: Verify app.json settings (bundle ID, icons, permissions)
7. **Workflow Status**: Confirm dev server is running correctly
8. **Generate Report**: Save audit results to replit.md

---

## Latest Pre-Deployment Audit Results
**Date**: January 2, 2026

| Check | Status | Details |
|-------|--------|---------|
| LSP Diagnostics | PASS | No TypeScript errors found |
| Database Schema | PASS | 7 tables verified (users, projects, observations, observation_media, project_files, conversations, messages) |
| Security Audit | PASS | No exposed secrets in client code |
| API Endpoints | PASS | All endpoints have try/catch error handling |
| Environment Config | PASS | EXPO_PUBLIC_ARCHIDOC_API_URL set, all secrets configured |
| App Configuration | PASS | Bundle ID: com.ouvro.field, icons configured, permissions set |
| Workflow Status | PASS | Express server on :5000, Expo on :8081 running |

**Minor Warnings (non-blocking):**
- Some Expo packages have newer patch versions available (expo@54.0.25 → 54.0.30, etc.)
- Browser console shows deprecated shadow*/pointerEvents warnings (React Native Web cosmetic)

---

## Recent Changes
- January 2, 2026: ARCHIDOC Project Files Integration
  - New FilesScreen: Browse projects to access their files
  - ProjectFilesScreen: View files by Loi MOP category (ESQ, APS, APD, PRO, DCE, ACT, VISA, DET, AOR)
  - FileViewerScreen: View PDFs (WebView) and images with zoom
  - AnnotationScreen: Draw on images with pen, arrow, rectangle, circle, and text tools
  - Annotation colors: Red (defects), Orange (warnings), Blue (info), Green (approved), Black (general)
  - Save annotations: Flattens drawing onto image and uploads to ARCHIDOC annotations category
  - API client in archidoc-api.ts: fetchProjectFiles, getFileDownloadUrl, requestUploadUrl, archiveUploadedFile
  - Added react-native-svg, react-native-webview, react-native-view-shot dependencies
  - Added Typography.bodyBold and Typography.caption to theme
- January 2, 2026: Audio capture screen fix
  - Converted from dynamic imports to static imports for expo-av and expo-audio
  - Restored 10-second permission timeout safeguard to prevent hanging
  - Fixed import order - all imports at top of file before type declarations
- January 2, 2026: Pre-deployment audit completed
  - All LSP diagnostics clear, no TypeScript errors
  - Database schema verified: 7 tables (users, projects, observations, observation_media, project_files, conversations, messages)
  - Security audit passed: No exposed secrets in client code
  - All API endpoints have proper error handling
  - Audio recording now properly saves M4A files using expo-av Recording API
  - Video and photo capture verified working with real file URIs
- January 1, 2026: ARCHIDOC sync integration and layout fixes
  - Fixed ObservationDetailsScreen padding to prevent text overlapping with header (uses useHeaderHeight)
  - Updated sync endpoint to POST observations to ARCHIDOC /api/field-observations endpoint
  - Observations now store archidocProjectId (UUID) separately from local projectId (integer FK)
  - Sync payload includes: projectId, observedBy, summary, observedAt, classification, status, priority
  - Created default project (ID: 1) in local database for observations
- January 1, 2026: Pre-deployment audit fixes
  - Files tab shows "Coming Soon" message (backend not yet implemented)
  - API configuration properly handles missing EXPO_PUBLIC_ARCHIDOC_API_URL
  - Settings screen has placeholder alerts for Terms of Service and Privacy Policy
  - Cleaned up unused code and imports for production readiness
- January 1, 2026: Responsive design and dual branding improvements
  - Added Architects France logo to header alongside ARCHIDOC branding
  - All capture screens now use useWindowDimensions for responsive layouts (phones/tablets)
  - CaptureModalScreen auto-stacks buttons on phones (<500px width)
  - Photo/Video/Audio capture screens have solid backgrounds and proper safe area handling
  - Navigation types updated to use string IDs for ARCHIDOC UUID compatibility
- January 1, 2026: Enhanced sharing with attachment picker and email support
  - New ShareModal screen with attachment selection (choose which media to include)
  - Contact lookup to match contractor names from device contacts
  - Email sharing with expo-mail-composer and pre-filled recipient
  - WhatsApp/SMS with file attachments via expo-sharing
  - Updated Queue screen shows project name and attachment count
- January 1, 2026: Connected to live ARCHIDOC API at https://archidoc.app
  - Projects are fetched from external ARCHIDOC system (read-only companion app)
  - Field mapping: projectName→name, clientName, address→location, status
  - Centralized API configuration in `client/lib/archidoc-api.ts`
  - Environment variable: `EXPO_PUBLIC_ARCHIDOC_API_URL`
- January 1, 2026: Initial implementation of all core screens and navigation
- Complete media capture workflow with camera/microphone permissions
- Gemini AI integration for transcription and translation
- WhatsApp/SMS sharing functionality
