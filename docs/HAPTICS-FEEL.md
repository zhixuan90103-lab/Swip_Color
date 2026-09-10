# 震动手感：软角色 × 材质 × 滑程

日期：**2026-09-10**。本文是**震动设计方案**。玩法已接：`hapticFeel.ts` + `gameHaptics.ts`（Core Haptics `stackImpact` / `playPattern`）。  
运动真源：[YOU-MOTION.md](./YOU-MOTION.md)。接入真源：[HAPTICS.md](./HAPTICS.md)。检索口径：[HAPTICS-RING-RESEARCH.md](./HAPTICS-RING-RESEARCH.md) §15 / §13。  
规则仍以 [ICE-PUZZLE.md](./ICE-PUZZLE.md) 为准。Juice 不改模拟；震动也不改模拟。

数字与 `src/game/hapticFeel.ts` 导出同行。不要在 `iceGame.ts` 再堆一套默认。设置试震仍走 `haptics.impact`。

---

## 0. 角色与材质（设计从这里来）

画面已经在说三件事，触感必须同一拍：

| 东西 | 画面 | 触感应像 |
|------|------|----------|
| 角色 | 软、Q 弹：待机四拍压拉、滑行拉长、砸入压扁、回弹衰减摆正 | **圆、有机、短**。不要机械脆击当身体 |
| 木箱 | 硬木、死物：4px 快收、抬 4px 再沉、绕心晃约 2 圈 | **闷、中锐**。比人硬、比石头软 |
| 石头内墙 | `wall.png`，撞不动、不喷粒子 | **脆、短、硬**。是障碍不是身体 |
| 外框托盘 | 九宫木框，格子外面 | **闷木、比石头钝**。不是砖 |

滑动过程（逻辑 `SlideKind` + 0 格顶）：

| 过程 | 画面时序 | 触感何时响 |
|------|----------|------------|
| 空滑 | 50ms/格 linear → 停格 **砸入** 55–70ms → 回弹 255–300ms | **砸入第 0 帧**，不是甩动出手、不是回弹全程 |
| ① 刹车 | 空滑撞上箱；箱跟角色同一帧砸 | 砸入第 0 帧，材质 = **木箱** |
| ② 推 | 90ms/格人箱同行 → 箱顶死再砸 | 砸入第 0 帧。行程中 **不嗡** |
| 贴箱顶死 / 非法 0 格 | 无格点位移，砸入不锁手，幅度 45% | 轻、短；**不是**系统 error |
| 待机 Q 弹 | 1.55–1.95s 四拍 | **永不震** |
| 领星 | 升起 110ms | 可选极轻一下，与砸入错开 |
| 过关 | overlay 前 `sleep(280)` | 保持 `notification('success')` |

因果：人感到的是 **软身体撞上某物**，不是「滑了很远所以马达响很久」。滑程只调 **砸一下的力度**，不调成连续震。

---

## 1. 硬约定（从检索搬来，方案不得违反）

1. 只走 `haptics.ts`（以后包 `gameHaptics`）。禁止业务 `registerPlugin` / `navigator.vibrate`。  
2. 出手 / 撞停用短击。禁止顶格 30s、禁止铃声循环、滑行途中禁止 Continuous。  
3. `notification('success')` 只给过关。出手禁止 success。非法禁止挪用 error。  
4. 系统 Impact 含义不改：light/medium/heavy/soft/rigid 仍是碰撞隐喻。  
5. `void` 发震，不 `await`。新出手可打断砸入动画，震动 **不排队叠**（本插件 `playPattern` 停不了）。  
6. `prefers-reduced-motion: reduce` 时动画已停：震动仍可短击一次（可关模块 `enabled`）。  
7. 数字对齐 `hitAmpForCells`（0 格 / 1 格 45%，7 格满幅）。不要另发明格数表。

---

## 2. 何时响：对齐砸入，不对齐甩手

现行代码在格点滑完、`startHit` **同一段**才 `impact`。方案保持这个钩子，只把「一种 medium/light」换成 **材质 × 幅度**。

```
甩动出手     → 无震（眼 + 拉长已经是 ack）
每格滑过     → 无震（50/90ms 太密，会疲）
砸入 t = 0   → 主触感（与 --you-hit、箱 4px 同一帧）
回弹全程     → 无震（Q 弹交给画面衰减；再震会抢待机弹簧）
```

非法 `onInvalid`：已与 0 格 `startHit` 同拍，保持同拍，只改成「轻 + 软」。

过关：砸入仍按材质响一次，**另外** overlay 打开时 `notification('success')`。两下间隔 ≥ 280ms，不算叠糊。

---

## 3. Q 弹身体：怎么震才像软的

不要用 Continuous 模拟弹跳（会像铃）。Q 靠 **锐度低 + 一下就完**：

| 参数 | 角色撞上去时 | 理由 |
|------|----------------|------|
| 事件 | 一次 Transient（或 UIKit `soft` / `light`） | 砸入只有 55–70ms |
| Sharpness | **0.18–0.32**（圆、有机） | 官方：低锐 = round / organic |
| Intensity | `0.28 + 0.50 * amp`，夹到 0.22–0.82 | 跟 `hitAmpForCells` |
| 第二下 | **默认没有** | 回弹 255ms 若再震，会像敲两次 |

