# 检索计划：滑动意图识别

日期：**2026-09-10**。配套玩法真源：[ICE-PUZZLE.md](./ICE-PUZZLE.md) §4。出手实现：`src/game/swipeInput.ts` · `swipeFeel2.ts` · `swipeAxis.ts` · `swipeVelocity.ts` · `FEEL2_DEFAULT`。  
本文是检索过程存档。规则与默认数字仍以 ICE-PUZZLE / `feel.ts` 为准；冲突时改其中一侧。

本游戏不是「等抬手再猜方向」的薄滑动，也不是动作游戏的连招缓冲。检索必须同时覆盖三轴，并盯住交叉地带。

```
这一按下要不要走棋
        │
        ├─ 及时：自信时在 move 上出手，不把整段拖到 touchend
        │     感知上按下就要有回声；逻辑走棋可以等格点移动
        │
        ├─ 不误判：假阳性（错向走了）比假阴性（该走没走）更贵
        │     冰上一滑到底；贴箱再推必须两次明确甩
        │
        └─ 安全冗余：死区 × 出手距离 × 速度窗 × 轴比 × 边沿/UI
              一条过了、另一条不过 → 本按下可以不走
```

玩家目标：**操作舒适、及时响应、没有误判、有操作的安全冗余。**  
识别层只输出四向或 invalid；①刹车 / ②推由 `iceSim` 看起步是否贴箱，不塞进识别器。

---

## 1. 要回答的问题（检索成功标准）

改识别或调 `FEEL2_DEFAULT` 之前，资料必须能帮我们拍板这些事：

| # | 问题 | 为何要问 |
|---|------|----------|
| Q1 | 四向离散走棋，**move 上出手** 和 **抬手才出手** 各自的延迟 / 误判边界在哪？我们能否保持 move 出手，只用抬手处理「未达门槛」？ | 及时 vs 不误判 |
| Q2 | 冰滑推箱里，**错走一步** 和 **该走没走** 哪个更伤？阈值应偏向哪边？ | 安全冗余的方向 |
| Q3 | 斜滑：锁轴 / 等更直 / 唯一合法向，三种策略在「贴箱推、绕星、顶墙试探」上谁更少误判？ | 本游戏最大歧义面 |
| Q4 | 慢滑锁死是否该「本按下永久」？有没有「先慢后甩」的真实意图被误杀？ | 假阴 |
| Q5 | ①② 是否需要意图层知道「面前有箱」？还是识别只出方向、模拟层决定刹车/推？ | 分层，避免识别掺玩法 |
| Q6 | 系统手势、安全区、letterbox、多指、按钮：哪些必须 **整次按下作废**，哪些可以局部忽略？ | 物理安全冗余 |
| Q7 | 逻辑锁输入期间，下一手要不要 **短缓冲**？缓冲多长会变成「玩家已改主意却仍走出旧向」？ | 及时且不误判 |
| Q8 | 无效手势：静默 / nudge / 轻震，怎样让人感到「收到了」又不像走了棋？ | 舒适 |
| Q9 | 验收怎么测：脚本轨迹 + 真机任务，各记假阳 / 假阴 / 从按下到 fire 的 ms？ | 检索要落到可测 |

资料若只谈「加大 commit 更稳」「用 ML 预测手势」「虚拟摇杆死区」，算未命中。

---

## 2. 现行实现（检索对照用，不是规范副本）

规则数字以 [ICE-PUZZLE.md](./ICE-PUZZLE.md) §4 与 `FEEL2_DEFAULT` 为准。检索时用下表标 **已有 / 缺口 / 冲突**。

