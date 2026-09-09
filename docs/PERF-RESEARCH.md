# 检索计划：帧率与性能（冰面推箱 DOM + WebGPU 壳）

日期：**2026-09-09**（反查补漏同日）。结论以 §5 为准。热路径：`main.ts` 的 `setAnimationLoop`、`iceGame.ts` 的 idle `rAF` + 飞星 `rAF`、`youMotion` / `boxMotion`、`style.css` 的 `left/top` transition 与 `will-change`、`create-renderer.ts`（默认 **antialias: true**，DPR cap **2**）。

本游戏不是 3D 吃满 GPU。棋盘是 DOM；WebGPU 是空正交相机 + 全屏 clear。卡顿更可能来自：**双 rAF、全屏 GPU 清屏、滑格 layout、常驻合成层**，不是三角形。

```
一帧里实际在干什么
        │
        ├─ 壳：WebGPU setAnimationLoop → 每帧 clear/render 390×844（DPR≤2，MSAA 开）
        │     canvas 是合成层，叠在 #ui-root 下面
        │
        ├─ 局内 idle rAF：星待机 + youMotion + boxMotion + cellAdd
        │     飞星/结算再开额外 rAF（同一帧可有 2～3 条回调）
        │
        └─ 棋子：left/top 做 50ms 滑格；同一节点已有 transform 居中；
              rig 每帧 JS 改 transform；#stage / 托盘还有 contain·fit 的 scale
```

**真机口径（补漏后）：** Capacitor **WKWebView 默认把 rAF 锁在约 60Hz**，即使 iPhone ProMotion 120Hz。桌面 Chrome 才可能 120。验收以 **60Hz 真机掉帧** 为准，不要以桌面 120 平均 FPS 当过关。

---

## 1. 要回答的问题

只谈「要 60fps」算未命中。

| # | 问题 | 为何要问 | 首轮？ |
|---|------|----------|--------|
| Q1 | 60Hz / 120Hz 一帧预算？`rAF` 会不会翻倍？**WKWebView 是否根本到不了 120？** | idle rAF；真机是 Capacitor | 半漏：漏了 WK 锁 60 |
| Q2 | `left/top` vs `transform`？**同一节点已有 `translate(-50%,-50%)` 再 transition left，还算 layout 吗？** | 滑格 CSS | 半漏：没写「已有 transform」 |
| Q3 | `will-change` 何时帮、何时层爆炸？闲置拆不拆？ | 星/眼/#stage 常驻 | 已覆盖 |
| Q4 | `filter` / `mix-blend` / 径向渐变在 WK 的代价 | 投影翻车；飞星仍 plus-lighter | 已覆盖 |
| Q5 | 空转 rAF vs 事件驱动 | `tickStarIdle` 永不停 | 半漏：飞星另开 rAF |
| Q6 | 空 WebGPU loop 贵不贵？要不要停？**MSAA + DPR2 清屏 fillrate？** | `main.ts` 一直 render | 半漏：没写 antialias/DPR |
| Q7 | 怎么量掉帧 / 层 / 真机？ | 验收 | 半漏：没写 WK 远程检查、60 帽 |
| Q8 | **父级 `transform: scale`（contain / fitBoard）下，子级 left/top 动画走哪条管线？** | `#stage`、`.ice-board-shell` | **首轮漏** |
| Q9 | **全屏 canvas 合成层 + 上面整盘 DOM**，隐式合成会不会把棋子都提层？ | canvas 在 `#stage` 里、UI 同级 | **首轮漏** |
| Q10 | 音效桥 / 震动热路径会不会顶掉帧？ | 出手有 `haptics.impact`；音效管道在、**玩法未播** | **第三轮已搜** |

---

## 2. 检索范围

| 轴 | 要搜 | 不要当主证据 |
|----|------|----------------|
| 浏览器合成 | web.dev compositor；`transform`/`opacity` vs `left`/`top` | Unity / 桌面 V-Sync 攻略 |
| 时间循环 | rAF、多回调同一帧、visibility | `setInterval(16)` |
| CSS | 滑格；父 scale；`will-change` | jQuery animate |
| **WKWebView / Capacitor** | **rAF 锁 60**、ProMotion 私有开关、canvas+DOM | 把 Safari 桌面 120Hz 当成 App 行为 |
| Three / WebGPU | 空场景 clear、按需 render、MSAA fillrate | 网格优化、Instancing |
| 度量 | Chrome Performance + **真机 60Hz 掉帧%** | 只报平均 FPS |

---

## 3. 查询词

首轮：

- `requestAnimationFrame 120Hz ProMotion frame budget`
- `CSS will-change too many compositing layers performance`
- `animate left top vs transform compositor layout thrashing`
- `iOS WKWebView CSS filter drop-shadow GPU cost`
- `pause requestAnimationFrame when idle game loop`
- `Three.js setAnimationLoop empty scene performance`
- `web.dev rendering performance compositor layers`

