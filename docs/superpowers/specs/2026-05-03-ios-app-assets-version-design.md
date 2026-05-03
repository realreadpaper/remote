# iOS App Assets and Version Design

## 背景

Task 12 的 EAS TestFlight 配置已经完成 bundle identifier、build profile、server URL 环境变量和 TestFlight runbook，但还缺 app icon、splash、version/build number 的完整配置。没有这些资产，TestFlight 包会继续使用默认视觉资产，不适合安装给真实测试用户。

Expo SDK 52 起推荐使用 `expo-splash-screen` config plugin 配置启动页；`expo.version` 是用户可见版本号，`expo.ios.buildNumber` 是 iOS build number。当前项目已经是 Expo SDK 52，应该按这个方向配置。

## 目标

- 新增免费、本地生成的 app icon 和 splash image。
- `apps/mobile/app.json` 指向 icon 和 splash asset。
- `expo.version` 明确为 `0.1.0`。
- `expo.ios.buildNumber` 明确为 `"2"`，避免下一次 TestFlight 与已提交 build number 冲突。
- 加入 `expo-splash-screen` config plugin，并设置 background color、image、resize mode。
- `docs/runbooks/testflight-build.md` 写明 version/build number 更新规则。
- 保持 `pnpm --filter @remote/mobile test/typecheck/build` 和 `expo config` 可通过。

## 非目标

- 不做品牌最终视觉系统。
- 不接入付费设计资产。
- 不做多语言 App Store 元数据。
- 不提交真实 App Store Connect 构建。

## 视觉方案

采用“终端优先”的免费矢量生成风格：

- 背景：近黑色，表达 terminal/运维工具。
- 图形：圆角终端窗口和绿色 prompt。
- 文案：不在 icon 中放小字，避免 iOS icon 缩小时不可读。
- Splash：同一终端图形，背景纯色，启动时识别稳定。

资产由仓库内脚本生成 PNG，不依赖外部设计工具：

- `apps/mobile/assets/icon.png`：1024 x 1024。
- `apps/mobile/assets/splash-icon.png`：1024 x 1024，可被 splash plugin contain 居中使用。
- `apps/mobile/assets/adaptive-icon.png`：1024 x 1024，为 Android 预留。

## Expo 配置

`app.json` 更新：

```json
{
  "expo": {
    "version": "0.1.0",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#101214"
    },
    "ios": {
      "buildNumber": "2"
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
  }
}
```

保留 legacy `splash` 字段用于兼容，新增 config plugin 用于 SDK 52+。

## 验证

- `pnpm --filter @remote/mobile test`
- `pnpm --filter @remote/mobile typecheck`
- `pnpm --filter @remote/mobile build`
- `pnpm --filter @remote/mobile exec expo config --type public`

检查输出包含：

- `icon: "./assets/icon.png"`
- `version: "0.1.0"`
- `ios.buildNumber: "2"`
- `expo-splash-screen` plugin。

## 已知风险

- iOS launch screen 在模拟器和真机上可能被系统缓存；换图后需要重新安装 app。
- Expo Go 不能完整代表 standalone/TestFlight 的启动页效果。
- 资产是 MVP 临时品牌，不是最终 App Store 设计。

## 自检

- Placeholder scan: 没有 TBD/TODO。
- Scope check: 只覆盖 Task 12 资产和版本配置。
- Consistency: 资产路径和 app.json 配置一致。
