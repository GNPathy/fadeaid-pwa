# FadeAid PWA — Product Brief

## The Problem
Special needs class Aides must carefully track the frequency and types of prompts (Verbal, Visual, Gestural) they give students during IEP goal sessions. Paper tallying distracts from student interaction and is error-prone.

The Android version of FadeAid solved this — but most classroom Aides carry **iPhones**, leaving the majority of the target audience without access.

## The Solution
**FadeAid PWA** is a Progressive Web App — a zero-install, platform-agnostic version of FadeAid that runs in any modern browser on iPhone, Android, or Desktop. It delivers an identical experience to the Android app via a shareable URL. No App Store, no APK sideloading required.

> An aide with an iPhone opens a link in Safari, taps "Add to Home Screen," and has a full native-feeling app in seconds.

## Key Value Propositions
- **Universal Platform Support**: iPhone (Safari), Android (Chrome), Desktop
- **Zero Install Friction**: Share a URL — no App Store, no APK, no IT department
- **Identical 4-Band Interface**: Same split-screen prompt-logging dashboard, pixel-for-pixel
- **100% Offline**: Works with zero network after first load. All data stays on-device
- **Privacy First**: No camera, no microphone, no cloud. FERPA-ready by design
- **Full Reporting**: PDF session reports + CSV analytics export
- **Haptic + Visual Feedback**: Vibration on Android; color-flash on iPhone for eyes-up operation

## Target Audience
- Special Education Teachers
- Classroom Aides / Paraprofessionals (especially iPhone users)
- ABA Therapists
- Speech-Language Pathologists

## Core Technologies
- **Runtime**: Pure HTML + CSS + JavaScript (no build pipeline)
- **Storage**: IndexedDB via `idb` library (replaces Room DB)
- **Offline**: Service Worker + Cache API
- **PDF Export**: `jsPDF` library
- **CSV Export**: Native `Blob` download
- **Audio Feedback**: Web Audio API
- **Haptics**: `navigator.vibrate()` on Android; CSS flash animation on iOS

## Relationship to Android App
The PWA is a **parallel product**, not a replacement. The Android app continues independently. The PWA targets the non-Android segment (primarily iPhone-carrying aides).

*Support: gaunt.apps@gmail.com*
