# OUVRO - Mobile Companion App

## Overview
OUVRO is a mobile companion app for architects and project managers, built with Expo/React Native, designed for on-site documentation. It integrates with the ARCHIDOC construction management platform, enabling media capture, annotation, transcription, translation, and synchronization of field observations. The app supports dual branding (OUVRO + Architects-France) and aims to streamline on-site reporting workflows.

## User Preferences
- Simple language and iterative development
- Ask before making major changes
- Detailed explanations preferred

## System Architecture

### UI/UX Decisions
- **Color Palette:** Primary Dark Blue (`#0B2545`), Medium Blue (`#4299E1`), Accent Teal (`#319795`), Coral Red (`#EA526F` for FAB), Success Green (`#10B981`), Warning Orange (`#DD6B20`), Tab Icon Amber (`#F59E0B`).
- **Typography Scale:** Defined hierarchy from `hero` (34px, 700) to `caption` (13px, 400).
- **Touch Targets:** Minimum 48pt, preferred 56pt, with a 92px diameter Floating Action Button (FAB).
- **Shadows:** Platform-specific implementations (`boxShadow` for web, native `shadow*` for iOS/Android) for cards, modals, and FAB.
- **Dual Branding:** Custom header component `HeaderTitle.tsx` handles "OUVRO" and "Architects-France" logos.

### Technical Implementations
- **Frontend:** Expo SDK 54 and React Native for cross-platform mobile development.
- **Navigation:** React Navigation 7+ using native stack and bottom tabs.
- **Data Fetching:** TanStack Query for efficient data management and caching.
- **Backend:** Express.js server (TypeScript) serving an API on port 5000 and a static landing page.
- **Database:** PostgreSQL with Drizzle ORM for local data persistence, hosted on Neon.
- **Offline Sync:** Observations and media stored locally using AsyncStorage, with a manual sync mechanism. States include pending, uploading_metadata, uploading_media, partial, complete, failed.
- **Annotation System:** In-app annotation tools (pen, arrow, circle, rectangle, freehand, text, measurement) with construction-standard colors. Supports pinch-to-zoom and flattens annotations onto images.
- **PDF Viewing:** PDFs rendered in `react-native-webview` with a "Capture for Annotation" feature. iOS uses native screenshot detection for clipping.
- **API Field Mapping:** Extensive mapping logic in `archidoc-api.ts` to convert snake_case API responses to camelCase for app consistency, including resilience for multiple field name variants.

### Feature Specifications
- **Observation Capture:** Floating capture button (FAB) for Photo, Video, or Audio. Includes observation details form, Gemini AI-powered transcription (audio to English) and translation (to French).
- **Project Asset Hub:** A 2x3 grid of buttons (PLANS, DQE, DOCS, LINKS, FICHES, DRIVE) with dynamic enablement logic based on project data availability.
- **DQE Browser:** Displays DQE items, filterable by lot code or contractor (data fetched from `/api/contractors`).

### System Design Choices
- **Modularity:** Clear separation of concerns with dedicated folders for components, hooks, libraries, navigation, and screens.
- **Environment Management:** Utilizes Expo environment variables for API URLs and secrets for database credentials and AI keys.
- **Error Handling:** App-wide `ErrorBoundary.tsx` with a `ErrorFallback.tsx` UI for graceful error management.
- **Keyboard Avoidance:** `KeyboardAwareScrollViewCompat.tsx` for optimal input experience.

## External Dependencies

- **ARCHIDOC API:** `https://archidoc-app-archidoc.replit.app` - Core construction management platform API for projects, files, uploads, and field observations.
- **PostgreSQL (Neon):** Primary database for the Express.js backend, managed by Drizzle ORM.
- **Gemini AI:** Used for audio transcription (audio to English text) and translation (to French text) services.
- **TanStack Query:** Client-side data fetching and state management.
- **React Navigation:** Library for navigation in React Native applications.
- **AsyncStorage:** For local persistence of observation queues and media references in the mobile app.
- **`react-native-webview`:** For rendering PDFs and web content within the app.
- **`expo-image`:** For cross-platform image handling.
- **`expo-screen-capture` & `expo-media-library`:** Used on iOS for PDF clip-to-annotate functionality.
- **`react-native-reanimated`:** For gesture handling in annotation system.