# iOS App Assets and Version Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Expo iOS 客户端配置 MVP app icon、splash、version 和 build number。

**Architecture:** 使用本地生成的免费 PNG 资产，放在 `apps/mobile/assets`。`app.json` 同时配置 legacy `splash` 和 `expo-splash-screen` plugin，确保 Expo SDK 52 standalone/TestFlight 构建读取一致。

**Tech Stack:** Expo SDK 52, app.json, PNG assets, pnpm mobile verification.

---

## File Structure

```text
apps/mobile/assets/icon.png
apps/mobile/assets/splash-icon.png
apps/mobile/assets/adaptive-icon.png
apps/mobile/app.json
docs/runbooks/testflight-build.md
docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md
docs/superpowers/plans/2026-05-03-ios-app-assets-version-plan.md
docs/superpowers/records/feature-log.md
```

## Task 1: Generate free MVP image assets

**Files:**
- Create: `apps/mobile/assets/icon.png`
- Create: `apps/mobile/assets/splash-icon.png`
- Create: `apps/mobile/assets/adaptive-icon.png`

- [ ] **Step 1: Generate PNG assets**

Use a local Node script to generate three 1024 x 1024 PNG files with a terminal-window mark:

```bash
node --input-type=module <<'EOF'
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

mkdirSync("apps/mobile/assets", { recursive: true });

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function writePng(path, draw) {
  const width = 1024;
  const height = 1024;
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      const [r, g, b, a] = draw(x, y);
      pixels[offset] = r;
      pixels[offset + 1] = g;
      pixels[offset + 2] = b;
      pixels[offset + 3] = a;
    }
  }
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    pixels.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  writeFileSync(path, Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]));
}

function roundedRect(x, y, left, top, right, bottom, radius) {
  const cx = x < left + radius ? left + radius : x > right - radius ? right - radius : x;
  const cy = y < top + radius ? top + radius : y > bottom - radius ? bottom - radius : y;
  return x >= left && x <= right && y >= top && y <= bottom && (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function assetDraw(x, y) {
  const bg = [16, 18, 20, 255];
  const green = [37, 211, 102, 255];
  const blue = [42, 107, 224, 255];
  const ink = [236, 241, 245, 255];
  const panel = [31, 35, 39, 255];
  const shadow = [8, 10, 12, 255];

  if (roundedRect(x, y, 188, 272, 836, 744, 64)) return shadow;
  if (roundedRect(x, y, 168, 248, 816, 720, 64)) return panel;
  if (roundedRect(x, y, 168, 248, 816, 344, 64)) return blue;
  if (roundedRect(x, y, 244, 284, 292, 332, 24)) return [255, 255, 255, 230];
  if (roundedRect(x, y, 320, 284, 368, 332, 24)) return [255, 255, 255, 180];
  if (roundedRect(x, y, 396, 284, 444, 332, 24)) return [255, 255, 255, 140];
  if (x >= 272 && x <= 400 && y >= 470 && y <= 526 && x - 272 > Math.abs(y - 498) * 1.8) return green;
  if (x >= 452 && x <= 674 && y >= 562 && y <= 614) return ink;
  if (x >= 452 && x <= 596 && y >= 622 && y <= 674) return green;
  return bg;
}

writePng("apps/mobile/assets/icon.png", assetDraw);
writePng("apps/mobile/assets/splash-icon.png", assetDraw);
writePng("apps/mobile/assets/adaptive-icon.png", assetDraw);
EOF
```

- [ ] **Step 2: Verify files exist**

```bash
file apps/mobile/assets/icon.png apps/mobile/assets/splash-icon.png apps/mobile/assets/adaptive-icon.png
```

Expected: each file reports `PNG image data, 1024 x 1024`.

## Task 2: Update Expo app config

**Files:**
- Modify: `apps/mobile/app.json`

- [ ] **Step 1: Update app.json**

Set:

```json
"version": "0.1.0",
"icon": "./assets/icon.png",
"splash": {
  "image": "./assets/splash-icon.png",
  "resizeMode": "contain",
  "backgroundColor": "#101214"
},
"ios": {
  "bundleIdentifier": "com.terminalfirst.remote",
  "buildNumber": "2",
  "supportsTablet": false
},
"android": {
  "adaptiveIcon": {
    "foregroundImage": "./assets/adaptive-icon.png",
    "backgroundColor": "#101214"
  }
},
"plugins": [
  "expo-secure-store",
  [
    "expo-splash-screen",
    {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#101214"
    }
  ]
]
```

- [ ] **Step 2: Verify Expo public config**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile exec expo config --type public
```

Expected: output includes `icon`, `splash`, `version`, `ios.buildNumber`, and `expo-splash-screen`.

## Task 3: Update TestFlight runbook and records

**Files:**
- Modify: `docs/runbooks/testflight-build.md`
- Modify: `docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md`
- Modify: `docs/superpowers/plans/2026-05-03-ios-app-assets-version-plan.md`
- Modify: `docs/superpowers/records/feature-log.md`

- [ ] **Step 1: Update TestFlight runbook**

Add rules:

- `expo.version` changes when users should see a new app version.
- `ios.buildNumber` must increase for every App Store Connect upload.
- icon/splash files live in `apps/mobile/assets`.
- after asset changes, reinstall app because launch screens can be cached.

- [ ] **Step 2: Run verification**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile build
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/mobile exec expo config --type public
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

- [ ] **Step 3: Commit implementation**

```bash
git add apps/mobile/app.json apps/mobile/assets docs/runbooks/testflight-build.md
git commit -m "chore: add ios app assets and version config"
```

- [ ] **Step 4: Mark plan and log delivery**

Mark this plan and Task 12 remaining item complete. Append feature log with commits and verification.

- [ ] **Step 5: Commit records**

```bash
git add docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md docs/superpowers/plans/2026-05-03-ios-app-assets-version-plan.md docs/superpowers/records/feature-log.md
git commit -m "docs: record ios app assets version delivery"
```

## Self-Review

- Spec coverage: 覆盖 icon、splash、version、build number、runbook 和验证。
- Placeholder scan: 没有 TBD/TODO。
- Type consistency: asset paths and app.json fields match.
