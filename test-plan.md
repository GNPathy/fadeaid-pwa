# FadeAid PWA — Test Plan

## Test Environment
- **Local:** `http://localhost:8080` via `python3 -m http.server 8080`
- **Live:** `https://gnpathy.github.io/fadeaid-pwa/`
- **Devices:** Desktop Chrome, iPhone Safari, Android Chrome

---

## Phase 1 — Setup Flow
1. Open Settings tab (⚙️)
2. Tap **Configure Lists** → enter students, subjects, sub-topic mappings, aide name, classroom → Save
3. Tap **Student Profiles** → create at least 2 profiles with different IEP goal targets → Save
4. Verify profiles appear in the list

## Phase 2 — Session Start
1. Tap Sessions tab → **Start Class**
2. Select a profile from dropdown
3. Verify sub-topic chips populate from mappings
4. Tap a chip → verify it fills the sub-topic field
5. Fill Session Goals and IEP Notes
6. Tap **▶ Start Class**
7. Verify: 4-band dashboard appears, student name shows, timer starts

## Phase 3 — Band Interaction (Core)
| Action | Expected |
|---|---|
| Tap right side of Verbal band | Count increments, flash + audio |
| Tap left side of Verbal band | Count decrements |
| Tap right side of Visual band | Count increments |
| Tap left side of Gestural band | Count decrements |
| Tap right (green) side of Response band | Correct count increments |
| Tap left (red) side of Response band | Incorrect count increments |
| Count at 0, tap left | Count stays at 0 (no negative) |
| Android only | Vibration felt on every + tap |
| iPhone | Color flash visible on tapped band |

## Phase 4 — End Class
1. Tap ■ End from session header
2. Verify summary shows correct counts for all 5 event types
3. Add final notes → Save & End
4. Verify: returns to idle screen, "Session saved!" toast appears

## Phase 5 — History Tab
1. Navigate to History tab
2. Verify session card appears with correct student, subject, sub-topic, date
3. Tap card to expand → verify Teacher, Room, Goals, Notes show correctly
4. Tap **📄 Export PDF** → verify PDF downloads with correct data

## Phase 6 — Analytics Tab
1. Navigate to Analytics tab
2. Filter by student used in test → verify:
   - IEP Goal Comparison table appears with Verbal/Visual/Gestural targets
   - Status shows ✅ Under or ⚠️ Over correctly
3. Verify Week-over-Week table shows (after multiple sessions)
4. Verify Cumulative Performance table shows correct totals
5. Tap **📊 CSV** (top right) → verify CSV downloads with all columns including IEP goals

## Phase 7 — Offline Test
1. Load app in browser
2. Open DevTools → Network → set to Offline
3. Reload page → verify app still loads from cache
4. Navigate all tabs → verify no network errors
5. Start a class, log events → verify data persists after reload

## Phase 8 — Add to Home Screen (iOS)
1. Open `https://gnpathy.github.io/fadeaid-pwa/` in iPhone Safari
2. Tap Share → Add to Home Screen → Add
3. Launch from Home Screen
4. Verify: no browser chrome, full screen, correct icon and name
5. Run a full session → verify all features work

## Phase 9 — Feedback Toggles
1. Go to Settings → toggle Haptic OFF → log a prompt → confirm no vibration
2. Toggle Audio OFF → log a prompt → confirm no sound
3. Toggle both back ON → confirm feedback resumes

## Known Limitations (iPhone)
- No haptic vibration (blocked by iOS Safari) — visual flash is the alternative
- PDF download may open in browser tab rather than download directly on iOS

---

*Created: April 2026*