| 机制 | 现状 | 对照计划 |
|------|------|----------|
| 死区 / 出手 / 轴比 | `slopPx` 10 · `commitPx` 30 · `axisRatio` 1.55 | 已有 |
| 速度 | 约 80ms 窗 · `speedPxS` 200；慢到 commit 仍不够速 → 本按下锁死 | 已有；抬手剥揭指尾巴（`liftTailMs`）测试已有 |
| 次数 | 每次按下只一步；贴箱推要再滑一次 | 已有。`sameDirRepeat` 只属手感 1 |
| 斜滑 | 未锁轴、副/主 ≥ tan40°：只走唯一合法向 | 已有。`getLegal` = `applyDir` 非 stuck → **顶墙算非法**，斜滑会改判到另一向 |
| 边沿 | 仅 `clientY` 顶/底安全区起手 `ignoreFire` | **缺口：** 左右边、letterbox（`clientToDesign` 有忽略，滑动层未用） |
| 输入锁 | `busy` 锁逻辑移动；抬手时若 busy 则 `liftQueued` 在 settle 再判 | 已有短缓冲，不是格斗式方向队列 |
| UI | chrome 不进棋盘；键盘绕过全部门槛直接 `onMove` | 键盘不算滑动意图，另路 |
| 缩放 | 门槛随舞台宽 / 390 | 已有 |
| 无效 / 取消 | nudge；后台 800ms 内已走棋 abort；`pointercancel` **不** abort 已走棋 | **缺口：** cancel 与后台策略不一致 |
| iOS 系统手势 | `preferredScreenEdgesDeferringSystemGestures = []`（故意不 defer 底边，Home 一次回桌面） | 与「游戏抢底边」教程相反，是产品选择 |

原版 2048：`touchend` 才取较大轴、约 10px、无速度门槛。我们已站在「甩动 + 锁轴」一侧；检索不要倒退成等抬手的薄滑动。

---

## 3. 检索范围（三轴 + 交叉）

### A. 离散四向滑动（优先）

一次手势 = 一步棋。

| 对象 | 要挖什么 |
|------|----------|
| 2048 / Threes / 滑块手机克隆 | 何时在 move 上 fire；轴锁；一次按下一步 |
| 网格 Roguelike 滑动、跑酷变道 | 斜向死区、主轴判定 |
| Godot / Defold / raylib 滑动检测器 | 距离 / 时长 / 速度门槛怎么拆；失败信号 |
| 工程帖：等 touchend 的延迟 | 假阴与感知迟钝的代价 |

### B. 高代价走棋（优先）

错一步很贵，接近我们的冰滑。

| 对象 | 要挖什么 |
|------|----------|
| 冰滑 / 推箱手机操作 | 阈值是否更保守；有无「确认」或撤销当输入冗余 |
| Lara Croft GO、Golf Peaks、The Last Campfire | 滑一下走一格或一杆：误滑怎么防 |
| 休闲益智「甩动」而非拖到位 | 慢拖是否故意不认 |

### C. 消歧与系统手势（优先，iOS）

| 对象 | 要挖什么 |
|------|----------|
| iOS / Android 边沿返回、home indicator | 起手落点；与 Capacitor `contentInset: never` |
| UI vs 世界捕获、多指、`pointercancel` | 整次作废 vs 忽略附加指 |
| letterbox / 安全区 | 文档已写忽略 letterbox 外；是否进意图层 |
| Apple 响应性：离散 <100ms、连续 <一帧 | 按下 ack vs 走棋 fire 的预算怎么分 |

### D. 感知与反馈

| 对象 | 要挖什么 |
|------|----------|
| 触控游戏：按下立刻高亮 / 跟手 | 不提前走棋的 ack |
| 无效输入：shake、轻震、不静默 | 与我们 nudge 的差异 |
| 输入缓冲（动画未完收下一手） | 格斗缓冲过长的翻车；益智该不该缓冲 |

### E. 交叉（最值钱）

| 对象 | 要挖什么 |
|------|----------|
| 合法方向参与斜滑分叉 | 帮玩家 vs 剥夺「我想撞死手」 |
| 贴箱再推 = 两次甩 | 识别层是否不该知道箱子 |
| 慢滑锁死 vs 教学关慢拖对准 | 假阴会不会卡新手 |
| 假阳 / 假阴分记 | 调参时禁止合成一个「手感分」 |

### 不作为主检索（除非顺手）

- 神经网络、IMU、隔空手势、MediaPipe  
- 虚拟摇杆、八向移动、格斗连招  
- 另写一套替换 `FEEL2_DEFAULT` 的薄滑动  
- 只谈 Fitts 定律点选、不谈滑动离散命令  

---

## 4. 查询清单（执行时按波次）

语言：英文为主，中文补「滑动 误触 手感 / 2048 滑动 判定」。

### 波次 1 — 把类型钉死

1. `mobile game swipe gesture state machine tap vs swipe threshold`  
2. `2048 touch input swipe axis lock diagonal`  
3. `swipe on pointer move vs touchend latency false positive`  
4. `iOS edge swipe conflict game touch safe area`  
5. `Apple Human Interface input latency 100ms hang hitch`  
6. `puzzle game swipe one move per gesture flick speed threshold`

