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
