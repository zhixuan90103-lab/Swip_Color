# 画面与资源

日期：**2026-09-10**。本文是**表现层真源**（贴图、托盘布局、调参、层级、局内 HUD / 结算）。玩法规则仍以 [ICE-PUZZLE.md](./ICE-PUZZLE.md) 为准。运动 / juice 以 [YOU-MOTION.md](./YOU-MOTION.md) 为准。

实现：`src/game/boardLayout.ts`（槽位/托盘）· `iceGame.ts`（DOM、调参）· juice 见 [YOU-MOTION.md](./YOU-MOTION.md) · `src/style.css`。

---

## 1. 一句话

竖屏 390×844 里：桌面背景 + 九宫托盘 + 冰格棋盘。第一关 5×5 的托盘/缝隙/框距是模板；更大关只放大托盘，不缩小槽位。

---

## 2. 资源放哪

棋子、托盘走 **Vite 打包**（`src/style.css` 的 `url`）。桌面背景走 **public 静态路径**。

| 角色 | 运行时文件 | 接到哪 |
|------|------------|--------|
| 桌面背景 | `public/ui/table-bg.png` | `iceGame.ts`：`BASE_URL + 'ui/table-bg.png'`，`cover` |
| 九宫托盘 | `src/assets/ui/board-9slice.png` | `.ice-board-frame` 边框 `border-image`（slice **132**，边宽 **44px**，**不要 fill**）。井内实地 `#aac1de`，避免九宫接缝线 |
| 冰砖浅 | `src/assets/ui/ice-a.png` | `.is-ice-a`，`(r+c)` 偶数 |
| 冰砖深 | `src/assets/ui/ice-b.png` | `.is-ice-b`，奇数 |
| 墙/石头 | `src/assets/ui/wall.png` | `.wall-sprite` |
| 石头投影 | `src/assets/ui/wall-shadow.png` | `.ground-blob.is-wall-blob`（217×239 透明底） |
| 箱 | `src/assets/ui/crate.png` | `.box-rig` |
| 箱投影 | `src/assets/ui/crate-shadow.png` | `.ground-blob.is-box-blob`（189×218 透明底） |
| 星 | `src/assets/ui/star.png` | `.ice-star`；HUD / 结算点亮星（用空星外形做 mask） |
| HUD 重开 | `src/assets/ui/hud-restart.png` | `.ice-hud-icon::before` |
| HUD 设置 | `src/assets/ui/hud-settings.png` | `.ice-hud-icon.ice-settings::before` |
| HUD 星底 | `src/assets/ui/hud-goal.png` | `.ice-goal::before`（322×130，宽滑条、高按贴图等比） |
| HUD 空星 | `src/assets/ui/hud-star-off.png` | `.hud-star` |
| HUD 关卡条（备用） | `src/assets/ui/hud-level.png` | 现行 HUD 不用 |
| 终点垫 | `src/assets/ui/door.png` | `.ice-door`（红色齿边垫，叠在冰格上，`contain`） |
| 终点星 | 同 `star.png` | 门格装饰星：泛光 + 待机浮，不要投影；进门飞 HUD 第三槽，不计入收集 |
| 角色整图（备份） | `src/assets/ui/you.png` | 局内**不用** |
| 角色身体 | `src/assets/ui/you/body.png` | `.you-body` |
| 角色投影 | `src/assets/ui/you/shadow.png` | `.ground-blob.is-you-blob`（180×109 软椭圆，透明底） |
| 眼白 | `src/assets/ui/you/eye.png` | `.you-eye` |
| 瞳孔 | `src/assets/ui/you/pupil.png` | `.you-pupil` |

`public/ui/` 里同名棋子是拷贝，CSS 不读它们。换棋子改 `src/assets/ui/`。换背景改 `public/ui/table-bg.png`。

替换约定：保持文件名；终点/箱/墙/星用 `contain`，不要裁切。角色按完整立绘对位三层（身体 163×216；眼白约 13.5%/6.5%；瞳孔约 40.5%/18.5%）。

