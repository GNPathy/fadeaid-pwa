# FadeAid PWA — Design Considerations

## 1. Platform Decision

| Approach | iPhone | Android | Desktop | Offline | PDF | Haptics | Install-free | Effort |
|---|---|---|---|---|---|---|---|---|
| **PWA** *(chosen)* | ✅ | ✅ | ✅ | ✅ | ⚠️ jsPDF | ⚠️ Android only | ✅ | Low |
| React Native | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ App store | High |
| Flutter | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ App store | High |
| Hosted Web App | ✅ | ✅ | ✅ | ❌ | ⚠️ | ❌ | ✅ | Lowest |

**Why PWA:** School-year deadline, zero install friction for iPhone aides, identical 4-band UI maps perfectly to touch browser, IndexedDB matches Room DB semantics, 100% offline, FERPA-safe.

---

## 2. Haptic Feedback Analysis

### Where Haptics Fire in Android
Haptics fire in exactly one place: `TrackingViewModel.logEvent()` — every (+) tap. The (−) tap is intentionally silent.

| Event | Band | Vibration Pattern |
|---|---|---|
| VERBAL prompt | Verbal (+) | 50ms short tap |
| VISUAL prompt | Visual (+) | 50ms short tap |
| GESTURAL prompt | Gestural (+) | 50ms short tap |
| CORRECT response | Response green (+) | 80ms · 50ms gap · 80ms double-tap |
| INCORRECT response | Response red (+) | 200ms long buzz |

### Cross-Platform Support

| Platform | `navigator.vibrate()` | Strategy |
|---|---|---|
| Android Chrome | ✅ Full | Use vibrate() with matching durations |
| iOS Safari | ❌ Blocked | CSS color-flash + Web Audio tone |
| Desktop | ❌ N/A | CSS color-flash only |

### iOS Visual Flash Fallback
Every (+) tap triggers a CSS `@keyframes` color-pulse on the band:
- Prompt bands → white/blue flash (150ms)
- CORRECT → green flash (200ms)  
- INCORRECT → red flash (200ms)

Works better for eyes-up operation than haptics — the flash is visible in peripheral vision.

---

## 3. Android → PWA Feature Mapping (1:1)

| Android | PWA Equivalent |
|---|---|
| Jetpack Compose `SplitBand` | CSS Grid + touchstart region detection |
| `TrackingViewModel` + `StateFlow` | JS reactive state module |
| Room DB (SQLite) | IndexedDB via `idb` library |
| `StudentProfile` entity | IndexedDB store: `studentProfiles` |
| `SessionRecord` entity | IndexedDB store: `sessions` |
| `TrackingEvent` entity | IndexedDB store: `trackingEvents` |
| `TrackingService` (Foreground) | WakeLock API + visibilitychange guard |
| `VibrationEffect.createWaveform()` | `navigator.vibrate()` + CSS flash |
| `ToneGenerator` | Web Audio API `OscillatorNode` |
| `PdfExporter.kt` | `jsPDF` library |
| `CsvExporter.kt` | `Blob` + `<a download>` |

---

## 4. Color System — Exact Match to Android

| Role | CSS Variable | Hex |
|---|---|---|
| Background | `--bg` | `#0F1923` |
| Card surface | `--surface` | `#1A2535` |
| Primary action | `--primary` | `#4FC3F7` |
| Correct / Green | `--correct` | `#4CAF50` |
| Incorrect / Red | `--wrong` | `#F44336` |
| Verbal band | `--verbal` | `#1E88E5` |
| Visual band | `--visual` | `#7E57C2` |
| Gestural band | `--gestural` | `#00897B` |
| Text primary | `--text` | `#ECEFF1` |
| Text secondary | `--text-dim` | `#90A4AE` |
| Divider | `--border` | `#263545` |

> ⚠️ Verify against `ui/theme/Color.kt` in the Android source before final implementation.

---

## 5. IndexedDB Schema (mirrors Room DB)

```js
// studentProfiles
{ id, name, subject, iepGoal, verbalTarget, visualTarget, gesturalTarget }

// sessions
{ id, startTime, endTime, studentName, subject, subTopic,
  teacherName, classroom, iepGoalNotes, sessionGoals, notes }

// trackingEvents
{ id, sessionId, timestamp, eventType, questionNumber }
// eventType: "VERBAL" | "VISUAL" | "GESTURAL" | "CORRECT" | "INCORRECT"
```

---

## 6. PWA Manifest & Offline Strategy

```json
{
  "name": "FadeAid",
  "short_name": "FadeAid",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0F1923",
  "theme_color": "#4FC3F7",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- Service Worker caches all app assets on first load
- App works 100% offline after first visit
- Data stored in IndexedDB — never leaves the device
- `manifest.json` lives at the **root** of `FadeAid-PWA/` (not in `docs/`)

---

*Last updated: April 2026*
