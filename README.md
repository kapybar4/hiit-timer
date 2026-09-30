# HIIT 计时器

跨平台高强度间歇训练（HIIT）计时器，支持 **Windows / macOS / Android / iPhone / iPad**，各平台共享同一套 UI 与核心逻辑。源码使用 **TypeScript** 编写并编译为原生 JavaScript。桌面端基于 **Electron 44**，移动端基于 **Capacitor 7**。

> 界面语言为中文；阶段名称同时带有 `WORK` / `REST` 等英文副标签。
>
> **兼容性策略**：各平台仅兼容最新系统版本，不做旧版本降级适配，以降低维护与测试成本。

## 项目概述

HIIT 计时器通过音效引导你完成一整套间歇训练流程：**热身 → [锻炼 ⇄ 休息] × 次数 × 组数 → 组间间隔 → … → 拉伸 → 完成**。所有时间参数只需配置一次并本地持久化，之后开箱即用。

| | |
|---|---|
| 桌面端运行时 | Electron 44（`electron` 44.x、`electron-builder` 26.x） |
| 移动端运行时 | Capacitor 7（Android / iOS / iPadOS），复用同一套 `src/` Web 核心 |
| 开发语言 | TypeScript 7，仅由 `tsc` 编译——不引入框架，也不引入打包器 |
| UI | 原生 HTML + CSS + JavaScript（由 TypeScript 编译产出） |
| 音效 | Web Audio API 运行时合成（5 种可区分音色，无音频文件） |
| 存储 | Electron `userData` 目录下的本地 JSON / 移动端原生 KV / 浏览器 `localStorage` |

## 界面说明

桌面端为单个 440 × 820 无边框窗口，带自定义标题栏（拖拽区 + 最小化 / 最大化 / 关闭按钮），两个视图共用同一套暗色主题：

**配置视图**

- 顶部：`HIIT` 字标与副标题「高强度间歇训练」。
- 「时间配置 · 秒」卡片：热身、单次锻炼、单次休息、组间间隔、拉伸五行，每行由 `−` / `+` 步进按钮与中间当前数值组成。
- 「训练结构」卡片：组数、每组次数两行步进器。
- 底部：「配置已保存」临时提示（自动保存反馈）与整宽「开始训练」按钮。

**训练视图**

- 窗口顶部为随阶段变色的强调条，下方以大字显示当前阶段名（热身 / 锻炼 / 休息 / 组间间隔 / 拉伸 / 完成）。
- 组次进度行（如「组 1 / 4 · 次 1 / 8」）与一排随完成次数点亮的进度点。
- 280px 环形进度条围绕超大倒计时数字（秒，不足两位补零），数字下方是英文副标签（WARM UP / WORK / REST / BREAK / STRETCH / DONE）。
- 底部操作：暂停 / 继续、停止；进入完成态后倒计时区域显示对勾，仅保留「返回配置」按钮。

阶段色彩编码：热身 / 拉伸为琥珀色、锻炼为绿色、休息为蓝色、组间间隔为紫色、完成为金色，每个阶段还配有独立音效。

## 功能说明

- **完整阶段流程**：热身 → [锻炼 ⇄ 休息] × N 次 × M 组 → 组间间隔 → … → 拉伸 → 完成（最后一组结束后直接进入拉伸，不再进入组间间隔）。
- **各阶段独立音效**，由 Web Audio API 程序生成，5 种音色清晰可辨，零音频资源：
  - 热身 / 拉伸开始：523 Hz 长鸣（1.2 s）
  - 锻炼开始：880 Hz 双短鸣
  - 休息开始：440 Hz 单短鸣
  - 组间间隔开始：440 → 660 Hz 渐变
  - 流程结束：三连升调（523 → 659 → 784 Hz）
