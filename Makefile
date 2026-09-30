# HIIT Timer - 跨平台统一构建脚本
# 目标平台：Windows / macOS / Android / iPhone / iPad
# 兼容性策略：各平台仅兼容最新系统版本，不做旧版本降级适配

ifeq ($(OS),Windows_NT)
	NPM := npm.cmd
	PLATFORM := windows
else
	UNAME_S := $(shell uname -s)
	NPM := npm
	ifeq ($(UNAME_S),Darwin)
		PLATFORM := macos
	else
		PLATFORM := unsupported
	endif
endif

.PHONY: build help install install-mobile start \
        dist-windows dist-macos \
        dist-android dist-iphone dist-ipad dist-ios-base \
        dist-desktop clean

help:
	@echo "HIIT Timer 跨平台构建（当前宿主: $(PLATFORM)）"
	@echo "兼容性：仅支持各平台最新系统版本"
	@echo ""
	@echo "开发运行:"
	@echo "  make start              启动 Electron 桌面应用（自动编译 TypeScript）"
	@echo "  make build              仅编译 TypeScript（src/ 与 electron/）"
	@echo "  make install            安装桌面端依赖（Node >=20）"
	@echo "  make install-mobile     安装移动端依赖（Capacitor 7）"
	@echo ""
	@echo "构建部署包:"
	@echo "  make dist-windows       Windows .exe（NSIS，需 Windows 11）"
	@echo "  make dist-macos         macOS .dmg（需 macOS 14+）"
	@echo "  make dist-android       Android .apk（minSdk 34 / targetSdk 35）"
	@echo "  make dist-iphone        iPhone .ipa（iOS 17+，需 macOS+Xcode）"
	@echo "  make dist-ipad          iPad .ipa（iPadOS 17+，需 macOS+Xcode）"
	@echo "  make dist-desktop       当前宿主平台的桌面包"
	@echo ""
	@echo "清理:"
	@echo "  make clean              清理所有构建产物"

install:
	$(NPM) install

install-mobile:
	cd capacitor && $(NPM) install

# TypeScript → JavaScript（原地回写 src/ 与 electron/）
build:
	$(NPM) run build

start:
	$(NPM) start

# === 桌面端：Electron + electron-builder ===
dist-windows:
	$(NPM) run dist:win

dist-macos:
	$(NPM) run dist:mac

dist-desktop:
ifeq ($(PLATFORM),windows)
	$(MAKE) dist-windows
else ifeq ($(PLATFORM),macos)
	$(MAKE) dist-macos
else
	@echo "错误: 当前宿主平台不在支持列表内（仅 Windows 11 / macOS 14+）"
	@exit 1
endif

# === 移动端：Capacitor 7 ===
# 前置：make install-mobile，且已在 capacitor/ 下 cap add android
# Android：minSdk 34 (Android 14) / targetSdk 35 (Android 15)
dist-android:
	@command -v java >/dev/null 2>&1 || { echo "错误: 需要 JDK 17 + Android SDK (API 35)"; exit 1; }
	$(NPM) run build
	cd capacitor && npx cap sync android
	cd capacitor && npx cap build android
	@echo ""
	@echo "APK 产物: capacitor/android/app/build/outputs/apk/release/app-release.apk"

# iPhone 与 iPad 共用同一 iOS Universal 工程，差异仅在 Xcode 部署的设备族
# iOS：deployment target 17.0+
dist-ios-base:
	@if [ "$(PLATFORM)" != "macos" ]; then echo "错误: iOS 构建需要 macOS 14+ + Xcode 16+"; exit 1; fi
	@command -v xcodebuild >/dev/null 2>&1 || { echo "错误: 需要 Xcode 16+"; exit 1; }
	$(NPM) run build
	cd capacitor && npx cap sync ios
	cd capacitor && npx cap build ios
	@echo ""
	@echo "Xcode 工程已生成: capacitor/ios/App"
	@echo "IPA: 需在 Xcode 中 Archive → Export 得到 .ipa"

dist-iphone: dist-ios-base
	@echo "iPhone: Xcode 部署时选择 iPhone 设备族（iOS 17+）"

dist-ipad: dist-ios-base
	@echo "iPad: Xcode 部署时选择 iPad 设备族（iPadOS 17+）"

clean:
	rm -rf dist
	rm -rf capacitor/android/app/build
	rm -rf capacitor/ios/App/build
