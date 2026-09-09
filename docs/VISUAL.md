# 画面与资源

日期：**2026-09-09**。本文是**表现层真源**（贴图、托盘布局、调参、层级）。玩法规则仍以 [ICE-PUZZLE.md](./ICE-PUZZLE.md) 为准。运动 / juice 以 [YOU-MOTION.md](./YOU-MOTION.md) 为准。

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
| 九宫托盘 | `src/assets/ui/board-9slice.png` | `.ice-board-frame` `border-image`（slice **132**，边宽 **44px**） |
| 冰砖浅 | `src/assets/ui/ice-a.png` | `.is-ice-a`，`(r+c)` 偶数 |
| 冰砖深 | `src/assets/ui/ice-b.png` | `.is-ice-b`，奇数 |
| 墙/石头 | `src/assets/ui/wall.png` | `.is-wall` |
| 箱 | `src/assets/ui/crate.png` | `.ice-box` |
| 星 | `src/assets/ui/star.png` | `.ice-star` |
| 终点垫 | `src/assets/ui/door.png` | `.ice-door`（红色齿边垫，叠在冰格上，`contain`） |
| 终点星 | 同 `star.png` | 门格装饰星：投影 + 泛光 + 待机浮；进门飞 HUD 第三槽，不计入收集 |
| 角色整图（备份） | `src/assets/ui/you.png` | 局内**不用** |
| 角色身体 | `src/assets/ui/you/body.png` | `.you-body` |
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
| 光大小/X/Y/透明 | 星星格中心黄色泛光 |

现行默认见 `TUNE_DEFAULT`（宽 360、高 366、格子 60、缝 2、框距 -20、冰砖透明 25、箱 66 / 箱X 1 / 箱Y -2、角色 66 / 角Y -10、石头 66、星 70 / 星Y -15、光 60 / 光Y 5 / 光透明 60、终点 70）。

localStorage 键：`ice-board-tune-v10`。改默认时升版本，避免旧缓存盖住新值。

5×5 → 托盘 360×366；5×6 → 约 423×366；6×6 → 约 423×429。超出中间区域则 `fitBoard` 整体 `scale` 放下，相对比例不变。

---

## 4. 层级

越靠下的行越高：`z = (row + 1) * 10 + layer`。

| layer | 物件 |
|-------|------|
| 0 | 冰砖 + Additive（整盘 z=0，在角色脚下；细则见 YOU-MOTION §6） |
| 2 | 墙、星光 |
| 3 | 星、终点垫、终点装饰星 |
| 4 | 箱、角色（滑动时随行更新） |

---

## 5. HUD

局内 `#ice-stars` **三槽** `.hud-star[data-i=0|1|2]`。槽 0 / 1 = 两颗收集星飞入；槽 2 = 进门装饰星飞入。结算 overlay 等飞星结束再出，见 YOU-MOTION §7。

**设** 打开/关闭 `#tune-panel`（默认关）。`pointerdown` 截住以免走棋。

四角压暗：`.ice-app::after` 横竖线性叠层（边淡、角最深），不做屏幕圆角；只压背景，棋盘/HUD `z-index: 1`。

---

## 6. 文件

| 文件 | 职责 |
|------|------|
| `boardLayout.ts` | 槽位、托盘、`TUNE_*` |
| `iceGame.ts` | DOM、调参、走棋编排 |
| `youMotion.ts` / `boxMotion.ts` / `cellAdd.ts` / `starPickup.ts` | juice，见 YOU-MOTION |
| `src/style.css` | 贴图与 CSS 变量 |
| `src/assets/ui/*` | 运行时棋子/托盘 |
| `public/ui/table-bg.png` | 桌面背景 |