补漏轮：

- `WKWebView 120Hz requestAnimationFrame Capacitor ProMotion`
- `CSS transition left on element that already has transform`
- `canvas compositor layer implicit compositing DOM overlay`
- `multiple requestAnimationFrame callbacks same frame`
- `WebGPU antialias devicePixelRatio fillrate empty clear`

---

## 4. 检索记录

### Q1 帧预算 / 刷新率（补漏：WK 锁 60）

| 来源 | 要点 |
|------|------|
| [Hovhannisyan game loop](https://www.aleksandrhovhannisyan.com/blog/javascript-game-loop/) | 60Hz ≈ 16.67ms；120Hz ≈ 8.33ms。rAF 跟屏。逻辑用时间，不要每帧 +1 |
| [MDN rAF](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) | 用 timestamp；后台 tab 停 rAF。**同一帧里多个 rAF 回调拿到同一个 timestamp** |
| [WebKit 294338](https://bugs.webkit.org/show_bug.cgi?id=294338) | **嵌入 WKWebView（Capacitor/Ionic/Tauri）默认 ~60fps**；Safari 可开 120，**不带到 hybrid App**。社区用私有 API 撬，无公开接口 |
| [Apple Forums / WK 60fps](https://developer.apple.com/forums/thread/796512) | 官方转到 294338 |
| [Apple ProMotion 文档](https://developer.apple.com/documentation/quartzcore/optimizing-iphone-and-ipad-apps-to-support-promotion-displays) | 原生 `CADisableMinimumFrameDurationOnPhone` **对 WKWebView 内部 rAF 无效**（Tauri 插件说明） |

**收束：** 真机 App **按 16.7ms 预算**。桌面 120Hz 上 idle 才会「JS 加倍」。不要为 120 去改手感或开私有开关。

### Q2 `left/top` vs `transform`（补漏：节点上已有 transform）

| 来源 | 要点 |
|------|------|
| [web.dev animations-guide](https://web.dev/articles/animations-guide) | `top`/`left` 示例掉帧远高于 `transform` |
| [web.dev stick-to-compositor](https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count) | compositor-only ≈ `transform` + `opacity` |
| [Smashing GPU animation](https://www.smashingmagazine.com/2016/12/gpu-animation-doing-it-right/) | 动画 `transform` 会提层；**隐式合成**会把叠在它上面的兄弟也提层 |

棋子 CSS 是：`transform: translate(-50%, …)` **同时** `transition: left 50ms, top 50ms`。有 transform **不会**让 left/top 变成 compositor-only；left/top 仍走 layout。transform 只负责居中/打击偏移。Juice 在 `.you-rig` 上改 transform，这条便宜。

### Q3 `will-change`

MDN：最后手段，stylesheet 常驻 = 层不收回。web.dev / Smashing：层有内存税；iOS 视口外也合成。

现行常驻：`#stage`、`.ice-star-glow`、`.ice-star-sprite`、飞星、burst、`.you-eye`、`.you-pupil`。`#stage` 的 will-change 是为 contain **偶发** scale，不该整局挂着。

### Q4 filter / 混合

棋子 `drop-shadow` 已禁。飞星 `.ice-star-fly-add { mix-blend-mode: plus-lighter }` 仍在；格子提亮是 gradient + opacity（小面积 paint）。

### Q5 / 多 rAF

MDN games：有事才画；`drawPending` 合并。iceGame：**idle 一条永转** + 飞星/结算 **另开** `requestAnimationFrame(tick)`。同一帧可跑 idle + fly + Three loop。MDN：同帧多回调共享 timestamp，但 **JS 串行相加**。

### Q6 空 WebGPU（补漏：MSAA / DPR）

Discover three.js / Troika：静态就停 loop。forum：空场景卡在 **clear fillrate**。`createRenderer` 默认 `antialias: true`、`maxPixelRatio: 2` → 最多约 **780×1688 MSAA** 每帧清一次，底下还叠 DOM。

### Q7 度量（补漏）

Chrome：Performance 掉帧%、Rendering stats、Paint flashing、Layers。  
真机：**按 60Hz**；Safari Web Inspector 连 App；不要用桌面 120 平均 FPS。WK 锁 60 时「打不满 120」不是 bug。

### Q8 父级 scale

`#stage` contain scale、`fitBoard` 给 shell `transform: scale`。子级 left/top 仍在子树做 layout；父 scale 是合成。首轮没写这条；**不改变「滑格 left/top 仍可能 layout」**，只说明整盘已在一块被缩放的层上。

### Q9 canvas + DOM

`<canvas>` / WebGPU 会提合成层。Smashing **隐式合成**：叠在 canvas 之上的 DOM 可能被一起提层。`#stage` 里 canvas 全屏 + `#ui-root` 全屏棋盘 → 可能整盘 UI 长期在 GPU 层上。层数不一定爆炸，但 **多一次全屏纹理合成**。停 3D loop / 去掉无用 canvas 能减这条。

### Q10 音效/震动

未检索。出手热路径有 `audio` + haptics。记债：真机滑十下看桥是否打进主线程长任务。

---

## 5. 对本工程的收束（修订）

先量后改。**不以 120Hz 为产品目标。**

| 优先级 | 动作 | 依据 | 状态 |
|--------|------|------|------|
| P0 量 | 桌面录待机 / 空滑 / 推箱 / 吃星：掉帧%、Layout 是否跟 left/top、Layers 数量 | Q7 | 待做 |
| P0 量 | **iPhone 真机 60Hz** 同样四套；确认 rAF 间隔 ≈16.7ms。Safari **Develop → Inspect Apps**（WK 需 `isInspectable`） | Q1 Q7 第三轮 | 待做 |
| P1 | **停空 WebGPU loop**（或只 render 一帧当背景）。评估关 antialias | Q6 Q9 | **已做**：空场景只在 layout 时 render 一帧；`antialias: false`（纯色清屏，观感不变） |
| P1 | **一条 rAF**：idle +（可选）3D；飞星 tick 并进同一 loop，不要第三条永转 | Q5 MDN 同帧多回调 | **部分**：Three 永转已停。局内 idle rAF 仍要开（待机/提亮）。飞星仍是短 rAF，并进 idle 会改时序，未动 |
| P2 | reduce-motion 或完全静止时 **cancel idle rAF** | Q5 | 未做（会停待机动画） |
| P2 | 滑格改为格点瞬切 left/top + **transform 位移**。先看 P0 Layout 占比；毁手感 2 则回滚 | Q2 Q8 | **不做**（会改手感/观感） |
| P3 | 拆常驻 will-change（`#stage`、glow、sprite、眼）。飞星窗口再挂 | Q3 | **部分**：已拆 `#stage`。glow/sprite/眼每帧都在动，拆了会掉帧，观感风险，未动 |
| P3 | 飞星去掉 `mix-blend-mode: plus-lighter`（改 opacity/第二层贴图）。iOS 26 上 blend+filter 仍会印成不透明方块 | Q4 第三轮 | 可做，吃星时验 |
| 不做 | 棋子 `filter: drop-shadow` | Q4 | 禁止 |
| 不做 | 棋盘重写成 Canvas「为了 60fps」 | 棋子少 | 除非 P0 证明 DOM paint 爆 |
| 不做 | 私有 API 解锁 WK 120Hz | Q1 补漏 | 禁止（无公开接口、过审风险） |

**验收：** 60Hz 真机空滑 10 格，掉帧 **<5%**，单帧 JS+style **经常 <8ms**；停 3D loop 后待机 GPU 明显低于现在。

---

## 6. 反查补漏（本轮做了什么）

对照代码热路径 vs 首轮 §1–§5，缺的不是「再搜一遍 60fps」，而是 **把本工程特有的约束写进问题**。

| 漏项 | 首轮怎么写的 | 反查后 |
|------|----------------|--------|
| 真机刷新率 | 按 ProMotion 120、idle 会加倍 | **WKWebView ≈ 60**；120 是 Safari/桌面。验收改 16.7ms |
| 滑格节点 | 只说 left/top 贵 | 同一节点 **已有 transform 居中 + hit**；left/top 仍然 layout |
| 父 scale | 未问 | `#stage` / fitBoard 的 scale 是合成；不赦免子级 left/top |
| 空 canvas | 只说空场景 | **MSAA 默认开、DPR≤2、全屏 clear**；canvas 还可能隐式提 DOM 层 |
| rAF 条数 | 只提 idle | idle + Three loop + **飞星 tick** |
| 度量 | 几乎只有 Chrome | 补真机 60 帽、不要把打不满 120 当故障 |
| 音效/震动 | 范围表有 iOS 没问热路径 | **Q10 第三轮已搜**：音效未进玩法；震动每滑一次，桥异步、原生须主线程 |

**仍未知（必须 P0 量，检索替不了）：**

- 滑格 50ms left/top 在 **绝对定位、父已 scale** 的棋盘上，Layout 实际占比
- 空 WebGPU **clear** 在本机 iOS 上的 GPU 占用（有泄漏/闪烁史，不能从桌面 WebGL forum 外推）
- 飞星 mix-blend 在当前 iOS 是否仍印方块（第三轮有 iOS 26 回归证据，未在本 App 复现）

**计划本身的修改：** 见 §6、§7。

---

## 7. 第三轮检索（2026-09-09）

专门补 §6「仍未知」里能用公开资料拍板的部分：Q10、iOS WebGPU 空转、mix-blend、真机怎么挂 Inspector。

### Q10 音效 / 震动

| 来源 | 要点 |
|------|------|
| 本仓库 [AUDIO.md](./AUDIO.md) | 管道在；**「没有玩法在播」**。热路径禁 `new Audio()` / 每发一桥。现行滑格 **不会**因音效掉帧 |
| `iceGame.ts` | 出手 `haptics.impact('light'|'medium')`，过关 `notification('success')` |
| [capacitor-plugins#2340](https://github.com/ionic-team/capacitor-plugins/pull/2340) | 官方 Haptics **每次 new CHHapticEngine** 会线程爆、卡死。本壳是自研 `AdvancedHaptics`，引擎应在 `load()` 常驻（见 HAPTICS.md）；**不要改成每滑 `prepare()`** |
| [Apple Improving app responsiveness](https://developer.apple.com/documentation/xcode/improving-app-responsiveness) | 连续手势主线程预算 **&lt; 一帧（8 或 17ms）**。UIKit 反馈必须主线程，但应极短 |

**收束：** 音效暂不是瓶颈。震动每滑一次桥 + 主线程 impact，正常实现应远小于 16ms。P0 量滑十下看有没有 **Capacitor bridge 长任务**；若有，先查是不是又 new 了 engine，而不是删震动。

### Q6 补：iOS WebGPU 空转

| 来源 | 要点 |
|------|------|
| [WebKit 301627](https://bugs.webkit.org/show_bug.cgi?id=301627) | iOS 26 Safari WebGPU **游戏 canvas 闪帧**；Construct 一度在 iOS 上关 WebGPU。26.4 称已修 |
| [WebKit 303203](https://bugs.webkit.org/show_bug.cgi?id=303203) | **简单 rotatingCube** 也会让 `com.apple.WebKit.GPU` 内存涨到被杀；修掉后才稳 |
| 第三方 2026 测试笔记 | iOS 可因能耗把 WebGPU **限到 30fps**（桌面 Chrome 看不出） |

**收束：** 空 loop 在 iOS 上不只是浪费电，还有 **闪帧 / GPU 进程泄漏** 的历史。P1「停空 WebGPU loop」优先级 **上调**：背景用 CSS，不必为清色每帧提交 GPU。未量之前不要把「WebGPU 壳」当成免费。

### Q4 补：mix-blend

| 来源 | 要点 |
|------|------|
| [MDN mix-blend-mode](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mix-blend-mode) | 会 **建 stacking context**；`plus-lighter` 用于交叉淡 |
| [HA frontend #29866](https://github.com/home-assistant/frontend/issues/29866) | **iOS 26** 上 `filter` + `mix-blend-mode`：透明 PNG 被画成 **不透明色块**（与本工程格子 mix-blend 翻车同类） |
| [WebKit 255358](https://bugs.webkit.org/show_bug.cgi?id=255358) | `isolation` + `plus-lighter` 在 Safari 出现接缝 |

**收束：** 飞星 `plus-lighter` 既可能掉帧（隔离组）也可能印方块。P3：吃星路径改成不 blend。格子提亮已禁止 mix-blend，保持。

### Q7 补：真机 Inspector

| 来源 | 要点 |
|------|------|
| [Apple: Enabling inspecting content](https://developer.apple.com/documentation/safari-developer-tools/enabling-inspecting-content-in-your-apps) | iOS 16.4+ WK 要 **`webView.isInspectable = true`**，否则 Develop 菜单没有 App |
| [Inspect Apps and Devices](https://developer.apple.com/documentation/safari-developer-tools/inspect-apps-and-devices) | Safari **Develop → Inspect Apps and Devices** 按 App 列出 WKWebView |
| Capacitor #6441 等 | debug 包也要设 inspectable；bootstrap 时确认 |

**收束：** P0 真机量之前，确认 debug 的 WK `isInspectable`。用 Web Inspector **Timelines**，不要只看桌面 Chrome。

### 第三轮查询词

- `Capacitor haptics CHHapticEngine reuse freeze`
- `iOS Safari WebGPU canvas flicker memory leak GPU process`
- `mix-blend-mode plus-lighter Safari iOS opaque rectangle`
- `WKWebView isInspectable Safari Develop Capacitor`

### 第三轮后计划怎么改

- Q10 从「记债」改为 **音效未接入；震动低风险，量 bridge 长任务**
- P1 停 WebGPU loop：加上 iOS **闪帧/GPU 泄漏** 理由，不只是省电
- P3 增加飞星去 mix-blend
- P0 增加 Inspector 前提
- 仍不能用检索代替：left/top 在本盘的 Layout 占比

