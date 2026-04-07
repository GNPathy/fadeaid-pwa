# FadeAid PWA — Issues & Feature Backlog

## Tester: Wife — Round 1 (Apr 6) + Round 2 (Apr 6 evening)

### T1-001 🔴 Correct/Incorrect has no decrement → ✅ Fixed (v1.1)
### T1-002 🔴 +New Profile doesn't open form → ✅ Fixed (v1.1)
### T1-003 🔴 Edit doesn't pre-fill data → ✅ Fixed (v1.1)
### T1-004 🟡 No delete option on profiles → ✅ Fixed (v1.1)
### T1-005 🟡 CSV missing GoalMet field → ✅ Fixed (v1.1)
### T1-006 🔴 Question number missing → ✅ Fixed (v1.1)
### T1-007 🟡 Fonts unreadable on some screens → ✅ Fixed (v1.1)
### T1-008 🔴 Setup gets stuck adding students → ⚠️ Need repro steps

---

## Round 2 Issues (Apr 6 evening)

### T2-000 🟡 +/- signs on prompt bands barely visible → ✅ Fixed (v1.2)
Bumped from 7% opacity to 85% white with text-shadow.

### T2-001 🔴 Need +/- on Correct/Incorrect bands → ✅ Fixed (v1.2)
Added visible ＋/＿ indicators. Response band uses top=increment, bottom=decrement.

### T2-002 🔴 +New Profile does nothing (her phone still on old version) → ✅ Already fixed in v1.1
She needs to clear cached PWA and reload.

### T2-003 🔴 Edit doesn't work + needs ✏️/🗑️ icons → ✅ Already fixed in v1.1
Added ✏️ edit and 🗑 delete buttons with confirmation.

### T2-004 🟡 Cumulative CSV needs GoalMet based on all prompts AND correct% → ✅ Fixed (v1.2)
GoalMet = "Yes" only if ALL prompts ≤ targets AND correct% ≥ correctPctGoal.

### T2-005 🟢 NEW: Add % Correct Goal field to student profile → ✅ Fixed (v1.2)
New field: "IEP Goal — Minimum % Correct Answers" (default 80%).
Shown in profile list, saved to DB, used in GoalMet logic, shown in analytics IEP table, included in CSV.

---

## Deferred Issues

| # | Issue | Priority |
|---|---|---|
| 001 | First-Run Privacy Notice | High |
| 002 | Data Retention Auto-Expiry (7/30/60 days) | Medium |
| 004 | PDF on iOS opens in tab | Low |
| 005 | In-app Help / User Manual | Medium |

---

## Round 3 Issues — from Bugs.pdf (Apr 6, late evening)

### T3-001 🔴 Modal layering: Profile list stays open after +New Profile
**Status:** 🔴 Open — needs fix
**Description:** After tapping `+New Profile`, the profile creation screen appears but the profile list modal stays visible behind it. User must manually tap Close — unintuitive.
**Root cause:** `newProfile()` calls `closeModal('modal-prof-list')` then opens profile modal with a 150ms delay, but on Android the animation timing means the list is still rendering when the modal opens.
**Fix:** Increase delay to 300ms OR use `addEventListener('transitionend')` to close list before opening form.

### T3-002 🔴 Sub-topic chips don't appear for some subjects
**Status:** 🔴 Open — needs fix
**Description:** Subtopic chips show for "Math" but not for "Signs" or "Lifeskills" in Start Class screen.
**Root cause:** Subject name in the student profile (e.g. "Community Signs") must exactly match the key in the sub-topic mapping textarea (e.g. "Signs"). Case and whitespace sensitive match.
**Fix:** Show a validation warning if subtopic keys don't match any configured subject. Also trim aggressively when parsing keys.

### T3-003 🔴 ARCHITECTURE GAP: "Question" construct missing from PWA
**Status:** 🔴 Open — major rework needed
**Description:** The Android app had a fundamental Session → Question hierarchy that was not ported to the PWA.

**The correct model:**
```
Session
  └── Question 1  →  Prompts(V/Vis/G) given before outcome  →  C:0 | I:1 | P:4
  └── Question 2  →  Prompts(V/Vis/G) given before outcome  →  C:1 | I:0 | P:3
  Session totals: C:2  I:1  P:10  Questions:3
```

**Interaction rules:**
- Pressing `Correct+` or `Incorrect+` = records outcome for CURRENT question, then advances to Question N+1
- Prompts (Verbal/Visual/Gestural) tapped before outcome belong to the current question
- IEP goal = max prompts allowed, measured EITHER per session OR per question (teacher's choice in profile)
- GoalMet = "Yes" ONLY if prompts did not exceed the goal threshold AND correct% ≥ correctPctGoal
  - Even if student answered correctly, if they needed more prompts than the IEP allows → NOT MET (show red)

**Currently missing:**
- Prominent "Active Question #N" display on tracking screen
- IEP Goal Mode selector in Student Profile: `Per Session` vs `Per Question`
- Per-question breakdown in History and PDF (Q1: C/I/P table)
- Real-time per-question prompt count vs goal (flash red if exceeded before Correct/Incorrect is pressed)
- Analytics IEP comparison using correct mode (total prompts ÷ sessions vs total prompts ÷ questions)

### T3-004 🟡 Colors and +/- not matching Android app
**Status:** 🔴 Open
**Description:** The PWA band colors, contrast, and +/- indicator visibility are all different from the Android app. Teachers find it hard to read in classroom conditions.
**Fix:** Match Android color scheme: green for correct, red for incorrect, distinct band colors. Make +/- symbols large, white, high-contrast. See design-considerations.md.

### T3-005 🟡 IEP Goal logic clarification (carried into next implementation)
**Confirmed behavior:**
- Goal = max prompts to achieve the answer within N prompts
- If student answers correctly but used MORE than IEP prompt limit → still NOT MET
- GoalMet must be checked against whichever mode is set (per session or per question)
- Report must flag exceeded goals in RED