### 波次 2 — 对准我们的机制

7. `diagonal swipe disambiguation 4-way grid legal moves only`  
8. `slow drag latch reject swipe after commit distance`  
9. `input buffer puzzle game vs fighting game next move`  
10. `pointercancel background abort incomplete gesture`  
11. `invalid move feedback nudge haptic without committing`  
12. `Capacitor iOS system gesture home indicator game`

### 波次 3 — 抽验收（读完 1、2 再搜）

13. 按波次 1/2 出现的具体检测器（Godot swipe detector、原版 2048 `keyboard_input_manager`）对照我们的测试  
14. 真机任务设计：`mobile playtest swipe false positive protocol`  
15. 现有测试 `swipeSegment` / `swipeVelocity` / `iceSim` 缺哪几条意图轨迹

来源类型优先级：现码与测试 > 原版 2048 输入 > 触控游戏教程 / Apple 文档 > 益智滑动拆解 > 社区延迟帖 > 学术手势（仅假阳指标，不当实现）。

---

## 5. 每条资料要摘的字段

读的时候填这张表，否则检索会散。

| 字段 | 内容 |
|------|------|
| 来源 | 名、URL |
| 轴 | 四向滑动 / 高代价走棋 / 系统手势 / 反馈 / 交叉 |
| 出手时机 | move / 抬手 / 混合 |
| 门槛 | 距离、速度、角度、时间，有则记下数量级 |
| 假阳怎么防 | 锁入、慢滑作废、边沿、一次一步… |
| 假阴怎么防 | 合法向分叉、抬手补判、缓冲… |
| 对我们 | 已有 / 可试 / 不适用 |

---

## 6. 期望产出（检索结束时）

1. **意图层必须有 / 禁止有**（十条以内）。必须有应对齐 Q1–Q8；禁止有包括：识别器内做 ①②、等抬手才判向、ML、juice 期间锁死输入。  
2. **假阳优先还是假阴优先** 的一句话决策，以及因此不动 / 可动的 `FEEL2` 字段。  
3. **斜滑策略** 三选一（或分阶段）：锁轴 / 更直才走 / 唯一合法向；写清「顶墙试探」怎么办。  
4. **验收剧本 10～15 条**（输入轨迹 → 期望：出手与否、方向、大致延迟）。至少覆盖：  
   - 清楚甩、够速  
   - 慢拖过 commit  
   - 先慢后甩（本按下）  
   - 斜约 40°、两向都能走  
   - 斜约 40°、只一向合法  
   - 贴箱：第一次刹车、第二次推（两次按下）  
   - 顶/底安全区起手  
   - letterbox / 按钮起手  
   - 逻辑移动中再甩  
   - 抬手未达速  
   - 多指 / cancel  
5. **否决**：哪些「优化」（抬手才走棋、加大死区到点按失灵、识别层看箱子）不适合我们。

产出写入本文续节。改代码前先改 ICE-PUZZLE §4 或测试，不要先改 `swipeFeel2`。

---

## 7. 执行顺序

1. 波次 1 检索 → URL 表  
2. 波次 2 对准机制；对照 §2 标已有 / 缺口 / 冲突  
3. 读、填 §5 表，不够再波次 3  
4. 收敛 §6：必须有/禁止有 + 验收剧本  
5. 剧本能写成测试的先补 `swipe*.test.ts`；真机项单列，不假装单元测试已覆盖

**不在本计划里做：** 替换手感 2、识别器掺 ①②、撤销当误滑补偿、改关卡来迁就手势。

---

## 8. 意图层特征清单（检索前草稿，第 1 轮可改）

舒适 / 及时 / 不误判 / 冗余，对应到识别上应是：

| 特征 | 一句话 |
|------|--------|
| 状态机 + 锁入 | 一旦本按下已出手或已锁死慢滑，不再改判 |
| 假阳 / 假阴分记 | 调参禁止合成一个分数 |
| 多重门槛 | 死区、距离、速度、轴比；冗余来自「要同时过」 |
| 自信则 move 出手 | 不把整段拖到抬手 |
| 一次按下一步 | 贴箱推 = 再按再甩 |
| 斜向消歧 | 过斜宁可不走或只走唯一合法向，禁止取较大轴硬走 |
| 系统/UI 抢手势 | 边沿、chrome、多指：起手作废或捕获，不漏进棋盘 |
| 识别与模拟分层 | 只出方向；刹车/推不在识别里 |
| 无效要回声 | nudge / 轻震，不像走棋 |
| 取消路径 | cancel / 后台：未提交不留下半步 |

