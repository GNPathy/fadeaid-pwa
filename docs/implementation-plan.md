# FadeAid PWA — Implementation Plan

## Goal
Build a pixel-for-pixel PWA equivalent of the FadeAid Android manual-tracking app, deployable as a URL, working offline on iPhone, Android, and Desktop.

---

## File Structure

```
FadeAid-PWA/
├── index.html       ← Single-page app shell + all screens
├── app.js           ← All application logic
├── db.js            ← IndexedDB wrapper (idb library)
├── feedback.js      ← Haptic + audio + visual flash engine
├── pdf-export.js    ← jsPDF session report generator
├── csv-export.js    ← CSV Blob download utility
├── sw.js            ← Service Worker (offline cache)
├── manifest.json    ← PWA manifest
├── icon-192.png     ← App icon (192×192)
├── icon-512.png     ← App icon (512×512)
└── docs/            ← All documentation
```

---

## Phase 1 — Foundation & Data Layer
- [ ] Create `manifest.json`
- [ ] Create `sw.js` Service Worker — cache all assets on install
- [ ] Create `db.js` — IndexedDB via `idb`: stores `studentProfiles`, `sessions`, `trackingEvents`
- [ ] Register Service Worker in `index.html`
- [ ] Verify offline operation

## Phase 2 — Settings Screen
- [ ] Students list, Subjects list (comma-separated, localStorage)
- [ ] Sub-topic mappings per subject
- [ ] Student × Subject profile setup (Verbal / Visual / Gestural targets)
- [ ] Aide name + Classroom fields
- [ ] Haptic toggle, Audio toggle
- [ ] Clear All Data (wipes IndexedDB + localStorage)

## Phase 3 — Session Start ("Start Class")
- [ ] Student × Subject dropdown
- [ ] Sub-topic dropdown (pre-populated + free-text)
- [ ] Session Goals + IEP Notes fields
- [ ] Start Class → creates session record in IndexedDB
- [ ] WakeLock request on session start
- [ ] Visibility change guard

## Phase 4 — 4-Band Dashboard (Core Feature)
- [ ] 4-band CSS layout — full viewport height, equal bands
- [ ] Response band: two sub-bands (Correct green | Incorrect red)
- [ ] Prompt bands: Verbal (blue), Visual (purple), Gestural (teal)
- [ ] 50/50 left/right touch split per band
- [ ] Right tap (+): increment, log `trackingEvent` to IndexedDB
- [ ] Left tap (−): decrement, delete last matching event from IndexedDB
- [ ] Large centered counter per band
- [ ] Session header: student, subject, sub-topic, elapsed timer
- [ ] End Class button → finalization flow

## Phase 5 — Feedback Engine
- [ ] `navigator.vibrate()` with per-event patterns (Android)
- [ ] CSS flash animation fallback (iOS/Desktop)
- [ ] Web Audio API tone on every tap
- [ ] Respect haptic/audio toggles from Settings

## Phase 6 — History Tab
- [ ] Session list from IndexedDB (newest first)
- [ ] Session cards with expandable metadata
- [ ] PDF Export per session via `jsPDF`

## Phase 7 — Analytics Tab
- [ ] Student filter + Subject filter (independent)
- [ ] Weekly Summary table (Mon–Fri × prompt type)
- [ ] Cumulative Performance table
- [ ] CSV Export — all sessions, all events, all metadata

## Phase 8 — Polish & PWA Compliance
- [ ] Mobile-first responsive layout
- [ ] Bottom tab bar: Sessions | History | Analytics | Settings
- [ ] Match Android color scheme (see design-considerations.md)
- [ ] App icons 192px + 512px
- [ ] Lighthouse PWA score ≥ 90
- [ ] Test on: iPhone Safari, Android Chrome, Desktop Chrome

## Phase 9 — Deployment
- [ ] Host on GitHub Pages (`GNPathy/fadeaid-pwa`)
- [ ] Share URL with test group
- [ ] Gather feedback, iterate

---

## Verification Checklist
- [ ] Add to Home Screen works on iPhone Safari
- [ ] Add to Home Screen works on Android Chrome
- [ ] App works fully offline after first visit
- [ ] All 5 band events log correctly to IndexedDB
- [ ] Undo (−) removes only the correct last event
- [ ] Session saves on End Class
- [ ] History shows all past sessions
- [ ] PDF exports correct data
- [ ] CSV downloads with all columns
- [ ] Analytics filters work independently
- [ ] WakeLock prevents sleep during session
- [ ] Colors match Android app exactly

---

*Last updated: April 2026*

---

# v2.0 Implementation Plan — Question Architecture + UX Rework
*Added: April 6, 2026 — based on Round 3 testing feedback from Bugs.pdf*

## Background & Goal
The initial PWA port missed the core Session → Question hierarchy from the Android app.
This plan restores it faithfully and addresses all outstanding UX/color/visibility issues.

---