满幅（7 格）才允许「胶一下」：Transient 之后 **≤ 60ms** Continuous，intensity 0.10–0.16，sharpness 0.12，必须写死 duration。1–6 格不要胶。

桌面 / 插件未就绪：UIKit 回退见下表，不要用 `heavy`。

---

## 4. 材质：石头、木箱、木框

停点看 **脸朝下一格**（与 `iceGame` 找 `hitBox` 同一套）：

| 脸朝下一格 | 材质 id | 障碍触感（叠在角色软击上） | UIKit 回退 |
|------------|---------|------------------------------|------------|
| 内部墙砖 `walls` | `stone` | sharpness **0.72–0.88**，短、脆 | `rigid` |
| 木箱（①刹车或推到头贴箱） | `wood-crate` | sharpness **0.38–0.52**，闷 | `medium` |
| 另一只箱（箱顶箱） | `wood-crate` | 同上，intensity × 0.9 | `medium` |
| 越界 / 非 open（外框） | `wood-frame` | sharpness **0.42–0.58**，闷木，比石头钝 | `soft` |
| 无格点非法（手势） | `none` | 只有角色软击，更轻 | `light` |

合成：**一次** CH Transient，sharpness 取障碍，intensity 仍跟角色 amp。不要角色一下 + 墙一下（会糊、会叠）。

读法：软身体是 **intensity 曲线**（amp），硬世界是 **sharpness**。石头 = 同样软的人撞得更「尖」；木头 = 同样的人撞得更「圆」。

推箱（`kind=push`）：行程不震；终点若箱贴墙，材质仍是 **木箱**（人撞的是箱），不要改成石头——石头是箱去顶的，人没有直接撞砖。箱的 4px 晃已经在说木头。

---

## 5. 事件表（具名，只这些出口）

以后只允许 `gameHaptics.*`，禁止 `iceGame` 直接 `haptics.impact`。

| 出口 | 何时 | 建议实现 | cooldown |
|------|------|----------|----------|
| `land(kind, cells, surface)` | 滑完 `startHit` | CH transient：intensity←amp，sharpness←材质；满幅可 +60ms 胶 | 80ms |
| `nudge()` | `onInvalid` / 0 格顶死 | 角色软击，intensity 约 0.28，sharpness 0.22；或 `impact('light')` | 60ms |
| `star()` | 领星升起开始 | `selection()` 或 transient 0.22 / 0.45 | 90ms |
| `clear()` | overlay 打开 | `notification('success')` **仅此处** | 400ms |
| 设置试震 | 现有三钮 | 保持 `impact(style)` 验通路 | — |

**不做：** 待机、滑格、回弹、iris 转场、提示条滑入。

`kind` 只用来打日志 / 以后接音效，不单独改锐度（锐度跟 `surface`）。`push` 与 `brake` 都是木箱，差别在 `cells`（推得远更重）。

---

## 6. 幅度（与 YOU-MOTION 同一张表）

`amp = hitAmpForCells(cells)`。

| 格数 | amp | intensity（角色） | 备注 |
|------|-----|-------------------|------|
| 0–1 | 0.45 | ≈ 0.50 | 原地顶、短滑 |
| 2–6 | 线性 | ≈ 0.55–0.75 | |
| 7+ | 1.0 | ≈ 0.78–0.82 | 才允许 60ms 胶 |

石头：同一 intensity，sharpness 提到 0.8。不要石头再把 intensity 加满——人还是软的。

---

## 7. 与现行代码差在哪

| 现在 | 方案 |
|------|------|
| 推箱一律 medium，其余 light | 按 **停点材质 + 格数** |
| 非法与刹车同档 light | 非法 `nudge` 更轻更软；刹车是木箱 land |
| 无领星震 | 可选 `star()`，可后做 |
| 无 cooldown | 出口表有 cooldown |
| 无 `gameHaptics` | 加一层，数字写 `src/game/hapticFeel.ts` 导出，本文同行 |

接的时候：在 `startHit` 旁调用 `land`，删掉后面那行裸 `impact`。过关不要用 land 替代 success。

---

## 8. 验收（真机）

1. 待机 Q 弹：无震。  
2. 短滑撞石头：一下脆，短过砸入。  
3. 长滑撞石头：更重，仍一下；满幅才有一点胶，没有铃。  
4. ① 撞箱：比石头闷。  
5. ② 推箱：滑的时候不震，停下才闷一下。  
6. 顶死 / 斜滑非法：轻软，不像走了棋，也不像系统错误。  
7. 连甩：后一下打断前动画，震动不叠成马达。  
8. 过关：撞停一下 + 280ms 后 success。  
9. 模块关：全无。桌面：不崩。

---

## 9. 刻意不做

- 滑行 Continuous 模拟冰面摩擦  
- 回弹第二下、第三下  
- 石头粒子（画面已规定不喷）  
- AHAP 文件桥、CH 播 wav  
- 用 `heavy` / `error` 当撞墙  
- 为震动改 `hitAmpForCells` 或砸入时长