第 1 轮检索若推翻其中某条，改本节并在续节写原因，不要另开第二套默认。

---

## 9. 反查补漏（三轮开始前，对照现码 / 测试）

计划原稿漏了这些，检索必须盯住，否则会空转：

| 漏项 | 证据 | 对检索的影响 |
|------|------|----------------|
| letterbox 规范与实现分裂 | AGENTS / `clientToDesign` 写忽略；`swipeInput` 只看顶底 Y | Q6 不能只搜「安全区」，要问 **起手是否在设计矩形内** |
| 左右系统手势 | `inSystemEdge` 无 X | iOS 控制中心 / 多任务在顶底；左右不是本机主冲突。仍要核 Pad |
| 底边不 defer | BridgeVC 注释：Home 一次回桌面 | 检索「游戏应 defer 四边」不能当必须有；我们已否决底边 defer |
| 合法向 = 非 stuck | `iceGame` `getLegal` | Q3「顶墙试探」**现行会改判**。这是策略选择，不是 bug 未搜到 |
| `liftQueued` | busy 时抬手，settle 再 `commitOnLift` | Q7 已有「本段补判」，不是预输入下一方向 |
| `pointercancel` 不撤棋 | `endHold(..., true)` 直接 return | Q6 取消路径不完整 |
| 测试覆盖 | `swipeSegment` / `swipeVelocity` 对手感 2 斜滑、慢锁、揭指较全 | **无** 安全区、letterbox、cancel、chrome、键盘、`liftQueued` 的单元测试 |
| 手感 1 用例混在同文件 | `commit: 16`、`sameDirRepeat` | 冰面默认手感 2；验收剧本不要用手感 1 数字 |
| 撤销当冗余 | 关卡检索 Q6 未决 | 意图层 **禁止** 用撤销补误滑；Unwynd 评测依赖 undo，不适用 |
| 键盘 | 无 slop/速度 | 不算滑动意图；真机任务不要用键替代甩 |

查询补三条（原波次未写）：

- `preferredScreenEdgesDeferringSystemGestures Capacitor CAPBridgeViewController`  
- `touchSwipe triggerOnTouchEnd false threshold during move`  
- `input buffer turn-based puzzle accidental queued move`

---

## 10. 轮 1（2026-09-10）：改计划 + 检索

**本轮补漏：** 把 §2 标成已有/缺口；把 letterbox、cancel、合法向=非 stuck、底边不 defer 写进计划。

**本轮检索盯：** 出手时机、系统边、四向误触。

