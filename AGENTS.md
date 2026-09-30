# AGENTS.md

Guidance for AI coding agents working in this repository. Follow these rules in addition to any user instructions.

## Project Summary

HIIT Timer is a cross-platform High-Intensity Interval Training timer. One platform-agnostic web core (`src/`) is shared by two shells: an Electron 44 desktop app (`electron/`) and Capacitor 7 mobile projects (`capacitor/`). The UI is Chinese; stage names carry English sub-labels.

## Repository Layout

| Path | Purpose |
|---|---|
| `src/` | Shared web core: `index.html`, `styles.css`, `timer.js` (state machine, pure logic), `audio.js` (Web Audio synthesis), `storage.js` (storage adapter), `renderer.js` (UI logic) |
| `electron/` | Desktop shell: `main.js` (window + config IPC), `preload.js` (contextBridge: `timerAPI` / `windowAPI`) |
| `capacitor/` | Mobile shell config (`webDir` → `../src`); native projects are generated locally and gitignored |
| `build/` | App icons (`icon.ico` used by the packager, `icon.png` source for `scripts/generate-icon.ps1`) |
| `design/` | Design mockups; `design/verify*.js` are local-only verification scripts (gitignored) |
| `Makefile` | Unified build entry point for all five platforms |

## Stack & Constraints

- **Electron 44.x** (desktop), **electron-builder 26.x** (packaging), **Capacitor 7** (mobile), **Node.js ≥ 20**.
- Plain HTML + CSS + JavaScript. **Do not introduce a UI framework or a build step** for `src/` — Electron loads the files directly.
- **No audio files**: all cues are synthesized with the Web Audio API; keep it that way.
- **No runtime npm dependencies** for the web core. Desktop-only helper libraries are avoided on purpose (e.g. config persistence uses `fs` + IPC, not `electron-store`).
- Platform compatibility policy: **latest OS versions only** (Windows 11, macOS 14+, Android 14/API 34, iOS 17). Do not add legacy fallbacks.

## Commands

```bash
npm start                    # run the Electron app (dev)
npm run dist:win             # Windows NSIS installer (dist/)
npm run dist:mac             # macOS DMG (must run on macOS)
make <target>                # see Makefile for the 5-platform entry points
cd capacitor && npx cap sync # sync the web core into the native mobile projects
```

Mainland China network: use `--registry=https://registry.npmmirror.com` and set `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` before installing Electron binaries. When packaging inside CI, add `--publish never` (electron-builder otherwise attempts an implicit publish and fails without `GH_TOKEN`).

## Architecture Rules

- Renderer code must never use Node APIs; it goes through `window.timerAPI` / `window.windowAPI` exposed by `electron/preload.js`.
- Config flow: `renderer.js` → `Storage` (`src/storage.js`) → IPC (`config:get` / `config:save`) → `electron/main.js` → `userData/config.json`. When adding a config field, update `DEFAULT_CONFIG` in `electron/main.js`, the field list in `src/renderer.js`, and the default values in `src/index.html` together.
- `src/timer.js` is a self-contained state machine with no DOM access. UI reactivity lives in `src/renderer.js` only.
- Keep the `src/` core platform-agnostic: no Electron-only or Capacitor-only assumptions.

## Documentation Rules (MUST)

1. **After any change, refresh all three documents in the same change**: `AGENTS.md`, `README.md` (English), and `README.zh-CN.md` (Chinese).
2. The two READMEs must stay **in sync** — same sections, same facts, mirrored language. `README.md` is the default entry; both must link to each other at the top.
3. **Documentation must not embed images.** Describe the UI, flows, and behavior in text instead (the previous screenshots were removed on purpose — privacy and maintenance reasons).
4. Keep version numbers, commands, file paths, and artifact names in the docs accurate; verify them against the code before writing.

## Verification Workflow

Before considering a change complete:

1. Run `npm start` and check the renderer console output for errors (the main process forwards `console-message` events).
2. Walk the full training flow with a short configuration (e.g. warm-up 5 s, work 1 s, rest 1 s, between-sets 2 s, stretch 2 s, 2 sets × 2 reps) and confirm the stage sequence: `warmup → work → rest → … → between_sets → … → stretch → done` (the final set skips `between_sets`).
3. Confirm config persistence: change a value with a stepper, wait for "配置已保存", restart, and check the value is restored.
4. Confirm pause freezes the countdown and resume continues it; stop returns to the configuration view.
5. For packaging changes, build the installer and launch the unpacked app at least once. Never run two builds in the same output directory concurrently (`EBUSY ... app.asar`).
6. Local helper scripts `design/verify-e2e.js` and `design/verify-packaged.js` cover steps 2-4 automatically (they are gitignored; recreate them if missing). `design/verify-packaged.js` attaches over CDP to a running packaged app started with `--remote-debugging-port=9333`.

## Commit & Git Rules

- **Write all commit messages in English** (conventional-commit style: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
- Never commit unless the user explicitly asks.
- Do not commit build output or local state: `dist/`, `node_modules/`, `.trae/`, `capacitor/android/`, `capacitor/ios/`, `design/verify*.js`.
- Keep documentation updates in the same commit as the code change they describe (see Documentation Rules).

## Privacy & Security Rules

- Never commit secrets, tokens, credentials, personal emails, machine names, or absolute local paths (`C:\Users\...`, `/Users/...`). Keep the repo free of environment-specific data.
- Do not add screenshots or images to the documentation (see Documentation Rules).
- Sample commands and paths in docs must be generic (`<repository-url>`, `%APPDATA%`, `~/Library/...`).
- The app stores user data only in the platform-standard locations listed in the READMEs; do not add telemetry, analytics, or network calls without explicit user approval.