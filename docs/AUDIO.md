# 音效

配套：[AGENTS.md](../AGENTS.md) · [ENGINEERING.md](./ENGINEERING.md)

旧合成玩法已删除。下文事件表（slide/merge 等）是音效管道遗留，新玩法接 `AudioManager` 时再改目录。

桌面 **WebAudio**；iOS **`plugins/native-audio/`**（AVAudioEngine）。热路径禁止 `new Audio()`、禁止每发一次桥、iOS 生产禁止 WebAudio。

iOS session：`.ambient` + `.mixWithOthers`（与后台音乐共存）。**不要** `.duckOthers`，否则一进游戏就把其他 App 音量压低。静音拨片仍会静音本游戏效。

---

## 0. 现状

管道还在：两套样本 `public/sfx/v2/`、`public/sfx/v3/`，`AudioCatalog` 事件名仍是旧合成游戏的 slide/merge/nudge。**没有设置面板，没有玩法在播。** 新玩法接上时改目录和事件名。

`localStorage` 键名仍是遗留的 `swipe2048.sfx.pack`。

业务调 `audio.playSfx`（`AudioManager`），不碰后端。

---

## 1. 卡顿从哪来

- 热路径 `new Audio()` / 读盘 / `decodeAudioData`
- 每发一次 Capacitor 桥
- iOS 上 WebAudio 和 WKWebView 抢 `AVAudioSession`

正确：**Loading 预解码 + 微任务攒一次 flush + 原生 PlayerNode 池**。

## 2. 分层

| 层 | 路径 |
|----|------|
| 业务 | 玩法层（尚未接入；调 `audio.playSfx`） |
| 门面 | `src/audio/AudioManager.ts` |
| 目录 | `src/audio/AudioCatalog.ts` |
| 批处理 | `src/audio/AudioBatcher.ts`（微任务，有单测） |
| Web | `src/audio/WebBackend.ts` |
| iOS JS | `src/audio/IosBackend.ts` |
| 原生 | `plugins/native-audio/` → `ios:bootstrap` |
| 资源 | `public/sfx/v2/` · `public/sfx/v3/` |

改 Swift 走 `ios:bootstrap`，不要手改 pbxproj。

## 3. 流水线

```
audio.playSfx(...)
  → 关音 / 未 ready 则排队
  → AudioBatcher（同 key 本拍一条；合挤掉滑）
  → 微任务 flush（绘制前）
  → iOS NativeAudio.flushSfx | Web BufferSource.start
```

`main.ts`：`audio.preload()` + 首次 pointer `unlock()`。

## 4. 验收

玩法未接，没有切套装 / 预听 / 合成台阶可验。真机音频插件与震动一样要 `BridgeViewController`；iOS 生产不要用 WebAudio。