| 来源 | 轴 | 摘 | 对我们 |
|------|----|----|--------|
| [原版 2048 输入](https://github.com/gabrielecirulli/2048/blob/master/js/keyboard_input_manager.js) | 四向 | `touchend` 才判；`max(dx,dy)>10` 取较大轴；无速度 | 已否决。我们 move 出手 + 速度 + 轴比，不要退回去 |
| [Cursa 触控状态机](https://cursa.app/en/page/touch-controls-for-mobile-games-input-patterns-and-feedback) | 四向 | 锁入 Drag 后不再当 Tap；假阳/假阴分记；边沿勿绑关键操作；**四向允许对角容差，过斜宁可不走** | 已有锁入与分记。斜滑「过斜不走」= 两向都能走时等待，已有 |
| [Apple 响应性](https://developer.apple.com/documentation/xcode/improving-app-responsiveness) | 反馈 | 离散 <100ms；连续 <一帧 | 走棋 fire 可在甩途中；按下 ack 仍缺（无跟手光） |
| [Apple defer 边](https://developer.apple.com/documentation/uikit/uiviewcontroller/preferredscreenedgesdeferringsystemgestures) | 系统 | 沉浸游戏可让 App 手势优先，系统要 **再滑一次** | 我们 **故意 `[]`**，Home 一次退出。检索结论：不要改成 All |
| [Reachability 仍会抢下滑](https://developer.apple.com/forums/thread/797889) | 系统 | 即使 defer bottom，底边下滑仍可能触发 Reachability | 与「起手在底安全区 ignoreFire」同向：底边宁可假阴 |
| [Unity 等抬手延迟](https://stackoverflow.com/questions/58807112/unity-2d-swipe-latency-on-phone) | 四向 | 只在 touch end 处理会感觉钝 | 支持 Q1：保持 move 出手 |
| [SO 防 iPad 误滑 Home](https://stackoverflow.com/questions/51207827/how-to-prevent-accident-swipe-in-ios-game) | 系统 | defer `.bottom` | 与我们产品相反，标不适用 |
| [Capacitor #6747](https://github.com/ionic-team/capacitor/issues/6747) | 系统 | 官方无 config；要 **子类 BridgeVC** 才能 defer | 我们已有子类，选择是空边 |

**轮 1 对 Q 的推进：** Q1 倾向保持 move 出手。Q6 底边：假阴优先、不 defer Home。Q2 尚未用益智证据钉死。

---

## 11. 轮 2（2026-09-10）：改计划 + 检索

**本轮补漏：** 轮 1 没挖「门槛达到即 fire」的工业默认、缓冲长度、Capacitor 必须改 VC。补进：TouchSwipe 的 `triggerOnTouchEnd`、格斗缓冲「过长会鬼输入」、益智可撤销 ≠ 识别该松。

**本轮检索盯：** 出手时机 API、缓冲、斜向益智口碑。

| 来源 | 轴 | 摘 | 对我们 |
|------|----|----|--------|
| [jQuery TouchSwipe](https://github.com/mattbryson/TouchSwipe-Jquery-Plugin) | 四向 | 默认 `triggerOnTouchEnd=true`、`threshold=75`；**false 则达阈值立即 fire 并结束手势**；`cancelThreshold` 往回滑可取消；`excludedElements` 排除按钮 | **混合模型与我们一致：** 达门槛就走（我们还加速度）。75px 比我们 30 设计 px 更钝。`cancelThreshold` 我们没有——慢滑锁死是另一种取消。按钮排除已有 |
| [benmajor 注释](https://github.com/benmajor/jQuery-Touch-Events) | 四向 | `swipeend` 才适合自定义逻辑，避免刚过阈值就触发 | 页面滑动适用；**高代价走棋**更该达阈值+速度就走，否则冰面更钝 |
| [input buffering 笔记](https://github.com/raduacg/game-mechanics-optimizations/blob/main/72_input_buffering.md) | 缓冲 | 动作 100–200ms；**回合制 / 菜单 / 时机就是谜题 → 不要缓冲**；过长会打出无意动作 | 冰面一步很贵：**不要方向队列**。现有 `liftQueued` 只补「这一段在 busy 时抬手」，可留 |
| [Moonjump 论坛](https://moonjump.com/forum/game-dev/input-buffering-in-action-games-how-precise-is-precise-enough-and-what-s-your-actual-window-dbe216) | 缓冲 | 长缓冲 = ghost input；有效则 **最早合法帧执行并吃掉** | 若将来加缓冲：settle 立刻执行当前段，不清下一方向 |
| [Tekken 8 缓冲 ~8 帧](https://www.hotspawn.com/tekken/guide/tekken-8-taking-advantage-of-the-input-buffer) | 缓冲 | 动作游戏专用 | 不适用 |
| [Unwynd 评测](https://www.pocketgamer.com/unwynd/unwynd-bemuses-some-amuses-others/) | 高代价 | 「从没读错滑动；就算错了 undo 一行就好」 | 口碑靠 **识别准 + 撤销**。我们无撤销，识别必须更偏假阳防护 |
| [Capacitor 文档 子类 VC](https://capacitorjs.com/docs/ios/viewcontroller) | 系统 | 改边手势必须子类 `CAPBridgeViewController` | 已有；改 defer 走 bootstrap，不在 JS 意图层 |

**轮 2 对 Q 的推进：** Q1 拍板：门槛+速度在 **move** 上出手；抬手只处理未 fire 的 invalid / 补判。Q2：无撤销 → **假阳优先**。Q7：禁止格斗缓冲；保留 `liftQueued`。Q5 仍无资料支持识别层看箱子。

---

## 12. 轮 3（2026-09-10）：改计划 + 检索

**本轮补漏：** 仍缺无效回声的规范来源、Android REJECT 触感、Roblox「TouchSwipe 改成要抬手」的翻车（及时被改没）。

**本轮检索盯：** 无效反馈、抬手才认的回归。

| 来源 | 轴 | 摘 | 对我们 |
|------|----|----|--------|
| [Board 交互：无效放置](https://docs.dev.board.fun/guides/piece-interaction-design) | 反馈 | **静默拒绝像 bug**；要挡住轮廓 / 短暂停 | 支持 Q8：nudge 保留；不要去掉无效回声 |
| [Android `REJECT` haptic](https://developer.android.com/reference/android/view/HapticFeedbackConstants) | 反馈 | 系统有单独「拒绝」触感常量 | iOS 用轻/错误震，与走棋中/重分开。可试，不改识别门槛 |
| [HN：错了就 error haptic](https://news.ycombinator.com/item?id=41731150) | 反馈 | 错步立刻震，玩家停止连点 | 无效 ≠ 走棋成功震 |
| [Roblox TouchSwipe iOS 对齐抬手](https://devforum.roblox.com/t/userinputservicetouchswipe-appears-to-be-broken-iphone-studio-emulation/3275180) | 四向 | 官方把「抬手前就 fire」当 **旧 bug**，新行为要 flick 再抬手；开发者觉得店开不了 | 页面/UI 滑动要抬手；**我们是命令手势**，跟店抽屉相反。再次确认不要改成只抬手 |
| [MDN 多指](https://developer.mozilla.org/en-US/docs/Web/API/Touch_events/Using_Touch_Events) | 系统 | cancel = 实现打断（指太多等） | cancel 应视为手势失败；已走棋是否撤回仍要产品拍板（现行不撤） |

**轮 3 对 Q 的推进：** Q8 拍板：无效要回声，触感弱于走棋。Q3 无新外部证据推翻「唯一合法向」；内部冲突是顶墙改判，见 §13。Q4 外部无「先慢后甩应救」的益智先例；慢滑锁死留下。Q5 三轮无来源要识别器看箱 → 保持分层。Q9 剧本按测试缺口列。

---

## 13. 三轮收束（可当规范草案，改代码前先改 ICE-PUZZLE §4）

### 必须有

1. 状态机锁入：已出手或慢滑锁死，本按下不再改判。  
2. 死区 × 出手距离 × 速度窗 × 轴比同时过才走棋。  
3. **move 上出手**（门槛+速度够）；抬手只补 invalid / `liftQueued`。  
4. 每次按下只一步。  
5. 未锁轴过斜：两向都能走则等待；只一向合法才走该向。  
6. 顶/底安全区起手整次不走棋（假阴换系统手势）。  
7. 识别只出四向或 invalid；①② 只在 `iceSim`。  
8. 无效有 nudge（可加更轻震）；与走棋反馈分开。  
9. chrome / 多指次指不进棋盘；假阳/假阴分记调参。

### 禁止有

- 等抬手才判向（2048 / 新 TouchSwipe UI 模型）  
- 识别器看面前有没有箱  
- 格斗式方向队列  
- 用撤销当误滑补偿  
- 底边 defer 成「Home 要滑两次」（与现 BridgeVC 相反，除非改产品）  
- ML / 八向 / 换薄滑动替换手感 2  
- juice 期间锁死下一手  
- 把 letterbox 外滑动当棋（规范已写忽略，实现仍缺）

### 一句话决策

**假阳优先：** 冰上一滑到底且无撤销，错向比「再甩一次」更伤。因此：慢滑锁死保留；速度门槛不降；斜向两可则不走。可动字段只有真机假阴过高时略降 `speedPxS` / `commitPx`，且必须分记两类错。不动：`axisRatio`、一次一步、安全区起手作废。

### 斜滑策略（现行保留，写清顶墙）

保留 **未锁轴 + 唯一合法向**。  
**顶墙试探：** 现行 `getLegal` 把 stuck 当非法，斜滑会走到另一能走的轴。这是 **帮玩家拐弯，不是保留撞死手**。若以后要「斜着顶墙也 nudges 墙向」，应改 `getLegal` 或分叉条件，不要改轴比。已锁轴后略偏不改判（测试已有）。

### 验收剧本（★ = 现测已有）

| # | 轨迹 | 期望 |
|---|------|------|
| 1 ★ | 清楚甩、够速、过 commit | move 上 fire 该向 |
| 2 ★ | 慢拖过 commit | 不 fire；本按下再快也不走 |
| 3 ★ | 先慢后甩同一按下 | 不 fire |
| 4 ★ | 未锁 ~45° 两向合法 | 不 fire |
| 5 ★ | 未锁 ~45°/~40° 只一向合法 | fire 该向 |
| 6 ★ | 未锁 ~35° | 不走分叉，等锁轴 |
| 7 | 贴箱：第一下甩向箱、抬手、再按下再甩 | 两步：①然后②；识别两次方向相同即可 |
| 8 | 顶/底安全区起手再甩 | 不 fire |
| 9 | 按钮 / 预览条起手 | 不进棋盘 |
| 10 | letterbox 外起手 | 不 fire（实现缺口） |
| 11 | busy 中甩、抬手 | `liftQueued`：settle 后只可能补 **这一段** |
| 12 | 抬手未达速、未过 commit、过 slop | invalid + nudge |
| 13 | `pointercancel` | 未走棋：不 fire；已走棋：现行不撤（要否改另议） |
| 14 | 已锁轴略偏、该轴 stuck 另一轴合法 | **不改判**（测试已有） |
| 15 | 键盘方向 | 立即走棋，不经速度窗 |

7、8–10、13 不能假装已被 `swipeSegment` 覆盖。

### 否决（检索中反复出现、我们不用）

| 想法 | 原因 |
|------|------|
| 抬手才走棋 | 延迟；Roblox/2048 模型服务的是页面滑动 |
| commit 提到 ~75px | TouchSwipe 默认，冰面会假阴爆 |
| defer 四边系统手势 | 与「Home 一次离开」冲突 |
| 合法向分叉改成始终较大轴 | 假阳；原版 2048 的问题 |
| 识别层看箱子 | ①② 是模拟，不是手势 |
| 长输入缓冲 | ghost 走出冰面 |

---

## 16. 连甩反号（2026-09-10 全网检索）

每次抬手再上下甩仍认成反方向。检索命中：

| 来源 | 方法 |
|------|------|
| [Chromium 417855](https://chromium.googlesource.com/chromium/src.git/+/294e5f2d7277a47df084a4a914f3bfc96fdb8d80) | 二次拟合在急停时速度**反号**；禁止沿手指反方向 fling |
| [Android VelocityTracker 反号](https://issuetracker.google.com/37048172) | 单调位移仍算出反号速度；线性/冲量代替二次拟合 |
| [ViewPager 飞错边](https://stackoverflow.com/questions/7996421/android-view-pager-flings-the-wrong-way) | 从 DOWN 起把事件喂给 tracker；手指出屏/过快会反飞 |
| [onFling 反号](https://stackoverflow.com/questions/16381973/onfling-gestures-not-being-accurate) | **方向用起点→终点位移，不用 velocity 符号** |
| [use-gesture #409](https://github.com/pmndrs/use-gesture/issues/409) | **两下连划**在部分机型方向错 |
| Android 组：抬手事件晚到 30ms | 末段像静止再抽，污染速度窗 |

落地：丢掉 `timeStamp < 本次 pointerdown` 的过期 up/move（pointerId 复用 + 迟到抬手）；方向符号用**最近两点**，不用 80ms 净位移。

---

## 14. 仍未检索闭合（不挡收束）

- letterbox / 安全带相对舞台：**已接**（`swipeGuard` + `onDown` 舞台外 return；安全带用 `#stage` 盒）。  
- 未出手失败回声：**已接** `onInvalid` → 0 格砸入 + 轻震。  
- `pointercancel` 已走棋撤不撤：无强来源，维持不撤。  
- 按下未出手前的跟手光仍未做。  
- Pad 左右边系统手势未真机验。

---

## 15. 自洽评估（2026-09-10）

对照五层：**玩家目标**（及时 / 不误判 / 冗余 / 舒适）· **ICE-PUZZLE §4** · **本文 §13 收束** · **现码** · **测试**。  
只标矛盾与张力，不改识别代码。

### 结论

收束与手感 2 **判定核**自洽（move 出手、一次一步、慢滑锁、斜滑分叉、安全区 Y、分层 ①②）。  
**文档层有三处硬矛盾**（规范已写、接线没有）；**目标层有两处张力**（已在收束里选边，但 ICE 措辞还像没选）。未发现「§13 两条互相打脸」的逻辑环。

### 硬矛盾（规范 / 收束 vs 实现）

| # | 说法 | 实际 | 伤哪条目标 |
|---|------|------|------------|
| C1 | AGENTS / ENGINEERING / `clientToDesign`：**letterbox 外忽略**。§13 禁止当棋、剧本 10 | `swipeInput` 监听 `window`，只用顶底 `clientY` 安全区；**不用** `isInDesignBounds` | 桌面预览 / Pad 黑边可走棋；真机全屏则不明显 |
| C2 | §13 必须有「无效要 nudge」；feel 有 `nudgePx/Ms`；音效目录有 `nudge` | `iceGame` **不传 `onInvalid`**，也不 `applyFeelCss`。短滑抬手、两向都 stuck 的 `dead`、慢滑锁死后抬手 → **静默** | 舒适：静默像没收到。撞墙若已 **fire** 则走 `playDir(stuck)` 的 0 格砸入，那条有回声 |
| C3 | ICE：「方向键与滑动**同一套走棋**」若读成同一套识别 | 键盘直接 `onMove`，无死区/速度/一次按下一步的滑动状态 | 桌面调试可连发；真机无键。若 ICE 只指 `applyDir`，则与码一致，**条文含糊** |

C2 里要分开两种「无效」：

- **未出手的失败**（不够快、不够远、两向 stuck 的 dead）→ 无回声。  
- **已出手但格点不动**（锁轴朝墙、`kind=stuck`）→ 有 0 格砸入、轻震走 `playDir` 成功路径的 impact。  

收束把它们都叫「无效」，实现只服务第二种。这是评估里最值得改文档或接线的一点。

### 张力（已选边，但读起来像打架）

| # | 两边 | 现状 | 算不算破自洽 |
|---|------|------|----------------|
| T1 | ICE 标题「与旧 2048 出手一致」vs §13 否决原版 `touchend`+10px | 「一致」= 仓库手感 2，不是 gabriele 源码 | 不破。ICE 宜改成「手感 2」，避免以后按 GitHub 2048 改回去 |
| T2 | 玩家「没有误判」vs 「假阳优先」= 允许假阴 | 慢滑锁死、两可斜滑等待，都是故意不走 | 不破，若把误判定义为 **走出错向**。舒适上会觉得「甩了没动」 |
| T3 | 「唯一合法向」帮拐弯 vs 「顶墙试探」 | `getLegal` = 非 stuck；未锁轴斜滑会改判；**已锁轴朝墙仍 fire 该轴**（测试「已锁略偏不改判」） | 不破，§13 已写明。ICE §4 只写未锁轴分叉，与码一致 |
| T4 | 及时 vs 长滑锁手 | `busy` 锁整段格点滑（50ms×格）；juice 不锁；`liftQueued` 只补本段 | 与 YOU-MOTION / ICE 一致。飞很远时手感像迟钝，是玩法代价不是识别自相矛盾 |
| T5 | 底边安全区 ignoreFire vs BridgeVC **不 defer** Home | 起手在底：棋不走，系统可一次回桌面 | 故意同向，自洽 |
| T6 | `pointercancel` 不撤已走棋 vs 「取消路径」特征清单 | 未走棋不 fire；已走棋留下 | §14 已挂起。取消路径在清单里写满了，实现只做了一半，属 **收束未执行完**，不是两条规范互斥 |

### 判定核（自洽，保持）

- move 上 fire；慢滑锁死本按下；每次按下只一步。  
- 未锁轴 ≥40° 才分叉；无 `legal` 则 45° 等待。  
- ①② 只在 `iceSim` 看起步贴箱；`getLegal` 只 peek `applyDir`（`cloneState`）。  
- 手感 2 测试覆盖 §13 剧本 1–6、14；7、8–10、13 仍无单测。  
- `inputLockMs=0`：锁手靠 `busy`，不靠 feel 定时器。

### 安全区实现细节（C1 的亲戚）

`inSystemEdge` 用 `window.innerHeight` + CSS `--safe-top/bottom`。真机 WebView 铺满时与安全区同坐标系。桌面 `#device-switcher` 预览里，窗顶 ≠ 手机框顶，**安全区死带会对不准棋盘**。letterbox 与这条是同一类：意图层没用设计坐标。

### 不改代码的收口（评估建议）

1. ICE §4：「与旧 2048 出手一致」→「手感 2（甩动）」；「同一套走棋」→「同一套 `applyDir`；键无滑动门槛」。  
2. §13 必须有 #8 拆成：撞墙已 fire → 0 格砸入；未 fire 的失败 → 要不要回声另拍（现行无）。  
3. C1 标为已知实现债，与 §14 letterbox 合并，不要第三份「忽略边」说法。  
4. 不要为了自洽去 defer 底边或改回抬手出手。

评估不推翻 §13 假阳优先、move 出手、识别不管箱子。


