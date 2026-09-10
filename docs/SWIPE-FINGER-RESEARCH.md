# 检索：小幅反向认错 + 多指谁在操作

日期：**2026-09-10**。对照现行：[SWIPE-INTENT.md](./SWIPE-INTENT.md) · `swipeInput.ts` · `swipeFlick.ts`。  
本文只拍板方案，不改默认门槛数字（仍以 ICE-PUZZLE §4 / `FEEL2_DEFAULT` 为准）。  
**2026-09-10 真机回滚：** 操作指 + 窗位移 + 出手 rebase 落地后精准度不如上一版，已撤。现行仍是按下点定方向、一次按下只一步。

---

## 0. 两个问题其实绑在一起

| 玩家看到的 | 现行代码实际在做什么 |
|---|---|
| 右甩完立刻小幅向左，仍走出右 | 方向 = **按下点 → 现在**；一次按下只出手一次；新 `pointerdown` 在「上一手还活着」时经常被丢掉 |
| 好几根手指在屏上，不知道认哪根 | 只认 **先 `pointerdown` 的那根** `pointerId`。第二根直接 `return`。W3C `isPrimary` 也是「先碰到的那根」，不是「在甩的那根」 |

握持时小指/掌根先贴屏、食指才甩，和「抬手不够干净就反向」，走的是同一条错路：**先接触的触点抢走所有权，后面真正在动的触点进不来；方向又钉在旧原点上。**

---

## 1. 小幅反向仍认成上一向

### 1.1 现行还在踩的坑

上一轮已做：反向 commit ×0.4、已出手后 16ms 空隙允许新 down、预存后写覆盖。问题还在，因为这三条都没改 **方向怎么量**，也没改 **同一根手指回拉**。

```
右甩出手（ox 仍在按下点）
    │
    ├─ 没抬干净：同一 pointerId 继续 move，g.fired=true → 向左位移全部丢掉
    ├─ 抬了但 up 晚到：新 down 若距 lastT < 16ms（回拉时点还在来）→ 仍丢掉
    └─ 新手下成功：方向仍是「新按下点 → 现在」
         落点常在上一划尽头；先有一小段继续向右（按实），再向左
         净位移还是正右 → 又出手右
```

`commitForIntent` 只在 **净位移已经是左** 时才缩短门槛。净位移仍是右时，缩短没用。

速度窗 `recentDelta()` 已经算了「最近两点位移」，**方向判定没用它**。速度只当够不够快。

### 1.2 行业怎么判方向

| 来源 | 方向怎么取 | 对我们 |
|---|---|---|
| Android `GestureDetector.onFling` | `e2 − e1`（按下点到抬手点）+ 速度门槛 | 等抬手；同一按下里的回拉不会变成第二步。我们要 move 上出手，不能整段抄 |
| Android a11y `Swipe.java` | 路径按折角 ~90° **切段**，每段自己的方向 | 回拉 = 新段。适合连甩 |
| Launcher3 `SwipeDetector` | `mActivePointerId`；位移相对 `mDownPos`，速度相对 `mLastPos` | **所有权**和**瞬时速度**分开。方向不要钉死 down |
| Android `DifferentialMotionFlingController` | 速度与上一记 fling **反号则停掉旧 fling** | 反向是新意图，不是噪声 |
| 专利 US20170235375 | 回程与去程速度分量 **异号** → 当成另一手势，不必离开感应区 | 明确「回拉不是误触」 |
| Chromium / 此前踩过的坑 | 用速度 **符号** 当方向会在抬手/pointerId 复用时反号 | **继续禁止速度符号当方向**。用 **最近位移**（位置差），不是 v 的正负 |

### 1.3 方案（反向）

**出手瞬间的方向 = 最近位移窗的主轴符号（已有 `recentDelta` / 80ms 窗净位移），不是按下点到现在。**  
按下点只负责：出死区、够不够远（commit）。速度仍只当门槛，正负不改方向。

这样：右甩已出手后，手指往左走，窗内净位移变左，下一手（新手势或切段）认左。不会因为「离最初按下点还偏右」再打出右。

同一根手指、没抬手的回拉，额外一条：

**出手后把原点 rebase 到出手点，并允许再出手一次反向。**  
同向仍锁死（一次按下同向只一步，避免按住连走）。这不是 40ms 门闩，也不是合法向分叉。

新 `pointerdown`：上一手已出手则 **立刻顶替**，不要再等 16ms 空隙（回拉时 move 还在进，空隙永远不够）。过期 up 仍靠 `timeStamp < 新 downTs` 丢掉。弹跳仍用抬手后 10ms。

预存：保持后写覆盖（已有）。

### 1.4 不选

- 抬手才判向（角色会再次「滑不动」）
- 速度符号当方向（已证明会反号）
- 再把全局 commit 降到 5～10（同向误出）
- 用 ML / 力反馈（15 Pro 无 3D Touch）

---

## 2. 多指：谁才是操作手指