- **本地持久化**：仅保存一份配置，每次步进调整后 debounce 自动保存，重启后无需重新配置。
- **专用界面设计**：阶段色彩编码、超大倒计时、环形进度条、组次进度点、无边框自定义标题栏与窗口控制。
- **随时暂停 / 继续 / 停止**；计时器状态机为纯逻辑实现，不依赖 DOM。
- **全量类型覆盖**：全部代码以 TypeScript 在 `strict` 下编写，跨进程的配置契约在 `types/contract.d.ts` 中统一定义一次。

## 环境要求

| 目标平台 | 要求 |
|---|---|
| Windows 桌面 | Windows 11、Node.js ≥ 20 |
| macOS 桌面 | macOS 14 (Sonoma) 及以上、Node.js ≥ 20 |
| Android | Android 14 (API 34) 及以上、JDK 17、Android SDK（API 35） |
| iPhone / iPad | iOS / iPadOS 17 及以上、macOS 14+ 与 Xcode 16+、CocoaPods |

## 安装指南

```bash
git clone <仓库地址>
cd Timer

# 桌面端依赖（Electron 44 + electron-builder 26 + TypeScript 7）
npm install

# 移动端依赖（Capacitor 7）——仅 Android / iOS 需要
cd capacitor && npm install && cd ..
```

> **国内网络环境**：两个镜像均已固化在仓库中——`.npmrc` 固定 npm registry，`package.json` 的 `build.electronDownload` 固定 Electron 二进制镜像，因此 `npm install` 与打包都无需额外配置。

移动端首次初始化（生成原生工程）：

```bash
cd capacitor
npx cap add android   # 之后在 android/build.gradle 确认 minSdkVersion 34 / targetSdkVersion 35
npx cap add ios       # 之后在 ios/App/Podfile 确认 platform :ios, '17.0'
```

## 开发说明

`.ts` 是源码，与它同名的 `.js` 是编译产物且已加入 `.gitignore`。`src/index.html` 与 `capacitor.config.json` 都引用编译后的 `.js` 文件名，因此产物必须与源码同目录——`tsconfig` 已按此配置。

```bash
npm run build       # 就地编译 src/ 与 electron/
npm run typecheck   # 仅类型检查（--noEmit），两个工程都跑
npm start           # 先编译，再启动 Electron 应用
```

`npm start` 与所有 `dist:*` 目标都会先编译，因此通常无需手动执行 `npm run build`。Web 核心（`src/`）刻意保持**经典脚本**形态——Electron 通过 `file://` 加载 `index.html`，而 Chromium 在 `file://` 下会拦截 ES Module——因此这些文件通过全局作用域而非 `import` / `export` 共享状态。

## 使用方法

1. **启动**：`npm start`（或 `make start`），该命令会先编译 TypeScript。
2. **配置**：用 `−` / `+` 步进按钮调整各参数，除「组数」「每组次数」外均为秒数；修改后自动保存（界面出现「配置已保存」提示）。
3. **开始训练**：点击 **开始训练**，应用播放热身提示音并依次走完整个流程，每个阶段都有独立音效提示。
4. **过程控制**：**暂停 / 继续** 冻结并恢复倒计时；**停止** 返回配置视图。
5. **窗口操作**：拖动自定义标题栏移动窗口，右上角按钮可最小化 / 最大化 / 关闭。

默认配置：

| 参数 | 默认值 | 单位 |
|---|---|---|
| 热身 | 60 | 秒 |
| 单次锻炼 | 20 | 秒 |
| 单次休息 | 10 | 秒 |
| 组间间隔 | 30 | 秒 |
| 拉伸 | 90 | 秒 |
| 组数 | 4 | — |
| 每组次数 | 8 | — |

## 构建部署包

```bash
make start           # 开发运行（桌面）
make build           # 仅编译 TypeScript
make dist-windows    # Windows .exe（NSIS 安装包，需 Windows 11）
make dist-macos      # macOS .dmg（须在 macOS 14+ 上执行）
make dist-android    # Android .apk（minSdk 34 / targetSdk 35）
make dist-iphone     # iPhone（须在 macOS + Xcode 环境执行）
make dist-ipad       # iPad（须在 macOS + Xcode 环境执行）
make dist-desktop    # 当前宿主平台对应的桌面包
make clean           # 清理构建产物
```

