# AGENTS.md

Guidance for AI coding agents working in this repository. Follow these rules in addition to any user instructions.

## Project Summary

HIIT Timer is a cross-platform High-Intensity Interval Training timer. One platform-agnostic web core (`src/`) is shared by two shells: an Electron 44 desktop app (`electron/`) and Capacitor 7 mobile projects (`capacitor/`). It is written in **TypeScript**, compiled to plain JavaScript in place. The UI is Chinese; stage names carry English sub-labels.

## Repository Layout

| Path | Purpose |
|---|---|
| `src/` | Shared web core (**sources are `.ts`**): `index.html`, `styles.css`, `timer.ts` (state machine, pure logic), `audio.ts` (Web Audio synthesis), `storage.ts` (storage adapter), `renderer.ts` (UI logic), `globals.d.ts` (globals for the web core) |
| `electron/` | Desktop shell (**`.ts` sources**): `main.ts` (window + config IPC), `preload.ts` (contextBridge: `timerAPI` / `windowAPI`) |
| `types/` | `contract.d.ts` — types shared by both TS projects (`TimerConfig`, `TimerState`, `TimerSnapshot`, `TimerAPI`, `WindowAPI`, `PreferencesPlugin`) |
| `tsconfig.json` | Web core project: DOM libs, `types: []`, `module: preserve`, emits `.js` next to the `.ts` |
| `tsconfig.electron.json` | Electron host project: Node types, `module: nodenext`, emits `.js` next to the `.ts` |
| `capacitor/` | Mobile shell config (`webDir` → `../src`); native projects are generated locally and gitignored |
| `build/` | App icons (`icon.ico` used by the packager, `icon.png` source for `scripts/generate-icon.ps1`) |
| `design/` | Local-only verification scripts (`design/verify*.js`, gitignored). The repository intentionally ships **no design mockups, images, or HTML prototypes** |
| `Makefile` | Unified build entry point for all five platforms |

## Stack & Constraints

- **Electron 44.x** (desktop), **electron-builder 26.x** (packaging), **Capacitor 7** (mobile), **TypeScript 7.x**, **Node.js ≥ 20**.
- Plain HTML + CSS + TypeScript. **Do not introduce a UI framework and do not introduce a bundler** (webpack/vite/rollup/esbuild) for `src/` or `electron/` — `tsc` alone is the whole toolchain and Electron loads the emitted files directly. A bundler would be 10× the complexity for negligible benefit at this size.
- **`src/` must stay classic scripts.** `src/index.html` is loaded by Electron via `file://`, where Chromium blocks ES modules. So `.ts` files in `src/` must contain **no `import`/`export`**; cross-file sharing happens through the global scope plus explicit `window.X = X` assignments. This is not a style preference — switching `src/` to ESM breaks the app at runtime.
- **No audio files**: all cues are synthesized with the Web Audio API; keep it that way.
- **No runtime npm dependencies** for the web core. Desktop-only helper libraries are avoided on purpose (e.g. config persistence uses `fs` + IPC, not `electron-store`).
- Platform compatibility policy: **latest OS versions only** (Windows 11, macOS 14+, Android 14/API 34, iOS 17). Do not add legacy fallbacks.

## TypeScript Rules

1. **`.ts` is the source of truth; `.js` in `src/` and `electron/` is build output** and is gitignored. Never edit an emitted `.js` by hand — the next `npm run build` overwrites it.
2. Build with `npm run build` (or `make build`); check without emitting with `npm run typecheck`. `npm start`, `npm run dist:*`, and the mobile `make dist-*` targets all compile first.
3. **Shared types go in `types/contract.d.ts`**, which both tsconfigs include. When a cross-boundary contract changes (a config field, an IPC payload), change it there once — both sides then fail loudly if they drift.
4. `src/globals.d.ts` declares the host-injected globals (`timerAPI`, `windowAPI`, `Capacitor`) with `declare var` on purpose: it makes TypeScript reject a top-level `const`/`let` of the same name. Such a clash is a runtime `SyntaxError` that silently kills the whole script (`contextBridge` installs non-configurable globals), and `tsc` cannot catch it any other way.
5. `src/` is compiled with `types: []` on purpose: the web core must not be able to see Node globals. If you need Node APIs, the code belongs in `electron/`.
6. `strict` is on in both projects. Keep it that way; do not relax it to silence a single error.
7. `storage.ts` exports **`ConfigStore`**, not `Storage` — a top-level `Storage` binding collides with the DOM lib's `Storage` type.

## Commands

