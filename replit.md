# ARCHIDOC Field - Mobile Companion App

## Overview
ARCHIDOC Field is an iPad-optimized mobile companion app for the ARCHIDOC project management system. Built with Expo and React Native, it enables architects and project managers to capture media-rich site observations with annotation capabilities, automatic transcription, and translation features.

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

## External API Integration
The app connects to the live ARCHIDOC system at https://archidoc.app to fetch project data. The ARCHIDOC API URL is configurable via the `EXPO_PUBLIC_ARCHIDOC_API_URL` environment variable.

### ARCHIDOC API (External)
- `GET /api/projects` - Fetch projects from ARCHIDOC (projectName, clientName, address, status)

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

## Recent Changes
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