---

## 3. 布局（一旋钮一事）

`TUNE_DEFAULT` 描述 **第 1 关 5×5 模板**。`layoutBoard(tune, rows, cols)`：

1. 用模板算出槽边长 `slot`（与 `cell` 贴图大小无关）
2. 本关网格 = `rows/cols × slot + gap`
3. 托盘外沿随网格变大：`board = grid + 2×(rim + inset)`，并保留模板多出来的高
4. 网格在井内居中；贴图钉在**槽中心**，`translate(-50%, -50%)` 缩放

| 参数 | 只负责 |
|------|--------|
| 宽 / 高 | 第 1 关托盘外沿（border-box，含 44px 边） |
| 格子 `cell` | 冰砖贴图边长，不改槽、不改托盘 |
| 缝隙 `gap` | 槽间距 |
| 框距 `inset` | 井内沿到槽网（可负，伸进边框） |
| 透明 | 仅冰砖不透明度 |
| 影宽 / 影高 | 托盘投影层尺寸（随本关托盘同比） |
| 箱子/角色/石头/星星/终点 | 各贴图边长 |
| 箱/角/石/星 X·Y | 相对槽中心偏移（X 右正，Y 下正） |
| 角色影 / 影X / 影Y | 角色投影贴图宽（高按 180×109 同比）；相对脚底偏移（X 右正，Y 下正） |
| 光大小/X/Y/透明 | 星星格中心黄色泛光 |

现行默认见 `TUNE_DEFAULT`（棋盘：宽 360、高 366、格子 60、缝 2、框距 -20、冰砖透明 25、箱 66 / 箱X 1 / 箱Y -2、角色 66 / 角Y -10、角色影 50 / 影X 0 / 影Y 7、石头 66、星 70 / 星Y -15、光 60 / 光Y 5 / 光透明 60、终点 70。HUD：星底 200 / Y 20、关卡字 16 / 文字 Y -5、空星 40、亮星 55、星 Y -1、重开 15,20、设置 -15,20）。

localStorage 键：`ice-board-tune-v16`。改默认时升版本，避免旧缓存盖住新值。

5×5 → 托盘 360×366；5×6 → 约 423×366；6×6 → 约 423×429。超出中间区域则 `fitBoard` 整体 `scale` 放下，相对比例不变。

---

## 4. 层级

真源：`src/game/boardStack.ts` 的 `stackZ` + `placeBoardItem`（**JS 写 `z-index`**）。  
**禁止**再在 `.ice-piece` / `.ice-cell` 上写 `z-index`（`!important` 和 CSS `calc` 会把提亮压进地板）。不要靠 DOM 顺序。

**地板（不管行号，永远在角色脚下）：**

| z | 物件 |
|---|------|
| 0 | 冰砖。`.ice-cell-add` 叠在砖上，同一张 `ice-a`/`ice-b`；角色所在格 0.5，其余 0 |

**角色带（南边 / 行号大的在前）：** `z = (row + 1) * 10 + layer`

| layer | 物件 |
|-------|------|
| 2 | 墙、星光 |
| 3 | 终点垫 |
| 4 | 星（含终点装饰星） |
| 5 | 箱 |
| 9 | 角色（同行最上；下一行仍盖过本行） |

棋子内部（脚影 / 贴图）用自己的 `z-index: 0|1`，只在该棋子的叠层上下文里。

闲置棋子 class **`is-pooled`**（`display: none !important`）。禁止用 `hidden` 属性停显示：作者样式 `display: flex` 会盖掉 UA 的 `[hidden]`，回收的箱子会钉在棋盘左上角。查询活棋子一律 `:not(.is-pooled)`。

---

## 5. HUD

局内 HUD **三列对称**，占位锁死 **60px 高**（`flex: 0 0 60px`）。拧星底大小只往外画，**不挤棋盘**。

