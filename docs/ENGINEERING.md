# Engineering — portrait-webgpu-base

配套：[AGENTS.md](../AGENTS.md) · [README.md](./README.md) · [ICE-PUZZLE.md](./ICE-PUZZLE.md) · [VISUAL.md](./VISUAL.md) · [ENTRYPOINTS.md](./ENTRYPOINTS.md) · [MERGE.md](./MERGE.md) · [AUDIO.md](./AUDIO.md) · [HAPTICS.md](./HAPTICS.md)

## 1. 定位

可复制的 **竖屏 WebGPU 手游底座**：能 dev、能 build、能真机、能震动、桌面≈手机/Pad。玩法见 [ICE-PUZZLE.md](./ICE-PUZZLE.md)。

## 2. 目录

```
portrait-webgpu-base/
├── AGENTS.md
├── README.md
├── docs/
├── index.html
├── vite.config.ts          # base: './' · port 5210
├── capacitor.config.ts     # contentInset never · scrollEnabled false
├── public/ui/              # table-bg.png（桌面背景）
├── src/
│   ├── main.ts             # 启动 + startIceGame
│   ├── game/               # 冰面模拟 / 手感2 / 十五关 / 托盘 / 对象池 / 叠层
│   ├── assets/ui/          # 运行时棋子与九宫托盘
│   ├── create-renderer.ts
│   ├── style.css
│   ├── adapt/
│   │   ├── design.ts       # 390×844 · layout · clientToDesign
│   │   ├── devicePreview.ts
│   │   └── safeArea.ts
│   ├── audio/              # Catalog / Batcher / Manager / backends
│   └── utils/
│       └── haptics.ts
├── plugins/native-haptics/
├── plugins/native-audio/
└── scripts/bootstrap-ios.mjs
```

## 3. 配置表

### Vite

| 项 | 值 | 原因 |
|----|-----|------|
| `base` | `'./'` | Capacitor 相对路径 |
| `outDir` | `dist` | = webDir |
| `port` | `5210` | 固定端口（避开其它工程的 5204 / 5190） |
| `target` | `es2022` | WebGPU |

### Capacitor

| 项 | 值 |
|----|-----|
| `appId` | `com.wangzhixuan.iceslide`（`capacitor.config.ts`；勿改回 swipe2048） |
| `webDir` | `dist` |
| `ios.contentInset` | `never` |
| `ios.scrollEnabled` | `false` |
| `ios.backgroundColor` | `#0b1020` |

### 设计尺寸

| 常量 | 值 |
|------|-----|
| DESIGN_WIDTH / HEIGHT | 390 / 844 |
| DESIGN_SAFE top/bottom | 59 / 34（桌面模拟） |
| Phone 预览 | 390×844 |
| Pad 预览 | 768×1024（外层视口） |

改设计尺寸时同步：`design.ts`、`style.css` 中 `#stage` 宽高、`index.html` 若有硬编码。

## 4. 适配算法

```
scale = min(viewW/390, viewH/844)   // contain
offset = 居中
#stage transform: translate(offset) scale(scale)
renderer.setSize(390, 844)          // 始终设计分辨率
```

触控：`clientToDesign`；letterbox 外忽略。

## 5. Safe Area

| 环境 | 行为 |
|------|------|
| 桌面 | JS 写入 `--safe-*` = DESIGN_SAFE |
| 原生 | 去掉 inline，CSS `env(safe-area-inset-*)` |
| UI | `#ui-root` padding = safe + ui-pad |

3D 可全出血；可点 UI 只在 `#ui-root`。

## 6. WebGPU

- `createRenderer` → `three/webgpu` WebGPURenderer  
- 无 `navigator.gpu` / init 失败 → `showFatal`  
- DPR cap 默认 2  
- 禁止 `setSize(innerWidth, innerHeight)` 跟窗走  

## 7. Haptics

接线规范：[HAPTICS.md](./HAPTICS.md)

真源：`plugins/native-haptics/`  
JS：`src/utils/haptics.ts`（`registerPlugin('AdvancedHaptics')`）  
注册链路（Capacitor 8 真机已验通）：

```
SceneDelegate.rootViewController = BridgeViewController()
  → capacitorDidLoad
  → registerPluginInstance(AdvancedHapticsPlugin)
```

`ios:bootstrap` 会拷 Swift、改 storyboard、**改 SceneDelegate**、补 pbx。只 `cap:sync` 不够。

只改 storyboard **不够**：Capacitor 8 用 SceneDelegate 直接 `CAPBridgeViewController()`，会绕过 storyboard，HUD 出现 `plugin: false`，按钮无震。

Swift **没有** `prepare`；引擎在 `load()` 启动。UIKit 反馈在主线程触发。验收用 HUD **点我震动**（`impact`）和状态行 `plugin: true`。  
业务节奏（具名事件、cooldown、开关）写在游戏层，不要改插件除非新增原生方法。

## 7b. Audio（已实现）

现行产品与套装：[AUDIO.md](./AUDIO.md) §0。工程约束：

- Loading **预解码**；热路径禁止 `new Audio()` / decode / 读盘
- `AudioBatcher` 微任务 flush；iOS 每拍最多一次桥
- iOS 生产走 `AVAudioEngine` + PCM 缓存 + PlayerNode 池；**禁止**静默 WebAudio
- 真源 `plugins/native-audio/`，改完 `ios:bootstrap`
- 运行时只打 `public/sfx/v2/`、`public/sfx/v3/`

## 8. iOS 工作流

```bash
# 首次
npm install && npm run ios:bootstrap && npm run cap:open

# 日常
npm run cap:sync
```

## 9. 已知坑

1. **不要**把 `base` 改回 `'/'`  
2. **不要** `contentInset: automatic`（双重 inset）  
3. Pad 预览禁止横向拉满 390 UI  
4. pbxproj 优先 bootstrap，少手改  
5. `dist` / `ios/.../public` 是产物  
6. 真机安装前改 `capacitor.config.ts` 的 `appId`，避免覆盖别的 App  
7. 震动没接上：先看 [HAPTICS.md §0](./HAPTICS.md)。常见断点是 SceneDelegate 仍是默认 VC，不是 storyboard 没改。不要只 `cap:sync`，不要用 `prepare()` 当验收  
8. 棋子复用：停车用 `.is-pooled`，不要 `hidden`；叠层用 `--row`/`--z-layer`。见 [VISUAL.md §7](./VISUAL.md)  
9. iOS：棋子禁止 `filter: drop-shadow`（合成层会裁切滤镜，画出横切黑带）。接地用 `.ground-blob`。

## 10. 变更

| 日期 | 说明 |
|------|------|
| 2026-08-03 | 初版：合并 niantu + shell 为 portrait-webgpu-base |
| 2026-08-14 | 增加 AUDIO.md：音效不卡帧方案 |
| 2026-08-14 | 增加 HAPTICS.md：震动一次接对 |
| 2026-08-31 | 真机震动验通。根因：Capacitor 8 `SceneDelegate` 绕过 storyboard。bootstrap 现会改 SceneDelegate；HUD 用「点我震动」+ `plugin` 标志验收 |
| 2026-09-02 | 音效落地：两套（短 tick / 长按咔），合优先于滑，出手即播。见 AUDIO.md |
| 2026-09-07 | 删除 2048 / 贪吃蛇玩法。接入冰面推箱十关；出手恢复手感 2。规范见 ICE-PUZZLE.md |
| 2026-09-09 | 对象池 `is-pooled`、CSS 叠层、脚底椭圆影 + 格子径向提亮写成 VISUAL §7。包名 Ice Slide / `com.wangzhixuan.iceslide` |
