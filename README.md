# HIIT Timer

English | [简体中文](README.zh-CN.md)

A cross-platform High-Intensity Interval Training (HIIT) timer for **Windows / macOS / Android / iPhone / iPad**, sharing a single UI and core logic across all platforms. Written in **TypeScript**, compiled to plain JavaScript. Built with **Electron 44** on desktop and **Capacitor 7** on mobile.

> The app UI is in Chinese; stage names carry English sub-labels such as `WORK` / `REST`.
>
> **Compatibility policy**: each platform only supports its latest OS version. No legacy fallbacks, to keep maintenance and testing cost low.

## Overview

HIIT Timer guides you through a complete interval-training session with sound cues: **Warm-up → [Work ⇄ Rest] × reps × sets → Between-sets break → Stretch → Done**. All timing parameters are configured once and persisted locally, so the app is ready to use on every launch.

| | |
|---|---|
| Desktop runtime | Electron 44 (`electron` 44.x, `electron-builder` 26.x) |
| Mobile runtime | Capacitor 7 (Android / iOS / iPadOS), reusing the same `src/` web core |
| Language | TypeScript 7, compiled by `tsc` alone — no framework, no bundler |
| UI | Plain HTML + CSS + JavaScript (emitted from TypeScript) |
| Sound | Web Audio API, synthesized at runtime (5 distinct timbres, no audio files) |
| Storage | Local JSON in the Electron `userData` directory / native KV on mobile / `localStorage` in the browser |

## Interface

The desktop app is a single 440 × 820 frameless window with a custom title bar (drag area plus minimize / maximize / close buttons) and two views that share one dark theme:

**Configuration view**

- Header: the "HIIT" wordmark with the subtitle "高强度间歇训练".
- Card "时间配置 · 秒" (times, in seconds): five stepper rows — warm-up, work, rest, between-sets, stretch — each with `−` / `+` buttons and the current value in between.
- Card "训练结构" (structure): stepper rows for sets and reps per set.
- A transient "配置已保存" (configuration saved) hint, plus a full-width "开始训练" (start training) button.

**Training view**

- A stage-colored accent bar across the top of the window and the stage name in large type (热身 / 锻炼 / 休息 / 组间间隔 / 拉伸 / 完成).
- A set/rep progress line (e.g. "组 1 / 4 · 次 1 / 8") and a row of rep dots that fill as reps complete.
- A 280 px circular progress ring around an oversized countdown (seconds, zero-padded), with an English sub-label (WARM UP / WORK / REST / BREAK / STRETCH / DONE) below the number.
- Bottom actions: 暂停 / 继续 (pause / resume) and 停止 (stop). In the done state the countdown area shows a check mark and the only action is 返回配置 (back to configuration).

Stage color coding: warm-up / stretch amber, work green, rest blue, between-sets violet, done gold — each stage also has its own sound cue.

## Features

- **Full stage flow**: Warm-up → [Work ⇄ Rest] × N reps × M sets → Between-sets break → … → Stretch → Done (the last set goes straight to stretch, skipping the break).
- **Distinct sound per stage**, synthesized with the Web Audio API — 5 clearly distinguishable cues, zero audio assets:
  - Warm-up / Stretch start: 523 Hz long beep (1.2 s)
  - Work start: 880 Hz double short beep
  - Rest start: 440 Hz single short beep
  - Between-sets start: 440 → 660 Hz pitch slide
  - Done: three ascending notes (523 → 659 → 784 Hz)
- **Local persistence**: one configuration, auto-saved (debounced) after every stepper adjustment; no re-configuring after restart.
- **Purpose-built UI**: stage color coding, oversized countdown, circular progress ring, set/rep progress dots, custom frameless title bar with window controls.
- **Pause / resume / stop** at any time; the timer state machine is pure logic with zero DOM dependency.
- **Fully typed**: the whole codebase is TypeScript under `strict`, with the cross-process config contract defined once in `types/contract.d.ts`.

## Requirements

| Target | Requirements |
|---|---|
| Windows desktop | Windows 11, Node.js ≥ 20 |
| macOS desktop | macOS 14 (Sonoma) or later, Node.js ≥ 20 |
| Android | Android 14 (API 34) or later, JDK 17, Android SDK (API 35) |
| iPhone / iPad | iOS / iPadOS 17 or later, macOS 14+ with Xcode 16+, CocoaPods |

## Installation

```bash
git clone <repository-url>
cd Timer

# Desktop dependencies (Electron 44 + electron-builder 26 + TypeScript 7)
npm install

# Mobile dependencies (Capacitor 7) — only needed for Android / iOS
cd capacitor && npm install && cd ..
```

> **Mainland China network**: both mirrors are already pinned in this repository — `.npmrc` for the npm registry and `build.electronDownload` in `package.json` for the Electron binary — so `npm install` and packaging need no extra setup.

First-time mobile setup (generates the native projects):

```bash
cd capacitor
npx cap add android   # then verify minSdkVersion 34 / targetSdkVersion 35 in android/build.gradle
npx cap add ios       # then verify platform :ios, '17.0' in ios/App/Podfile
```

## Development

The `.ts` files are the sources; the `.js` files next to them are build output and are gitignored. `src/index.html` and `capacitor.config.json` reference the emitted `.js` names, so the compiled files must always sit next to their sources — `tsc` is configured to do that.