| 列 | 内容 |
|----|------|
| 左 | 圆形重开 `hud-restart.png`。按下放大 1.12；**抬手**才重开。滑出按钮外约 32px 再抬手 = 取消 |
| 中 | `hud-goal.png` 星底（宽滑条、高按 322×130 等比）+ `Level n` + 三槽星 |
| 右 | 圆形设置 `hud-settings.png`。**按下立刻**开关调参。按下只放大贴图，阴影走 `box-shadow`（禁止按钮本体 `filter` + `scale`，WK 会切出大蓝圆） |

空星 `hud-star-off.png`。点亮用 `star.png`，mask 成空星外形；占位永远按「星大小」，「亮星大」只 `scale` 画面，不挤字和邻星。

`#ice-stars` `.hud-star[data-i=0|1|2]`：槽 0 / 1 = 两颗收集星飞入；槽 2 = 进门装饰星飞入。

调参面板「顶部 HUD」：星底 / 星底XY / 关卡字 / 文字XY / 星大小 / 亮星大 / 三星 XY / 重开 XY / 设置 XY。震动轻/中/重在面板底部。

**结算** `#ice-overlay`：全屏黑 `rgba(0,0,0,0.55)`；奶油卡 + `Level n` + 同款三星 + 圆形重开 + 绿色「下一关」（第 15 关「再来一遍」）。等飞星结束再出，见 YOU-MOTION §7。

四角压暗：`.ice-app::after` 横竖线性叠层（边淡、角最深），不做屏幕圆角。

---

## 6. 文件

| 文件 | 职责 |
|------|------|
| `boardLayout.ts` | 槽位、托盘、`TUNE_*` |
| `iceGame.ts` | DOM、调参、走棋编排 |
| `objectPool.ts` | 复用；停车 class `is-pooled` |
| `boardStack.ts` | `Z_LAYER`、`placeBoardItem` |
| `youMotion.ts` / `boxMotion.ts` / `cellAdd.ts` / `starPickup.ts` | juice，见 YOU-MOTION |
| `src/style.css` | 贴图、叠层公式、脚影、提亮、HUD / 结算 |
| `src/assets/ui/*` | 运行时棋子/托盘 |
| `public/ui/table-bg.png` | 桌面背景 |

---

## 7. 翻车收成（现行硬约定）

这些不是补丁，是设计。再改画面先对照本表。

| 现象 | 禁止 | 现行 |
|------|------|------|
| 关卡切完左上角还挂着箱子 | HTML `hidden` 停车 | class `is-pooled` + `display:none !important` |
| 门盖住星 / 叠层随关卡乱跳 / 提亮看不见 | CSS 和 JS 两套 z-index、冰砖 `z-index:0 !important` | 只走 `stackZ`；冰 0、提亮 1、角色 9 |
| 滑动时像两个角色 | 复制 `body.png` 当投影 | `.ground-blob.is-you-blob` 脚底接触椭圆，贴在身体底部曲线 |
| 投影横切加黑 / 被裁 / 滑动闪没 | 任何棋子上的 `filter: drop-shadow`（含静止 `.box-cast`） | 接地只有 `.ground-blob`。`filter` 在 WKWebView 里会按合成层裁切，画成黑带。星只用泛光 |
| 走过格子发黑方块 / 切格一闪 | `mix-blend`、`overflow:hidden` 切占用层、瞬间 opacity 打满再 transition | `.ice-cell-add` 径向**加亮**；淡入淡出同一条 opacity；冰格 overflow 可见 |
| HUD 圆钮按下切出半个大蓝圆 | 按钮本体同时 `filter` + `transform: scale`（`#stage` overflow hidden） | 贴图和阴影在 `::before`；按下只放大 `::before`；阴影 `box-shadow` |

接地跟**平面形状**：圆角色用椭圆，方箱子/石头用圆角方板 + `box-shadow`。都走 `.ground-blob`，禁止 `filter: drop-shadow`。星只有黄色泛光。数字见 YOU-MOTION §6 / §8。
