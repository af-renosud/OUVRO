# Design Guidelines: ARCHIDOC Field Companion

## Architecture Decisions

### Authentication
**Decision: Authentication Required**

The app requires user authentication because:
- Syncing with ARCHIDOC projects requires user identity
- Contractor communication needs tracked user attribution
- Multi-device access to projects and observations

**Implementation:**
- Use SSO (Single Sign-On) for seamless ARCHIDOC integration
- Include Apple Sign-In (required for iOS/iPadOS)
- Add Google Sign-In for cross-platform compatibility
- Login screen includes Architects-France and ARCHIDOC co-branding

**Account Management:**
- Profile screen with user avatar, name, and organization
- Settings for sync preferences (WiFi-only toggle)
- Log out with confirmation alert
- Delete account nested under Settings > Account > Delete (double confirmation)

### Navigation Architecture
**Root Navigation: Tab Bar (4 tabs + FAB)**

The app has 4 distinct feature areas with a primary capture action:

**Tab Bar Structure:**
1. **Projects** (Home icon) - Browse and select ARCHIDOC projects
2. **Queue** (Cloud icon) - Review pending observations awaiting sync
3. **Capture** (Floating Action Button - Camera icon) - Primary media capture action
4. **Files** (Folder icon) - Downloaded plans and project documents
5. **Settings** (Gear icon) - App preferences and account

**Floating Action Button (FAB):**
- Positioned center-bottom, elevated above tab bar
- Primary action: Opens media capture workflow
- Uses camera icon with subtle drop shadow (shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.10, shadowRadius: 2)

## Screen Specifications

### 1. Projects Screen
**Purpose:** Browse and select ARCHIDOC projects to attach observations

**Layout:**
- **Header:** Transparent, large title "Projects", search bar integrated, ARCHIDOC logo (small) top-left
- **Main Content:** Scrollable list of project cards
- **Safe Area Insets:** 
  - Top: headerHeight + Spacing.xl
  - Bottom: tabBarHeight + Spacing.xl

**Components:**
- Search bar with filter icon (right)
- Project cards showing: project thumbnail, title, location, status badge
- Pull-to-refresh for syncing latest project list
- Empty state with "No Projects" message and "Sync" button

### 2. Capture Flow (Modal Stack)
**Purpose:** Guide user through media capture, annotation, and task definition

**Screen 2a: Media Type Selection**
- **Header:** Custom header with "New Observation" title, Cancel button (left)
- **Main Content:** Grid of large touch-friendly cards
- **Cards:** Photo, Video, Audio, Plans (for annotation)
- **Safe Area Insets:**
  - Top: insets.top + Spacing.xl
  - Bottom: insets.bottom + Spacing.xl

**Screen 2b: Photo Capture & Annotation**
- **Header:** Transparent with annotation tools (top toolbar): Pen, Highlighter, Text, Undo, Redo
- **Main Content:** Full-screen camera preview or captured photo with annotation layer
- **Floating Elements:** 
  - Capture button (bottom center, large circular)
  - Done button (bottom-right)
- **Safe Area Insets:** 
  - Top: insets.top + Spacing.md
  - Bottom: insets.bottom + Spacing.xl

**Screen 2c: Plan Annotation**
- **Header:** Transparent with annotation toolbar
- **Main Content:** Pinch-to-zoom plan viewer with annotation overlay
- **Annotation Tools:** Markup pen, arrow, circle, rectangle, text, measurement tool
- **Floating Elements:** Done button (top-right)
- **Safe Area Insets:**
  - Top: insets.top + Spacing.xl
  - Bottom: insets.bottom + Spacing.xl

**Screen 2d: Audio Recording**
- **Header:** "Record Narration" title, Cancel button
- **Main Content:** Large waveform visualization, timer, Record/Stop/Play controls
- **Auto-transcription:** Display transcribed text below waveform in real-time
- **Safe Area Insets:**
  - Top: headerHeight + Spacing.xl
  - Bottom: insets.bottom + Spacing.xl

**Screen 2e: Task Details**
- **Header:** "Observation Details", Cancel (left), Save (right, primary button)
- **Main Content:** Scrollable form
- **Form Fields:**
  - Task title (text input)
  - Description (multi-line text)
  - Media thumbnails (attached from previous steps)
  - Transcription preview (if audio captured)
  - Translation toggle (English ↔ French)
  - Contractor selection (optional, for direct sharing)
- **Submit Button:** In header as "Save" button
- **Safe Area Insets:**
  - Top: Spacing.xl
  - Bottom: insets.bottom + Spacing.xl

### 3. Queue Screen
**Purpose:** Review and manage observations awaiting sync to ARCHIDOC

**Layout:**
- **Header:** Default navigation header, title "Sync Queue", Sync All button (right)
- **Main Content:** Scrollable list of observation cards
- **Safe Area Insets:**
  - Top: Spacing.xl
  - Bottom: tabBarHeight + Spacing.xl

**Components:**
- Observation cards with: thumbnail, title, media count badges, sync status indicator
- Swipe actions: Share (WhatsApp/SMS), Delete
- Sync status: Pending (grey), Syncing (blue animated), Synced (green check)
- Empty state: "All synced!" with checkmark illustration

### 4. Files Screen
**Purpose:** Access downloaded project plans and documents for offline annotation