> **Windows 用户**：需先安装 `make`（可通过 Git Bash 或 `choco install make`）。

| 平台 | 产物 |
|---|---|
| Windows | `dist/HIIT-Timer-1.0.0-setup.exe` |
| macOS | `dist/HIIT-Timer-1.0.0-mac.dmg` |
| Android | `capacitor/android/app/build/outputs/apk/release/app-release.apk` |
| iPhone / iPad | Xcode Archive → Export `.ipa` |

## 常见问题解答

**配置保存在哪里？如何重置？**
桌面端保存为 Electron `userData` 目录下的单个 JSON 文件：
- Windows：`%APPDATA%\hiit-timer\config.json`
- macOS：`~/Library/Application Support/hiit-timer/config.json`

删除该文件（或手动改回默认值）即可恢复默认配置。文件中未知或新增字段会自动回退到默认值，因此版本升级后依然兼容。

**我改了 `.ts` 文件，但应用行为没变化？**
`.js` 是编译产物。请执行 `npm run build`，或直接使用 `npm start` / `make start`（二者都会先编译）。不要手工编辑生成的 `.js`，下一次构建会覆盖它。

**没有声音怎么办？**
音频上下文由首次点击「开始训练」时初始化（浏览器自动播放策略限制），请务必从界面启动训练；同时检查系统音量与输出设备。应用不附带任何音频文件，所有提示音均为实时合成，因此不存在资源缺失问题。

**每次都要重新填写配置吗？**
不需要。每次步进调整后都会自动保存，启动时自动加载上一次的配置。

**为什么只支持各平台最新系统版本？**
这是刻意的取舍：兼容旧系统会成倍放大测试矩阵与维护成本，而收益有限。具体要求见上方环境要求表格。

**可以在 Windows 上构建 macOS 包（或反向）吗？**
不可以。`.dmg` 必须在 macOS 上构建，iOS 部分同样依赖 macOS + Xcode；Windows 上可构建 Windows NSIS 安装包，各移动平台需使用对应工具链构建。

**Windows 打包报 `EBUSY: resource busy or locked ... app.asar` 怎么办？**
说明输出目录被其他进程占用：通常是应用或打包进程仍在运行，或同一目录下有第二个构建在并发执行。请关闭正在运行的实例与并发构建，清理输出目录后重试。

**应用需要联网吗？**
不需要。界面、计时逻辑、音效合成与配置存储全部在本地完成。

## 项目结构

```
src/                  # 共享 Web 核心（平台无关，Electron 与 Capacitor 共用）
├─ index.html         # UI 结构
├─ styles.css         # v2 设计系统（暗色主题 / 阶段色彩 / 超大倒计时）
├─ globals.d.ts       # Web 核心全局声明 + 宿主注入的桥接对象
├─ timer.ts           # 计时器状态机（纯逻辑，无 DOM 依赖）
├─ audio.ts           # Web Audio 音效合成（无音频文件依赖）
├─ storage.ts         # 跨平台存储适配层（导出 ConfigStore）
└─ renderer.ts        # UI 交互逻辑

electron/             # 桌面壳（Electron 44）
├─ main.ts            # 主进程：窗口创建 + 配置 IPC（userData/config.json）
└─ preload.ts         # contextBridge 暴露 timerAPI / windowAPI

types/                # contract.d.ts —— 两个 TS 工程共享的类型契约
tsconfig.json         # Web 核心工程（DOM 类型库，产物就地生成）
tsconfig.electron.json# Electron 宿主工程（Node 类型，产物就地生成）
capacitor/            # 移动壳（Capacitor 7，webDir → ../src）
Makefile              # 统一构建入口（5 个平台）
AGENTS.md             # AI 编码代理指南（文档 / 验证 / 提交规范）
```

编译出的 `.js` 与同名 `.ts` 位于同一目录，且已加入 `.gitignore`。

## 许可证

[MIT](LICENSE)