## Phase A — Quick Bug Fixes (T3-001, T3-002)

### A1 — Fix modal layering (T3-001)
**File:** `app.js` — `newProfile()` and `editProfile()`
- Change `setTimeout` delay from 150ms → 300ms
- OR: listen for the overlay's CSS transition to fully complete before opening form modal

### A2 — Fix subtopic case/whitespace mismatch (T3-002)
**File:** `app.js` — `saveSourceList()` and `updateSubChips()`
- Normalize both the stored mapping key and the profile subject to lowercase + trimmed for lookup
- Add toast warning: "⚠️ Subjects in mappings must match subjects in your profile exactly"
- Display mapping keys in Configure Lists with a validation tick against the subjects list

---

## Phase B — Question Architecture (T3-003) ← CORE

### B1 — Data model: add `questionNumber` to trackingEvents
**File:** `db.js`
- `trackingEvents` already has `questionNumber` field (added in v1.1) ✅
- No DB schema change needed — events already carry question context

### B2 — IEP Goal Mode in Student Profile
**File:** `index.html` — profile modal form
**File:** `app.js` — `saveProfile()`, `openProfileModal()`
- Add radio/toggle: **"IEP Goal measured per: [ Session ] [ Question ]"**
- New field stored on profile: `iepGoalMode: 'session' | 'question'`
- When `per question`: the V/Vis/G targets mean "max prompts per question"
- When `per session`: current behavior (total prompts for whole session)

### B3 — Tracking screen: Active Question display
**File:** `index.html` — session tracking view
**File:** `app.js` — `tap()`, `updateQNum()`
- Replace small `Q0` label with large, prominent **"Active Question #N"** display
- Show per-question prompt running count when in per-question mode
- Flash the question counter RED if current question's prompts exceed IEP per-question goal (real-time warning)

### B4 — Question advance logic
**File:** `app.js` — `tap()` for CORRECT/INCORRECT
- Pressing `Correct+` → record outcome for current question → **increment questionNum** → reset per-question prompt counter
- Pressing `Incorrect+` → same flow: record outcome → increment questionNum → reset counter
- Pressing `Correct-` or `Incorrect-` (undo) → decrement questionNum → restore per-question counter

### B5 — History view: per-question breakdown
**File:** `app.js` — `renderHistory()`
- In the expanded session card, show the events timeline grouped by question:
  ```
  Q1  C:0  I:1  P:4   ← prompts: Verbal×2, Visual×1, Gestural×1
  Q2  C:1  I:0  P:3   ← prompts: Verbal×3
  Q3  C:1  I:0  P:1
  ─────────────────────
  Session: C:2  I:1  P:8  Questions:3
  ```

### B6 — PDF export: per-question breakdown table
**File:** `app.js` — `exportSessionPDF()`
- Add per-question table after the summary block
- Highlight any question where prompts exceeded the IEP per-question goal in red

### B7 — Analytics & CSV: IEP mode-aware
**File:** `app.js` — `renderAnalytics()`, `exportCSV()`
- If `iepGoalMode === 'question'`: compute avg prompts per question (not per session)
- GoalMet: check prompt count against the correct denominator
- Keep `GoalMet` column in CSV; add `IEPGoalMode` column

---

## Phase C — Color & Visibility Rework (T3-004)

### C1 — Match Android color scheme
**File:** `index.html` CSS `:root` variables
- Correct (green): `#4CAF50` → brighter, high contrast
- Incorrect (red): `#F44336` → deeper red
- Verbal (blue): `#2196F3`
- Visual (purple): `#9C27B0`
- Gestural (teal): `#009688`
- Background: near-black `#121212` (Material dark)
- Band backgrounds: slightly lighter than bg for each band to keep separation

### C2 — +/- button redesign
**File:** `index.html` — band markup
- Replace text hints with large explicit `＋` and `−` buttons at top and bottom of each response band
- Style as semi-transparent tap targets with 44px minimum hit area (WCAG)
- High contrast: white symbols on colored band backgrounds

---

## Verification Plan

| Test | Expected |
|---|---|
| New session: tap 3 prompts, tap Correct | Q1: C:1 I:0 P:3, advance to Q2 |
| Exceed per-question goal | Real-time red warning on active question counter |
| History expand | Per-question table visible |
| PDF export | Per-question table in PDF, red rows for exceeded goals |
| CSV | GoalMet column correct for both modes |
| Subtopics | "Community Signs" profile shows Signs subtopics |
| +New Profile | List modal closes, form opens, no overlap |

---

## Implementation Order
1. A1 (modal fix) + A2 (subtopic fix) → commit → push → test
2. B2 (IEP mode field) + B3 (Q# display) + B4 (Q advance logic) → commit
3. B5 (history) + B6 (PDF) + B7 (CSV/analytics) → commit
4. C1 (colors) + C2 (+/- redesign) → commit → push → full regression test

*Last updated: April 6, 2026*