# FadeAid PWA — Product Requirements

## Overview
A Progressive Web App delivering the full FadeAid manual prompt-tracking experience across iPhone, Android, and Desktop. Feature parity with the Android manual-only edition. All features map 1:1 unless explicitly noted as a PWA adaptation.

---

## Core Features

### 1. Manual 4-Band Split-Screen Dashboard
- Four full-width horizontal bands stacked vertically:
  1. **Response (Top)**: Correct (Green) | Incorrect (Red)
  2. **Verbal Prompts**: Blue-toned band
  3. **Visual Prompts**: Purple-toned band
  4. **Gestural Prompts**: Teal-toned band
- Each band split 50/50 vertically:
  - **Right half (+)**: Increment counter, log event
  - **Left half (−)**: Decrement counter, undo last event
- Large centered numeric counter per band
- Minimum 44px touch target per zone (WCAG 2.5.5)

### 2. Confirmation Feedback
- **Android**: `navigator.vibrate()` matching Android patterns:
  - Prompts: 50ms tap
  - CORRECT: 80ms + 50ms gap + 80ms double-tap
  - INCORRECT: 200ms long buzz
- **iOS fallback**: CSS color-flash on tapped band + Web Audio API tone
- **Audio pop**: Programmatic tone via Web Audio API (settings-controlled)

### 3. Student & Goal Management (Settings)
- Global students list and subjects list (comma-separated)
- Sub-topic mappings per subject (suggested during session setup)
- Student × Subject profiles: set Verbal / Visual / Gestural prompt targets
- Aide name and Classroom (auto-injected into session records)
- Haptic toggle and Audio toggle

### 4. Session Initiation ("Start Class")
- Select Student × Subject from dropdown
- Sub-topic dropdown (pre-populated, allows free-text)
- Optional Session Goals and IEP Notes fields
- Tap **Start Class** to begin

### 5. Session Stability
- **WakeLock API**: Prevents screen sleep during active sessions
- **Visibility Change Guard**: Warns if user navigates away mid-session
- All state persisted to IndexedDB in real-time (no data loss on tab switch)

### 6. History Tab
- Timeline of all past sessions (newest first)
- Session card: student, subject, sub-topic, date, duration, prompt totals
- Expandable: Teacher, Classroom, IEP Goal, Session Goals, Notes
- **PDF Export** per session via `jsPDF`

### 7. Analytics Tab
- Independent Student filter + Subject filter
- Weekly Summary Table (Mon–Fri prompt counts)
- Cumulative Performance Table (aggregated totals)
- **CSV Export**: Full raw data download as `.csv`

### 8. PWA / Offline
- `manifest.json`: name, icons, theme color, `display: standalone`
- Service Worker caches all assets on install; serves offline thereafter
- "Add to Home Screen" on Safari (iOS) and Chrome (Android)

### 9. Privacy
- 100% on-device — no server, no cloud, no analytics
- No camera, no microphone
- FERPA-ready; Settings → Clear All Data wipes everything

---

## Technical Specifications

| Concern | Approach |
|---|---|
| Framework | Vanilla HTML + CSS + JS (no build pipeline) |
| Storage | IndexedDB via `idb` v7+ |
| Offline | Service Worker + Cache API |
| PDF | `jsPDF` v2+ |
| CSV | Native `Blob` + `<a download>` |
| Audio | Web Audio API (`OscillatorNode`) |
| Haptics | `navigator.vibrate()` |
| Screen Lock | `navigator.wakeLock.request('screen')` |
| Min browser | Safari 16.4+ (iOS), Chrome 100+ (Android/Desktop) |

*Support: gaunt.apps@gmail.com*