### 2.1 行业定义「主指针」不能当操作指

[W3C Pointer Events / MDN `isPrimary`](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/isPrimary)：

- 触摸的主指针 = **当时没有其它触摸时，第一个 pointerdown 的那根**
- 主指针抬起后，**剩下的手指不会变成 primary**（Rick Byers，public-pointer-events 2013-10-21）
- 规范原文给作者的建议是「只要单指交互就忽略非 primary」——那是给鼠标兼容事件用的，不是「正在滑动的手指」

所以：掌根/无名指先贴屏（primary），食指再甩（`isPrimary === false`）。若只认 primary，**真正在甩的那根被丢掉**，操作指变成按在那儿的那根。现行 `if (g) return` 效果相同：先 down 的赢。

Android：`ACTION_DOWN` 第一根，`ACTION_POINTER_DOWN` 后来的。Launcher3 用 `mActivePointerId`，后来的手指默认不抢。掌托专利（WO2025234741 等）：**已经在移动的触点是手势，后贴上且几乎不动的当掌，丢掉后贴的。** 反过来说：先贴着不动、后动的，应把所有权给 **先越过死区的那根**。

Web 没有可靠的接触面积当掌托（iOS WKWebView 上 `width`/`height` 常是默认值）。不能靠面积认手指。

### 2.2 本游戏要的所有权（单指令，不是双指手势）

一次只认一根 **操作指**。其它触点整段忽略。没有捏合、没有双指滚动。

操作指 ≠ 先按下的，也 ≠ `isPrimary`。

**操作指 = 第一根走出死区（armed）的 pointerId。**

| 场景 | 谁赢 |
|---|---|
| 一根在甩 | 那根 |
| 小指按着、食指才甩 | 食指（先 armed）。小指 down 可以占坑，但没出死区，食指一 armed 就接管 |
| 食指已经在甩，另一根拍上来 | 继续食指。后来的 down/move 全部忽略 |
| 操作指抬起，另一根还在 | **不**把所有权传给剩下的（与 W3C primary 一样：不继承）。下一手必须新 down 再 armed |
| 两根几乎同时甩 | 谁先 armed 谁赢；另一根当噪声 |

这比「只认 isPrimary」多一个状态：`contacts: Map<pointerId, {ox,oy,x,y}>`，但只有 `owner` 能 `tryFlick`。未 armed 的接触只更新自己的点，用来比谁先出死区。

### 2.3 不选

- 只认 `e.isPrimary`（掌/托指会赢）
- 第二根 down 取消整次手势（握持时永远取消失败）
- 按压感/面积认哪根手指（15 Pro / WKWebView 不可靠）
- 手指解剖注册（三指以上才有意义，休闲冰面用不上）

---

## 3. 合成后的实现（一层，不要两套补丁）

手势层改成：**多触点跟踪 + 一个 owner + 窗位移定方向**。

```
contacts: pointerId → { ox, oy, x, y, downTs }
owner: pointerId | null     // 第一根 dist≥slop 的
g: 只从 owner 读，出手/rebase 都在 owner 上
```

1. `pointerdown`：登记 contact。若已有 owner 且 owner 未出手 → 忽略（防一次当两步）。若 owner 已出手 → 新 down 可以成为 **下一个候选**，owner 一抬或空隙后由它 armed 接管。  
2. `pointermove`：只更新对应 contact。无 owner 时，谁先 `max(|dx|,|dy|) ≥ slop` 谁当 owner，原点用 **这根** 的 down。非 owner 的点不进速度窗。  
3. `tryFlick`：方向 = `dirFromDelta(recentDx, recentDy, axisRatio)`（窗净位移或 `recentDelta`）；commit 仍看 owner 从 **当前原点** 的沿轴距离；速度仍 `|v|`。  
4. 出手后：`ox,oy = 当前点`，速度窗 reset，`fired` 对 **同向** 锁死；**反向** 从新原点再 armed 可再出手一次。  
5. `pointerup/cancel`：删 contact。若是 owner → owner=null，不把所有权传给还在屏上的其它指。  
6. 过期事件、安全区起手、letterbox、转场 `cancelInput`、预存后写覆盖：保持。

测试要盖：

- 右 40px 出手后，同指左 16px 快移 → fire 左（窗位移），不是右  
- 先 down 不动，第二指右甩 → fire 右（第二指为 owner）  
- 第一指已甩，第二指左甩 → 仍第一指的方向，不改判  
- 操作指抬起、第二指还在且移动 → 不出手  
- `isPrimary===false` 的那根先 armed → 仍能出手  

---

## 4. 验收（真机 iPhone 15 Pro）

1. 右甩立刻小幅向左（抬手或不抬手）→ 走左。  
2. 左手扶屏、右手甩 → 跟右手。  
3. 甩的过程中另一指点一下 → 不改向、不打出第二步。  
4. 斜着朝墙仍砸墙向，不横飞。  
5. 转场遮罩里甩，干净后再甩只一步。
