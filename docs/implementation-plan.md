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