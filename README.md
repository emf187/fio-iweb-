# Fio — Web (PWA)

The companion web app to the [Fio Android planner](https://github.com/emf187/fio).
Same dark-teal identity, same screens, same data — installable on iPhone, iPad
and desktop, and it works offline.

**Live app:** `https://emf187.github.io/fio-iweb-/` (enable GitHub Pages →
Source: GitHub Actions in the repo settings; the included workflow deploys it
automatically on every push to `main`).

## Install on a phone
1. Open the live URL in Safari (iOS) or Chrome (Android/desktop).
2. iPhone: Share → **Add to Home Screen**. Android/desktop: install prompt in
   the address bar / menu.

## What's inside (≈90% of the Android app)
- **Home** — Life Score ring, today's schedule + classes, habit taps, focus, goals
- **Calendar** — month grid + day events (all Android event types)
- **Timetable** — repeating weekly classes (Mon–Sun)
- **Study** — Wingman AI chat (fresh chat window model, History tab), flashcards + review
- **Tutor** — question → your answer → AI grade with weak-topic tracking
- **Calculator** — scientific, fx-ES layout: SHIFT second functions, Ans, DEG/RAD/GRA, Math/Syntax errors
- **Focus timer** — wall-clock based (survives reloads/backgrounding), scheduled breaks, 1× emergency pause, session history
- **Notes** — folders, tags, markdown rendered (no raw markdown on screen)
- **Gallery** — photos stored on-device (IndexedDB), rename/delete/view
- **Health** — sleep start/wake tracking, manual sleep/nap logs, meals with adjust-timestamp, targets
- **Habits** — multi-tap goals, streaks, editable heatmap, full per-habit stats
- **Progress** — score breakdown (habits/focus/consistency), 7-day series, max-3 featured habit stats, AI weekly review
- **Settings** — profile, AI (Gemini/OpenRouter/any OpenAI-compatible), 9 themes + 6 accents, text size, reduce motion, focus rules, health targets, backup export/import/merge, storage persistence

## Data compatibility with Android
Backups round-trip **exactly**: Settings → Backup exports the same
`version: 4` JSON the Android app's `exportAllToJson` writes (identical keys,
nullable-as-`-1`, enums, `habitStatsSelection`…). Import replaces, Merge keeps
both sides with newest-record-wins — so you can move data Android ⇄ web freely.

Photos are an intentional exception: files stay in device storage (IndexedDB
here, app storage on Android) and are never embedded in backup JSON — only
their metadata travels.

## Honest limits vs the Android app
- No reminders/alarms while the browser is fully closed (web push needs a server)
- No lockdown strikes — the focus timer keeps honest time by timestamp instead
- iOS can evict website storage under pressure — use the backup export regularly
- No haptics

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # typecheck + production build (PWA service worker)
npm run preview  # serve the production build
npm run icons    # regenerate PWA icon PNGs (needs sharp)
```

Deploy base defaults to `/` locally; set `PWA_BASE=/fio-iweb-/` (the included
workflow does this) when building for GitHub Pages.