```bash
npm run build       # compile src/ and electron/ in place
npm run typecheck   # type-check only (--noEmit), both projects
npm start           # build, then launch the Electron app
```

`npm start` and every `dist:*` target compile first, so you rarely need to run `npm run build` by hand. The web core (`src/`) deliberately stays on **classic scripts** — Electron loads `index.html` over `file://`, where Chromium blocks ES modules — so the files share state through the global scope rather than `import`/`export`.

## Usage

1. **Launch**: `npm start` (or `make start`) — this compiles the TypeScript first.
2. **Configure**: adjust each parameter with the `−` / `+` steppers. All values are seconds except *Sets* and *Reps per set*. Changes are saved automatically (a "配置已保存" hint appears).
3. **Train**: click **开始训练**. The app plays the warm-up cue and walks through the whole flow, announcing each stage with its own sound.
4. **Control**: **暂停 / 继续** freezes and resumes the countdown; **停止** returns to the configuration view.
5. **Window**: drag the custom title bar to move the window; use the top-right buttons to minimize / maximize / close.

Default configuration:

| Parameter | Default | Unit |
|---|---|---|
| Warm-up | 60 | s |
| Work | 20 | s |
| Rest | 10 | s |
| Between sets | 30 | s |
| Stretch | 90 | s |
| Sets | 4 | — |
| Reps per set | 8 | — |

## Building Distribution Packages

```bash
make start           # development run (desktop)
make build           # compile TypeScript only
make dist-windows    # Windows .exe (NSIS installer, requires Windows 11)
make dist-macos      # macOS .dmg (must build on macOS 14+)
make dist-android    # Android .apk (minSdk 34 / targetSdk 35)
make dist-iphone     # iPhone (requires macOS + Xcode)
make dist-ipad       # iPad (requires macOS + Xcode)
make dist-desktop    # desktop package for the current host platform
make clean           # remove build artifacts
```

> Windows users need `make` (via Git Bash or `choco install make`).

| Platform | Artifact |
|---|---|
| Windows | `dist/HIIT-Timer-1.0.0-setup.exe` |
| macOS | `dist/HIIT-Timer-1.0.0-mac.dmg` |
| Android | `capacitor/android/app/build/outputs/apk/release/app-release.apk` |
| iPhone / iPad | Xcode Archive → Export `.ipa` |

## FAQ

**Where is my configuration stored? How do I reset it?**
On desktop it is a single JSON file in the Electron `userData` directory:
- Windows: `%APPDATA%\hiit-timer\config.json`
- macOS: `~/Library/Application Support/hiit-timer/config.json`

Delete the file (or set the values back manually) to restore the defaults. Unknown or newly added fields fall back to defaults automatically, so the file stays forward-compatible.

**I edited a `.ts` file but the app did not change.**
The `.js` files are compiled output. Run `npm run build`, or just use `npm start` / `make start`, which compile first. Never edit the generated `.js` by hand — the next build overwrites it.

**The timer is silent. What should I check?**
The audio context is initialized by the first click on **开始训练** (browser autoplay policy), so make sure you start the session from the UI. Also check the system volume and the selected output device. No audio files are shipped — all cues are synthesized, so a muted system or a deleted asset cannot be the cause.

**Do I need to re-enter the configuration every time?**
No. Adjustments are saved (debounced) after every stepper click, and the last configuration is loaded at startup.

**Why are only the latest OS versions supported?**
This is a deliberate policy: supporting legacy systems multiplies the testing matrix and maintenance cost while adding little value. See the requirements table above.

**Can I build the macOS package on Windows (or vice versa)?**
No. The `.dmg` must be built on macOS, and the iOS/Xcode part requires macOS with Xcode. On Windows you can build the Windows NSIS installer; the same is true for the mobile targets on their respective toolchains.

**Packaging fails with `EBUSY: resource busy or locked ... app.asar` on Windows.**
Another process is holding the output directory — usually a running instance of the app/packager, or a second build running concurrently in the same folder. Close running instances, make sure only one build runs at a time, then clean the output directory and retry.

**Does the app need a network connection?**
No. Everything — UI, timer logic, sound synthesis, configuration — is local.

## Project Structure

```
src/                  # Shared web core (platform-agnostic, used by Electron & Capacitor)
├─ index.html         # UI structure
├─ styles.css         # v2 design system (dark theme / stage colors / oversized countdown)
├─ globals.d.ts       # Web-core globals + host-injected bridges
├─ timer.ts           # Timer state machine (pure logic, no DOM dependency)
├─ audio.ts           # Web Audio sound synthesis (no audio files)
├─ storage.ts         # Cross-platform storage adapter (exports ConfigStore)
└─ renderer.ts        # UI interaction logic

electron/             # Desktop shell (Electron 44)
├─ main.ts            # Main process, window creation + config IPC (userData/config.json)
└─ preload.ts         # contextBridge exposing timerAPI / windowAPI

types/                # contract.d.ts — types shared by both TS projects
tsconfig.json         # Web-core project (DOM libs, emits .js in place)
tsconfig.electron.json# Electron-host project (Node types, emits .js in place)
capacitor/            # Mobile shell (Capacitor 7, webDir → ../src)
Makefile              # Unified build entry point (5 platforms)
AGENTS.md             # Guide for AI coding agents (docs/verification/commit rules)
```

Compiled `.js` files appear next to their `.ts` sources and are gitignored.

## License

[MIT](LICENSE)
