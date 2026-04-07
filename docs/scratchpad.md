# FadeAid PWA — Scratchpad
*Running working notes. Updated continuously during development.*

---

## Current Status: v1.2 deployed, v2.0 in planning

**Live URL:** https://gnpathy.github.io/fadeaid-pwa/
**Repo:** GNPathy/fadeaid-pwa

---

## What's Done (merged to main)

### v1.0 — Initial PWA
- Full SPA shell (index.html + app.js + db.js + sw.js + manifest.json)
- 4-band tracking dashboard (Verbal/Visual/Gestural + Correct/Incorrect)
- Session start/end flow with WakeLock
- IndexedDB persistence via idb library
- History tab with PDF export (jsPDF)
- Analytics tab with IEP goal comparison + WoW trend table
- CSV export
- Settings: configure lists, student profiles, haptic/audio toggles

### v1.1 — Round 1 bug fixes
- T1-001: Response band top/bottom split for +/-
- T1-002: Profile form shows even with empty source lists
- T1-003: Edit profile z-index fix (close list before opening form)
- T1-004: Delete profile button (🗑) with confirmation
- T1-005: CSV GoalMet column added
- T1-006: Question number (Q#) counter added to session header
- T1-007: Responsive font media queries
- T1-008: (partial) improved comma parser for source lists

### v1.2 — Round 2 bug fixes
- T2-000: +/- signs on prompt bands made visible (85% white opacity)
- T2-001: +/- indicators on Correct/Incorrect response bands
- T2-004: GoalMet logic updated to include correct% goal
- T2-005: New profile field — "Minimum % Correct Answers" (correctPctGoal)
- Analytics IEP table: added % Correct row
- CSV: added CorrectPct + CorrectPctGoal columns

---

## What's Next (v2.0) — 3 Commit Groups

### 🔧 Commit 1 — Fix Functionality ✅ DONE
- [x] B1: `questionNumber` on trackingEvents — already done in v1.1
- [x] A1: Modal delay 150→300ms — profile list fully closes before form opens
- [x] A2: Subtopic case-insensitive match — shows hint if no mapping found
- [x] B2: IEP Goal Mode — radio in profile modal, saved as `iepGoalMode`, loaded back on edit
- [x] B3: Q# display — prominent pill badge "Q1" in session header (starts at 1)
- [x] B4: Question advance — prompts stored at correct questionNum, Correct/Incorrect advances THEN resets qPromptCounts, undo restores correctly. Real-time goal-exceeded warning for per-question mode.

### 📊 Commit 2 — Fix Reporting & Analytics (B5, B6, B7)
- [ ] B5: History view — per-question breakdown in expanded session card
  - Group events by questionNumber: Q1: C:x I:x P:x, Q2: C:x I:x P:x
- [ ] B6: PDF export — per-question breakdown table, red rows for exceeded goals
- [ ] B7: Analytics + CSV — IEP mode-aware GoalMet
  - Per-question mode: avg prompts ÷ questions (not sessions)
  - Add `IEPGoalMode` column to CSV

### 🎨 Commit 3 — Fix Usability & UI (C1, C2)
- [ ] C1: Match Android color scheme
  - Correct: #4CAF50 · Incorrect: #F44336
  - Verbal: #2196F3 · Visual: #9C27B0 · Gestural: #009688
  - Background: #121212 (Material dark)
- [ ] C2: +/- button redesign — large explicit tap targets, 44px hit area, high contrast


---

## Key Decisions & Rules

### GoalMet definition (confirmed Apr 6)
> GoalMet = "Yes" ONLY IF:
> - All prompt types (V/Vis/G) ≤ their IEP targets (per session OR per question, depending on mode)
> - Correct% ≥ correctPctGoal
> Even if student answers correctly but with too many prompts → NOT MET → show RED

### Session → Question hierarchy
```
Session (= one class period, ~12-15 min)
  └── Question 1 → prompts before outcome → C:x | I:x | P:x
  └── Question 2 → prompts before outcome → C:x | I:x | P:x
  └── ...
  Session totals: C | I | P | Q (total questions)
```

### IEP Goal Modes
- **Per Session:** V/Vis/G targets = max prompts across the whole session
- **Per Question:** V/Vis/G targets = max prompts before each correct/incorrect answer
- Teacher selects mode when creating/editing student profile

### Interaction: Correct/Incorrect bands
- Top 70% of band = increment (+)
- Bottom 30% of band = decrement (-)
- Pressing + on Correct/Incorrect → records outcome → advances to next question
- Pressing - → undoes last outcome → decrements question number

### Subtopic matching
- Subject in profile MUST match mapping key exactly (case + whitespace)
- e.g. "Community Signs" profile needs "Community Signs=..." in mappings
- Warn user if mismatch detected

---

## Architecture Notes

### Files
- `index.html` — all HTML + inline CSS + all modal definitions
- `app.js` — all JS logic (state, bands, sessions, analytics, export)
- `db.js` — IndexedDB wrapper only (getDB, CRUD for profiles/sessions/events)
- `sw.js` — service worker (cache on install)
- `manifest.json` — PWA manifest

### DB Stores
- `studentProfiles` — id, name, subject, verbalTarget, visualTarget, gesturalTarget, correctPctGoal, iepGoalMode, iepGoal
- `sessions` — id, startTime, endTime, studentName, subject, subTopic, teacherName, classroom, iepGoalNotes, sessionGoals, notes, profileId
- `trackingEvents` — id, sessionId, eventType (VERBAL/VISUAL/GESTURAL/CORRECT/INCORRECT), timestamp, questionNumber

### State object (app.js)
```js
const S = {
  session: null,       // active session record
  profileId: null,
  counts: {VERBAL, VISUAL, GESTURAL, CORRECT, INCORRECT},
  questionNum: 0,      // current active question (1-based after first outcome)
  qPromptCounts: {},   // {VERBAL: n, VISUAL: n, GESTURAL: n} for current question
  timerStart: null,
  timerInterval: null,
  wakeLock: null,
  lastTap: {}
};
```

---

## Deployment
```bash
# Push to GitHub Pages
cd ~/0-code/FadeAid-PWA
git add -A
git commit -m "vX.X: <description>"
git push
```
After push, wife needs to **clear PWA cache** (delete from Home Screen → re-add in Safari) to get latest version.

---

## Open Questions / Needs Repro
- T1-008: Setup "gets stuck" adding students — need: device, browser, exact steps

---

*Last updated: April 6, 2026*
