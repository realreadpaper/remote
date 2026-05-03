# macOS Agent Signing and Notarization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Electron macOS Agent 配置 Developer ID 签名、hardened runtime、公证命令和完整 runbook。

**Architecture:** 保留 Task 10 的开发目录打包 `pack:dir`，新增正式发布命令 `dist:mac`。Electron Builder 读取本机证书和 App Store Connect API Key 环境变量执行签名/公证，仓库只保存配置、entitlements 和操作文档。

**Tech Stack:** Electron Builder, macOS codesign, Apple notarytool/stapler, pnpm workspace.

---

## File Structure

```text
apps/agent-desktop/package.json
apps/agent-desktop/build/entitlements.mac.plist
docs/runbooks/macos-agent-package.md
docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md
docs/superpowers/plans/2026-05-03-macos-agent-signing-notarization-plan.md
docs/superpowers/records/feature-log.md
```

## Task 1: Electron Builder signing config

**Files:**
- Modify: `apps/agent-desktop/package.json`
- Create: `apps/agent-desktop/build/entitlements.mac.plist`

- [ ] **Step 1: Add entitlements file**

Create `apps/agent-desktop/build/entitlements.mac.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
</dict>
</plist>
```

- [ ] **Step 2: Update package scripts**

In `apps/agent-desktop/package.json`, add:

```json
"dist:mac": "pnpm build && electron-builder --mac"
```

Keep:

```json
"pack:dir": "pnpm build && electron-builder --dir --mac"
```

- [ ] **Step 3: Update mac build config**

In `apps/agent-desktop/package.json`, update `build.mac`:

```json
"mac": {
  "category": "public.app-category.developer-tools",
  "target": ["dmg", "zip"],
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "build/entitlements.mac.plist",
  "entitlementsInherit": "build/entitlements.mac.plist",
  "notarize": {
    "teamId": "${APPLE_TEAM_ID}"
  }
}
```

Add top-level:

```json
"afterSign": false
```

Do not commit real identities or secret values.

- [ ] **Step 4: Verify local build config still works without credentials**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent-desktop build
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent-desktop pack:dir
```

Expected: build succeeds; `pack:dir` may sign with local identity if present and skips notarization when credentials are absent.

## Task 2: Signing and notarization runbook

**Files:**
- Modify: `docs/runbooks/macos-agent-package.md`

- [ ] **Step 1: Add certificate section**

Document:

- Apple Developer Program membership.
- Developer ID Application certificate.
- Install certificate into login keychain.
- Verify:

```bash
security find-identity -v -p codesigning
```

- [ ] **Step 2: Add environment variable section**

Document:

```bash
export CSC_NAME="Developer ID Application: <Team Name> (<TEAM_ID>)"
export APPLE_TEAM_ID="<TEAM_ID>"
export APPLE_API_KEY="/absolute/path/AuthKey_<KEY_ID>.p8"
export APPLE_API_KEY_ID="<KEY_ID>"
export APPLE_API_ISSUER="<ISSUER_UUID>"
```

Document that `.p8` files must never be committed.

- [ ] **Step 3: Add release build commands**

Document:

```bash
pnpm --filter @remote/agent-desktop dist:mac
```

and outputs:

- `.dmg`
- `.zip`

- [ ] **Step 4: Add verification commands**

Document:

```bash
codesign --display --verbose=4 "dist/mac-arm64/Terminal First Agent.app"
codesign --verify --deep --strict --verbose=2 "dist/mac-arm64/Terminal First Agent.app"
spctl --assess --type execute --verbose=4 "dist/mac-arm64/Terminal First Agent.app"
xcrun stapler validate "dist/mac-arm64/Terminal First Agent.app"
```

- [ ] **Step 5: Add troubleshooting**

Cover:

- missing Developer ID identity.
- API key path wrong.
- wrong issuer/team.
- native module signing failure.
- notarization timeout or rejected binary.
- Gatekeeper still blocks app.

## Task 3: Verification and delivery record

**Files:**
- Modify: `docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md`
- Modify: `docs/superpowers/plans/2026-05-03-macos-agent-signing-notarization-plan.md`
- Modify: `docs/superpowers/records/feature-log.md`

- [ ] **Step 1: Run verification**

```bash
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent-desktop build
PATH="/tmp/codex-corepack-shims:$PATH" pnpm --filter @remote/agent-desktop pack:dir
PATH="/tmp/codex-corepack-shims:$PATH" pnpm test
PATH="/tmp/codex-corepack-shims:$PATH" pnpm typecheck
PATH="/tmp/codex-corepack-shims:$PATH" pnpm build
```

- [ ] **Step 2: Commit implementation**

```bash
git add apps/agent-desktop/package.json apps/agent-desktop/build/entitlements.mac.plist docs/runbooks/macos-agent-package.md
git commit -m "docs: add macos signing and notarization runbook"
```

- [ ] **Step 3: Mark plan steps complete**

Mark this plan and Task 11 in `2026-05-02-ios-mac-installable-mvp-plan.md` complete.

- [ ] **Step 4: Record feature log**

Append feature log with:

- design commit.
- plan commit.
- implementation commit.
- verification commands.
- explicit note that true notarization was not executed because credentials are absent.

- [ ] **Step 5: Commit record**

```bash
git add docs/superpowers/plans/2026-05-02-ios-mac-installable-mvp-plan.md docs/superpowers/plans/2026-05-03-macos-agent-signing-notarization-plan.md docs/superpowers/records/feature-log.md
git commit -m "docs: record macos signing notarization delivery"
```

## Self-Review

- Spec coverage: 覆盖 bundle id、hardened runtime、Developer ID Application、notarization 命令、证书环境变量、验证和常见失败原因。
- Placeholder scan: 没有 TBD/TODO。
- Type consistency: `dist:mac`、`pack:dir`、`APPLE_*`、`CSC_NAME` 命名一致。
