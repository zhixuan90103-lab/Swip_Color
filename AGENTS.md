# AGENTS.md — portrait-webgpu-base

> **打开本仓库时的第一入口。**  
> 合并自 **niantu**（适配/TS/预览）+ **three-webgpu-cap-shell**（打包/文档/bootstrap）。

## 一句话

**TypeScript + Three.js WebGPU + Vite + Capacitor iOS** 竖屏手游稳健底座。  
设计空间固定 **390×844**，contain letterbox；桌面可切手机/Pad 预览；`base: './'` 保证真机资源路径。

现行玩法：**冰面推箱**（十五关连续）。规则见 [docs/ICE-PUZZLE.md](docs/ICE-PUZZLE.md)。关卡见 [docs/LEVEL-TEMPLATES.md](docs/LEVEL-TEMPLATES.md)。出手沿用旧 2048 **手感 2**。

## 入口地图

| 职责 | 文件 |
|------|------|
| Web 启动 | `index.html` → `src/main.ts` |
| 设计舞台 | `src/adapt/design.ts` |
| 设备预览 | `src/adapt/devicePreview.ts` |
| Safe Area | `src/adapt/safeArea.ts` + `src/style.css` |
| WebGPU | `src/create-renderer.ts` |
| 震动 JS | `src/utils/haptics.ts` |
| 震动 Swift 真源 | `plugins/native-haptics/*` |
| 震动怎么接 | `docs/HAPTICS.md` **§0 正确接入** |
| Capacitor | `capacitor.config.ts`（`contentInset: never`） |
| 构建 | `vite.config.ts`（**`base: './'`**） |
| iOS 注入 | `scripts/bootstrap-ios.mjs` |
| 音效管道 | `docs/AUDIO.md` · `src/audio/*` · `plugins/native-audio/` |
| 玩法规范 | `docs/ICE-PUZZLE.md` |
| 出题知识 | `docs/LEVEL-KNOWLEDGE.md` |
| 十五关 | `docs/LEVEL-TEMPLATES.md` · `src/game/levels.ts` |
| 画面/资源 | `docs/VISUAL.md` · `src/game/boardLayout.ts` · `src/assets/ui/` |
| 角色运动 | `docs/YOU-MOTION.md` · `youMotion.ts` · `boxMotion.ts` · `cellAdd.ts` · `starPickup.ts` |
| 文档索引 | `docs/README.md` |

## DOM（勿拆）

```
#shell > #viewport > #app > #stage
  canvas          ← WebGPU
  #ui-root        ← 所有游戏 UI（safe padding）
#device-switcher  ← 仅桌面预览例外
```

## 硬性约定

1. **`vite` `base: './'`** — Capacitor 禁止绝对 `/assets/`  
2. **`webDir: dist`** 与 Vite `outDir` 一致  
3. **`ios.contentInset: never`** — Safe Area 只走 CSS  
4. **布局坐标 390×844**；禁止 `renderer.setSize(window.innerWidth,…)`  
5. **UI 只挂 `#ui-root`**；禁止玩法 UI `position: fixed` 贴浏览器窗  
6. **Pad 只改外层视口**，不改 `DESIGN_*`  
7. **改 Swift 改 `plugins/native-haptics/` 或 `plugins/native-audio/`** 再 `ios:bootstrap`。震动见 `docs/HAPTICS.md`；音效见 `docs/AUDIO.md`。Capacitor 8 的 `SceneDelegate` 必须 `rootViewController = BridgeViewController()`。真机验收：局内「震」按钮。  
8. **无 WebGPU 则明确失败**，不静默 WebGL  
9. **音效** 禁止热路径 `new Audio()` / 每发一次桥；iOS 生产禁止 WebAudio。  

## 命令

```bash
npm install
npm run dev           # http://127.0.0.1:5210/
npm run test
npm run build
npm run cap:sync
npm run ios:bootstrap # 首次 / 修插件
npm run ios
```

查询参数：`?preview=0|1` · `?debugFit=1`  
调试安全区：`document.body.classList.add('debug-safe-area')`

## 业务怎么加

- 玩法：改 `src/game/*`，规则以 `docs/ICE-PUZZLE.md` 为准  
- 画面：改 `src/assets/ui/`、`public/ui/table-bg.png`、`boardLayout.ts` 的 `TUNE_DEFAULT`；规范以 `docs/VISUAL.md` 为准  
- 角色/场面 juice：改 `youMotion.ts` / `boxMotion.ts` / `cellAdd.ts` / `starPickup.ts`；规范以 `docs/YOU-MOTION.md` 为准  
- 出手：手感 2（`swipeInput.ts` + `FEEL2_DEFAULT`），不要另写薄滑动替换它  
- 保留：adapt / create-renderer / haptics / plugins / `base`  
- 触控：忽略 letterbox 外；关卡矩形铺满冰格，非必要不放墙、不挖空  
- 音效：按 `docs/AUDIO.md`  

## 刻意不做

- Android（可后加）  
- WebGL 静默回退  