```bash
npm install                  # install desktop dependencies
npm run build                # compile TypeScript (src/ + electron/), in place
npm run typecheck            # type-check only (noEmit), both projects
npm start                    # build, then run the Electron app (dev)
npm run dist:win             # build, then Windows NSIS installer (dist/)
npm run dist:mac             # build, then macOS DMG (must run on macOS)
make <target>                # see Makefile for the 5-platform entry points
cd capacitor && npx cap sync # sync the web core into the native mobile projects
```

Mainland China network: the npm registry is already pinned to npmmirror in `.npmrc`, and the Electron binary mirror in `package.json` (`build.electronDownload.mirror`), so `npm install` and `npm run dist:*` work with no extra setup. Override with `ELECTRON_MIRROR`, or remove those two blocks for a mirror-neutral repo. Without a reachable mirror, electron-builder dies while fetching the Electron zip and the symptom is a **silent stall right after the `• packaging …` log line** with no error message — check this first before suspecting the project configuration. When packaging inside CI, add `--publish never` (electron-builder otherwise attempts an implicit publish and fails without `GH_TOKEN`).

## Architecture Rules

- Renderer code must never use Node APIs; it goes through `window.timerAPI` / `window.windowAPI` exposed by `electron/preload.ts`.
- Config flow: `renderer.ts` → `ConfigStore` (`src/storage.ts`) → IPC (`config:get` / `config:save`) → `electron/main.ts` → `userData/config.json`. The `TimerConfig` shape is defined once in `types/contract.d.ts`; when adding a field, update `DEFAULT_CONFIG` in `electron/main.ts`, the field list in `src/renderer.ts`, and the default values in `src/index.html` together.
- `src/timer.ts` is a self-contained state machine with no DOM access. UI reactivity lives in `src/renderer.ts` only.
- Keep the `src/` core platform-agnostic: no Electron-only or Capacitor-only assumptions.

## Documentation Rules (MUST)

1. **After any change, refresh `AGENTS.md` and `README.md` in the same change.**
2. **`README.md` is the single README and is written in Chinese** — the project's documentation language. Do not add a separate English README or any second language variant.
3. **Documentation must not embed images.** Describe the UI, flows, and behavior in text instead (the previous screenshots were removed on purpose — privacy and maintenance reasons).
4. Keep version numbers, commands, file paths, and artifact names in the docs accurate; verify them against the code before writing.

## Verification Workflow

Before considering a change complete:

1. Run `npm run typecheck` — it must report zero errors in both projects.
2. Run `npm start` and check the renderer console output for errors (the main process forwards `console-message` events). A `SyntaxError` from a top-level name clash, or a throw from `mustGet()`, shows up here and nowhere else.
3. Walk the full training flow with a short configuration (e.g. warm-up 5 s, work 1 s, rest 1 s, between-sets 2 s, stretch 2 s, 2 sets × 2 reps) and confirm the stage sequence: `warmup → work → rest → … → between_sets → … → stretch → done` (the final set skips `between_sets`).
4. Confirm config persistence: change a value with a stepper, wait for "配置已保存", restart, and check the value is restored.
5. Confirm pause freezes the countdown and resume continues it; stop returns to the configuration view.
6. For packaging changes, build the installer and launch the unpacked app at least once. Never run two builds in the same output directory concurrently (`EBUSY ... app.asar`).
7. Local helper scripts `design/verify-e2e.js` and `design/verify-packaged.js` cover steps 3-5 automatically (they are gitignored; recreate them if missing). `design/verify-packaged.js` attaches over CDP to a running packaged app started with `--remote-debugging-port=9333`.

## Commit & Git Rules

- **Write all commit messages in English** (conventional-commit style: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`).
- Never commit unless the user explicitly asks.
- Do not commit build output or local state: `dist/`, `node_modules/`, `.trae/`, `capacitor/android/`, `capacitor/ios/`, `design/verify*.js`, and the emitted `src/**/*.js` / `electron/**/*.js`.
- Keep documentation updates in the same commit as the code change they describe (see Documentation Rules).

## Privacy & Security Rules

- Never commit secrets, tokens, credentials, personal emails, machine names, or absolute local paths (`C:\Users\...`, `/Users/...`). Keep the repo free of environment-specific data.
- Keep the repository free of images, HTML prototypes, and other visual/binary assets. The only image assets are the application icons in `build/`, and `src/index.html` is the app UI itself (inline SVG icons only). Do not add screenshots to the documentation (see Documentation Rules).
- Sample commands and paths in docs must be generic (`<repository-url>`, `%APPDATA%`, `~/Library/...`).
- The app stores user data only in the platform-standard locations listed in the READMEs; do not add telemetry, analytics, or network calls without explicit user approval.