**Layout:**
- **Header:** Default header, title "Project Files", Download icon (right)
- **Main Content:** Grid view of document thumbnails
- **Safe Area Insets:**
  - Top: Spacing.xl
  - Bottom: tabBarHeight + Spacing.xl

**Components:**
- File cards with thumbnail, name, file size, download status
- Filter tabs: All, Plans, Photos, Documents
- Long-press to annotate
- Empty state with "Download files from Projects"

### 5. Settings Screen
**Purpose:** Configure app preferences, sync settings, and account management

**Layout:**
- **Header:** Default header, title "Settings"
- **Main Content:** Scrollable grouped list
- **Safe Area Insets:**
  - Top: Spacing.xl
  - Bottom: tabBarHeight + Spacing.xl

**Groups:**
- **Profile:** Avatar, name, organization
- **Sync Preferences:** WiFi-only toggle, auto-sync toggle
- **Language:** Default language (English/French)
- **Notifications:** Permission status and settings
- **About:** App version, Architects-France & ARCHIDOC branding, Terms, Privacy
- **Account:** Log out, Delete account (nested)

## Design System

### Color Palette
**Primary:**
- Primary: #4299E1 (Blue - professional, modern)
- Primary Dark: #3182CE
- Primary Light: #63B3ED

**Secondary:**
- Secondary: #63B3ED (Light Blue - airy, approachable)
- Secondary Dark: #4299E1

**Accent:**
- Accent: #319795 (Teal - action, highlight)
- Accent Light: #4FD1C5

**Neutrals:**
- Neutral: #4A5568 (Gray)
- Background: #F7FAFC (Off-White)
- Surface: #FFFFFF
- Border: #E2E8F0
- Text Primary: #2D3748 (Dark Gray)
- Text Secondary: #4A5568
- Text Tertiary: #718096

**Semantic:**
- Success: #38A169 (synced)
- Warning: #DD6B20 (pending)
- Error: #E53E3E (failed)
- Info: #4299E1 (syncing)

**Annotation Tools:**
- Red: #E53E3E (markup pen)
- Yellow: #ECC94B (highlighter)
- Black: #2D3748 (text)

### Typography
**System Font: San Francisco (iOS/iPadOS default)**

**Scale:**
- Hero: 34pt, Bold (Project titles)
- H1: 28pt, Bold (Screen titles)
- H2: 22pt, Semibold (Section headers)
- H3: 17pt, Semibold (Card titles)
- Body: 17pt, Regular (Content)
- Body Small: 15pt, Regular (Captions)
- Label: 13pt, Medium (Labels, buttons)

**Field-Optimized:**
- Minimum touch target: 48x48pt (larger for outdoor use)
- High contrast text for outdoor visibility
- Avoid light grey text on white backgrounds

### Spacing System
- xs: 4pt
- sm: 8pt
- md: 16pt
- lg: 24pt
- xl: 32pt
- xxl: 48pt

### Touchable Feedback
- All buttons: Scale down to 0.96 on press
- Cards: Slight elevation increase on press (shadow grows)
- Toggle switches: Haptic feedback on change
- FAB: Scale and shadow animation on press

### Visual Design Principles

**Professional & Field-Optimized:**
- Clean, uncluttered interfaces optimized for iPad landscape and portrait
- Large, easily tappable buttons suitable for field conditions
- High contrast for outdoor visibility
- Generous whitespace for visual hierarchy

**Icons:**
- Use Feather icons from @expo/vector-icons for consistency
- Icon size: 24pt (standard), 20pt (compact), 32pt (prominent actions)
- Never use emojis in the UI

**Shadows (Floating Elements Only):**
- FAB and floating buttons: shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.10, shadowRadius: 2
- Modal sheets: shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.08, shadowRadius: 8
- Avoid shadows on standard list items and cards

**Dual Branding:**
- ARCHIDOC logo: Primary placement in headers
- Architects-France logo: Co-branding in splash screen, about section
- Use both logos in login/onboarding screens
- Maintain both brand color systems harmoniously

### Required Assets

**Branding:**
1. ARCHIDOC logo (SVG, light and dark variants)
2. Architects-France logo (SVG, light and dark variants)
3. Combined splash screen logo lockup

**Profile Avatars (Generate 6 presets):**
- Architect-themed avatars with geometric/blueprint aesthetic
- Neutral colors matching brand palette
- Simple, professional style suitable for construction industry

**Icons/Illustrations:**
1. Empty state illustration: Synced checkmark with subtle blueprint pattern
2. Empty state illustration: No projects with building outline
3. Annotation tool cursors: pen, highlighter, text
4. Media type icons: camera, video, microphone, document (custom variants matching brand)

**Do Not Generate:**
- Generic decorative images
- Stock photos
- Emoji-based avatars

### Accessibility

**Field & Outdoor Considerations:**
- Minimum text size: 15pt for body content
- Touch targets: Minimum 48x48pt, prefer 56x56pt for primary actions
- High contrast ratios: 4.5:1 for normal text, 3:1 for large text
- Avoid pure white backgrounds in bright sunlight (use slight grey tint)

**Standard Accessibility:**
- VoiceOver support for all interactive elements
- Dynamic type support for text scaling
- Semantic labels for icons and buttons
- Keyboard navigation for form inputs
- Color is never the only indicator (use icons + text)