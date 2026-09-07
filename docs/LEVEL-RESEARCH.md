# 检索计划：路径规划关卡 × 推箱关卡

日期：**2026-09-07**。配套玩法真源：[ICE-PUZZLE.md](./ICE-PUZZLE.md)。  
本文是检索过程存档。出题用 [LEVEL-KNOWLEDGE.md](./LEVEL-KNOWLEDGE.md)；现行十关 [LEVEL-TEMPLATES.md](./LEVEL-TEMPLATES.md)。

本游戏不是纯推箱子，也不是纯迷宫。检索必须同时覆盖两轴，并盯住交叉地带。

```
本关在考什么
        │
        ├─ 路径规划：冰上只能停在「外框 / 墙 / 箱」
        │     一滑飞很远；路口要靠刹车
        │
        ├─ 推箱：箱先当刹车，贴着再推，人箱同行
        │     推完箱变成新的停车位
        │
        └─ 三星：设计路线上的两颗星；多余冰格能走，给不了星
```

---

## 1. 要回答的问题（检索成功标准）

写进后续关卡前，资料必须能帮我们拍板这些事：

| # | 问题 | 为何要问 |
|---|------|----------|
| Q1 | 冰滑 / 滑到顶 类关卡，怎样教「停靠点」而不靠墙砖填满盘面？ | 我们已定：非必要不放墙，空位仍是冰 |
| Q2 | 推箱关怎样让箱子是 **工具（刹车/台阶）** 而不是「把货物搬到坑里」？ | 我们的过关是人进门，箱不是进坑 |
| Q3 | 可选收集物 / 三星，怎样保证 **不按设计路线拿不到满星**，但乱走仍能 1 星过关？ | 与第 1 关共识一致 |
| Q4 | 「不回头的一条路」怎么出题？和推箱的「先把箱推到位再绕路」如何兼容？ | 三星路线允许转弯和推箱，不允许折返补星 |
| Q5 | 教学节奏：①刹车 → ②推箱 → 用箱当新刹车，每关只加一个新想法 | 避免难度陡增 |
| Q6 | 死锁、软锁、可重开：休闲向要不要撤销？冰滑推箱最常见的卡死长什么样？ | 决定要不要做撤销 |
| Q7 | 小棋盘（约 3×6～6×8）上，1 箱 2 星能变出几种题型？ | 直接变成第 2～N 关模板 |

资料若只谈「推箱子很难 / 迷宫要最短路」，算未命中。

---

## 2. 检索范围（两轴 + 交叉）

### A. 路径规划 / 冰滑（优先）

一滑走到底、用障碍当停车位的关卡。

| 对象 | 要挖什么 |
|------|----------|
| 冰面迷宫（宝可梦冰、Chip's Challenge 冰、 conservatory 类） | 停车点布局、如何教「不能中途停」 |
| 滑行推块（ice sokoban、Sokoban on ice） | 人滑、箱滑、与我们 ①② 的差异 |
| 停靠点解谜（Golf Peaks、A Monster's Expedition、Patrick's Parabox 的「停」） | 小关怎样让玩家先规划再出手 |
| 手机休闲：一笔画 / 不回头收集（但不是画线游戏本身） | 三星路线「一条路吃完」的出题口吻 |

### B. 推箱子（优先）

经典 sokoban 及「箱是工具」的变体。

| 对象 | 要挖什么 |
|------|----------|
| Microban / Sasquatch / Thinking Rabbit 教学关 | 每关一个想法、最小盘面 |
| 死锁与可解性（PSPACE、deadlock patterns） | 哪些卡死我们要避免；休闲要不要检测 |
| 「箱子当桥 / 当台阶 / 当刹车」而非进坑 | 更接近我们：过关是人到门 |
| 现代变体：Baba、Stephen's Sausage Roll、A Good Snowman、Sokobond | 箱改变地形后，路径规划怎么出 |

### C. 交叉（最值钱）

| 对象 | 要挖什么 |
|------|----------|
| 星级 / 可选收集的益智（Cut the Rope、Lara Croft GO、The Last Campfire、Golf Peaks 星） | 1 星能过、满星必须绕设计路线 |
| 红鲱鱼空地 vs 必要空地 | 多出来的冰如何「能走但不给星」 |
| 关卡序列：先教停，再教推，再教「把停车位搬到别处」 | 直接映射 ① → ② → 用新刹车吃第二颗星 |

### 不作为主检索（除非顺手）

- 2048 / 合成 / match-3 出题  
- 动作闯关、限时、战斗  
- 程序化生成大图（我们手写短关）  
- 纯最短路算法论文（A* 教程）；除非讲 **关卡作者如何利用滑动约束**

---

## 3. 查询清单（执行时按波次）

语言：英文为主（资料密度高），中文补「关卡设计 / 推箱子 教学关 / 冰面迷宫」。

### 波次 1 — 把类型钉死（每种 5～8 条来源）

1. `sokoban level design tutorial microban "one idea per level"`  
2. `ice sokoban OR "sliding sokoban" level design`  
3. `pokemon ice puzzle design OR "ice tile" dungeon tutorial`  
4. `"golf peaks" OR "a monster's expedition" level design path planning`  
5. `optional collectibles puzzle game star rating "don't require for completion"`  
6. `推箱子 关卡设计 教学 死锁`  
7. `冰面迷宫 关卡 停靠`

### 波次 2 — 对准我们的机制

8. `sokoban box as platform OR "block as stepping stone" puzzle`  
9. `puzzle game "brake" OR "stopper" sliding block path`  
10. `"no backtracking" puzzle level collectibles route`  
11. `casual mobile sokoban small grid 3x3 5x5 difficulty curve`  
12. `sokoban deadlock patterns "freeze" "2x2"`  
13. `Chip's Challenge ice force floor level design`

### 波次 3 — 抽模板（读完 1、2 再搜）

14. 按波次 1/2 出现的具体关卡名 / 作者访谈再搜  
15. `thinking rabbit sokoban boxxle first levels analysis`  
16. GDC / 作者笔记：`puzzle level design "teaching mechanic" talk`

来源类型优先级：作者笔记 / GDC / 设计回顾 > 关卡集说明（Microban）> 学术（sokoban complexity, 仅死锁）> 社区拆关 > 通关视频（只作关卡形态，不当规范）。

NotebookLM：✅ 可抓的 URL 入库；登录墙 / 视频 → 摘成 md 再 `source add`。

---

## 4. 每条资料要摘的字段

读的时候填这张表，否则检索会散。

| 字段 | 内容 |
|------|------|
| 游戏 / 文章 | 名、作者、URL |
| 类型 | 冰滑 / 推箱 / 交叉 |
| 盘面尺度 | 约几格、几只箱 |
| 教什么 | 停靠 / 推 / 搬刹车 / 绕路 |
| 出题手法 | 一句话：例如「箱挡住门，必须先推到侧墙」 |
| 对三星的启示 | 收集物如何强制设计路线 |
| 对我们第 N 关 | 可抄的模板名，或「不适用」 |

---

## 5. 期望产出（检索结束时）

1. **关卡模板 6～10 个**（一句话 + 最小盘面示意），覆盖：  
   - 只教 ①  
   - 只教 ②  
   - 推箱把停车位搬到星旁边  
   - 箱挡住门，满星要先推开再绕  
   - 两箱不连锁（我们已经禁止连锁）  
   - 多余冰格当诱饵，不给星  
2. **教学序列建议**（第 2 关起加什么、不加什么）  
3. **死锁清单**：休闲向要避开的推法（例如把箱推进死角且 3 星还需要它）  
4. **否决**：哪些推箱经典题（进坑、多箱还原）不适合我们  

产出写入本文续节或另开 `docs/LEVEL-TEMPLATES.md`，并加进 NotebookLM 笔记本「冰面推箱 · 玩法规范」。

---

## 6. 执行顺序

1. 波次 1 检索 → URL 表（兼容 NotebookLM 的优先入库）  
2. 波次 2 对准机制  
3. 读、填 §4 表，不够再波次 3  
4. 收敛模板，改第 2 关草案（仍先改文档，再改 `levels.ts`）

不在本计划里做：程序化生成器、撤销实现、第 2 关直接写进代码。

---

## 7. 波次 1–2 检索结果（2026-09-07）

已入库 NotebookLM 笔记本「冰面推箱 · 玩法规范」（`fa9f9873-6fc7-48fc-b57e-3f2fe83b15b0`）。下表只收 **能直接指导出题** 的来源；求解器实现、通关视频、硬件移植一律降权。

### 推箱出题

| 来源 | 轴 | 对我们有用的一句 |
|------|----|------------------|
| [Sokoban Level Design Strategies](http://www.games4brains.de/sokoban-leveldesign.php) | 推箱 | 目标区法、交替循环、停车场法；先定「只能按一种顺序完成的终点」，再布置让这条顺序变难 |
| [Development of a Sokoban level](https://sokoban.dk/articles/1596-2/) | 推箱 | 每关一个核心想法；每个箱子都要动；少留没用的地板（我们相反：地板可以多，但 **不给星**） |
| [如何设计高质量推箱子关卡](https://indienova.com/u/java/blogread/26720) | 推箱 | 同上德文稿中译：试错法 vs 目标区法 |
| [Sokoban Wiki · Deadlocks](http://sokobano.de/wiki/index.php?title=Deadlocks) | 死锁 | 死格、freeze（箱卡死且不在目标）；休闲关不要把箱推进两面墙的角，除非 3 星故意要重开 |
| [How to detect deadlocks](http://www.sokobano.de/wiki/index.php?title=How_to_detect_deadlocks) | 死锁 | 双轴都堵死 = freeze；我们箱不进坑，freeze = 再也当不了刹车 |
| [Wikipedia · Sokoban](https://en.wikipedia.org/wiki/Sokoban) | 背景 | 乱推会永久卡死，所以休闲必须有重开；撤销是加分不是本轮 |

**注意：** 经典推箱「每个箱子都要有用、少留空地板」和我们 **不完全一样**。我们过关是人进门，空冰是自由度；空地不能变成满星捷径即可。

### 冰滑 / 滑到顶

| 来源 | 轴 | 对我们有用的一句 |
|------|----|------------------|
| [Bulbapedia · Ice tile](https://bulbapedia.bulbagarden.net/wiki/Ice_tile) | 冰滑 | 滑到撞障碍才停；关卡用石头当停车点，不是把空地砌成墙 |
| [Chip's Challenge · Force floor](https://chipschallenge.fandom.com/wiki/Force_floor) | 冰滑 | 强制滑行 vs 冰：方向被地板抢走；我们只做冰（玩家选方向） |
| [Frozen Floors](https://wiki.bitbusters.club/Frozen_Floors) | 冰滑 | 教学关：专门练冰/滑行过渡 |
| [Tropedia · Block Puzzle](https://tropedia.fandom.com/wiki/Block_Puzzle) | 交叉 | 无摩擦冰上推块滑到顶；Zelda / 宝可梦 / Sokoban 变体谱系 |
| [Aycblok](https://github.com/mpewsey/Aycblok) | 冰滑 | 滑块直到撞停、永久挡块、互撞；生成器参数可当「关卡旋钮」参考，不直接生成 |
| [Ice-Sliding-Puzzle Manual](https://github.com/Ohohcakester/Ice-Sliding-Puzzle/blob/master/IceSlide/Manual.txt) | 冰滑 | 最小步数、挡块密度 |
| [Sliding Hero 评述](https://www.eurogamer.net/sliding-hero-asks-what-would-a-sokoban-puzzler-look-like-if-the-entire-game-was-one-giant-ice-puzzle-and-the-results-are-strangely-hypnotic) | 交叉 | 「整盘都是冰的推箱」长什么样 |
| [Slippery ice maps](https://tommyodland.com/articles/2021/slippery-ice-maps/index.html) | 冰滑 | 冰面地图怎么画停车图 |

### 路径规划 + 可选收集

| 来源 | 轴 | 对我们有用的一句 |
|------|----|------------------|
| [Golf Peaks 拆关](https://www.reddit.com/r/shortgames/comments/hkxg90/golf_peaks_a_cardbased_puzzle_game_about_golfing/) | 路径 | 每关先算清「这一杆会停在哪」；和我们「先规划再甩」同类 |
| [A Monster's Expedition 作者帖](https://www.reddit.com/r/puzzlevideogames/comments/fi9wgi/a_monsters_expedition_an_open_world_puzzle) | 推箱路径 | 多条路、自包含谜题、不强求全收集就能推进 |
| [Talos Principle · Star](https://talosprinciple.fandom.com/wiki/Star) | 三星 | 星是额外收集，标准结局不需要；满收集才开另一结局 |
| [Kotaku · three-star puzzle feeling](https://kotaku.com/there-s-nothing-like-that-three-star-puzzle-game-feelin-1833406965) | 三星 | 三星是「过得好」的感觉，不是过关门槛 |

### 可顺手、本轮不当规范

- Microban 关卡集（Skinner）：每关一个想法、盘面极小 — 教学节奏对，但进坑目标不对  
- Cut the Rope：路径上擦星，过关不强制满星 — 和我们擦过吃星同构，评测文噪音多  
- 科展「滑冰推箱」PDF：把滑冰当规则变体，死结标红格 — 休闲提示可参考，不做自动标死锁

---

## 8. 对本游戏的初步收敛（尚未写成第 2 关）

1. **停车点用箱和外框，少用墙砖。** 宝可梦冰、Chip 冰关都是「障碍当刹车」，空地照铺。  
2. **每关一个新想法。** Microban / sokoban.dk：第 2 关只加「贴着推」，第 3 关才「把刹车搬到星旁」。  
3. **三星 = Talos 星 / Cut the Rope 星，不是 Angry Birds 过关门槛。** 乱走可以进门。  
4. **死锁对我们 = 箱 freeze 后 3 星还需要它当刹车。** 1 星路径不应依赖这只箱；满星若会 freeze，必须还能重开，不要静默卡死。  
5. **不要抄「每个箱子必须进坑、地板尽量少」。** 那是仓库番；我们是人到门 + 多余冰不给星。  

波次 3（模板盘面）见 §9 补漏后再画。

---

## 9. 反查补漏（2026-09-07 第二轮）

对照 Q1–Q7，第一轮缺的不是「推箱很难」，而是 **和我们机制同构的写法**。

| Q | 第一轮 | 缺口 | 补漏检索 |
|---|--------|------|----------|
| Q1 冰上教停靠 | 半 | Bulbapedia / Frozen Floors 入库失败；缺「第一间冰关怎么教」 | Tropedia Frictionless Ice；Chip Frozen Floors 镜像；WikiHow 冰之道第一步用石头当停 |
| Q2 箱是工具不是货 | **弱** | 几乎全是进坑推箱 | Snowman：大球滚雪给小球让路；Expedition：木头当桥/筏；SSR：叉是工具 |
| Q3 乱走 1 星、路线 3 星 | 半 | Talos/Kotaku 有，缺「路径擦过才吃」的关卡写法 | Cut the Rope：过关不强制 3 星，星在路径上；Lara Croft GO：遗物可选、主线照过 |
| Q4 不回头 + 先推再绕 | **弱** | 几乎没写 | 推箱允许「先把工具放到位」算前进；禁止的是折返补星。Cosmic Express / Skipping Stones 是路径规划，不完全同构 |
| Q5 每关一个想法 | **弱** | Microban 对，但目标是进坑 | Hazelden：岛上只放一个新交互；Snowman 无教程、用大球清路自然教工具 |
| Q6 死锁/撤销 | 半 | freeze 有；冰滑「飞过路口」没写 | 冰滑软锁 = 没刹车停在能 vis 星的格。Snowman / 休闲标配 Z 撤销 + R 重开；我们本轮只重开 |
| Q7 小盘 1 箱 2 星题型 | **缺** | 还没有模板表 | 用补漏结论自己写，不指望搜到现成 3×6 |

**计划修正**

- 主检索从「sokoban 进坑」降权，升权：**箱当桥/刹车、无摩擦冰、可选星、无教程教学**。  
- 失败 URL 改镜像，不再死磕 Bulbapedia。  
- Q7 改成内部产出：下一份 `LEVEL-TEMPLATES.md`，不继续用检索代替画关。

### 补漏来源

| 来源 | 补哪题 | 一句 |
|------|--------|------|
| [Gamedeveloper · Expedition 设计](https://www.gamedeveloper.com/game-platforms/the-relaxing-open-world-puzzle-design-of-i-a-monster-s-expedition-i-) | Q2 Q5 | 木头当桥；每岛一个新交互，无明示教程 |
| [RPS · Expedition](https://www.rockpapershotgun.com/a-monsters-expedition-review) | Q5 | 一岛一招，慢慢内化 |
| [RPS · Snowman 试玩](https://www.rockpapershotgun.com/a-good-snowman-is-hard-to-build-preview-sokoban-puzzle) | Q2 Q6 | 大球清路给小球；卡死就 R；要提前想 |
| [Wiki · Snowman](https://en.wikipedia.org/wiki/A_Good_Snowman_Is_Hard_to_Build) | Q6 | 逐步撤销 + 重开关 |
| [Reddit · Snowman](https://www.reddit.com/r/shortgames/comments/k9gody/a_good_snowman_is_hard_to_build_a_seasonal) | Q2 Q5 | 无教程发现规则 |
| [Cut the Rope · Star](https://cuttherope.fandom.com/wiki/Star) | Q3 | 每关 3 星，过关不强制收齐，收齐才开后面盒子 |
| [Tropedia · Frictionless Ice](https://tropedia.fandom.com/wiki/Frictionless_Ice) | Q1 | 冰滑谱系；障碍才停 |
| [RPS 益智设计访谈](https://blog.draknek.org/post/109407919317/how-to-make-a-good-puzzle-game-rps-interview) | Q5 | 爽在「理解」不是「打过」 |
| [Lara Croft GO 商店页](https://play.google.com/store/apps/details?id=com.squareenixmontreal.lcgo) | Q3 | 遗物/挑战可选，主线照过 |
| [Chip Frozen Floors 镜像](https://chipschallenge.fandom.com/wiki/Frozen_Floors) | Q1 | 补 Bitbusters 入库失败 |

### 收敛补强

6. **箱是清路工具。** 雪人关用大球滚掉雪，给不能长大的小球让路 ≈ 我们把箱推到星旁当刹车。  
7. **Cut the Rope 的星比 Talos 更近：** 擦路径、过关不强制；差别是它用星锁后续盒子，我们只用评价。  
8. **教学靠关卡摆法，不靠说明。** Expedition / Snowman。第 2 关应「只有贴着推才能动那只挡门的箱」，玩家自己发现 ②。  
9. **Q4 内部定义：** 三星路径允许「推箱」这种前进；不允许吃完星再沿同一走廊折返。先推后绕 = 合法。  
10. **Q7 不再搜。** 下一档产出是自己画的 6 个小盘模板。

---

## 10. 第三轮反查与检索（2026-09-07）

第二轮补了 Q2/Q3/Q5，仍空的是：**我们独有的 ①②（人滑 + 箱滑）**、**Chip 的冰（不是强制地板）**、**「先推再绕」有没有同类**、**小盘诱饵空地**。

| 仍空 | 第三轮查了什么 | 结果 |
|------|----------------|------|
| ① 人滑 + ② 箱滑同关 | 塞尔达冰块、Kluiver 论文、Sliding Hero、IceFitter | **找到分体，找不到合体。** 宝可梦/Chip = 人滑、块多半不滑；塞尔达冰块 = 人走、块滑到顶。我们两段都滑，是自己的规则，不要再搜「现成 ①② 教程」 |
| Chip 冰怎么教 | Ice 词条、Lesson / Slip and Slide | 早期专关只教「踏上就滑、撞停」；冰鞋是对照（能在冰上走）。我们没有冰鞋，教学关只要「撞箱/框才停」 |
| 箱停在目标格 | Kluiver：冰块会滑过目标，除非目标旁有障碍 | 对我们：星是擦过，不需要停在星上；**要把箱当刹车停在某格，该格「滑向」的下一格必须是框/墙/另一箱** |
| 不回头收集 | Cosmic Express / Snakebird | 画路线、身体占格，和「一滑飞过」不同。Q4 维持内部定义，不再扩搜画线游戏 |
| 教学关不能失败 | Parabox GDC：show level 无法失败；再做「强迫你用新交互」的关 | 第 1 关已接近 show（空手能进门）；第 2 关应强迫 ② |
| 每关一句话 | Bonfire Peaks：先赢得信任、尽量少元素、**把这关想法说成一句话**；说不出来就不够聚焦 | 出题检查表加这一条 |
| 章节解锁 | IceFitter：一章全开，5/10 就能进下一章 | 我们关少，用不上；可借鉴「新机制温柔引入，章末才难」 |
| 冰滑软锁 | Sliding Hero 抱怨重置太慢 | 休闲冰关必须 **一键重开**；撤销仍可后做 |

Bitbusters 全站 NotebookLM 仍抓失败，改用 Fandom Ice。MCV Bonfire 访谈失败，PC Gamer 评测 + 本地摘录顶上。

### 第三轮来源

| 来源 | 补哪题 | 一句 |
|------|--------|------|
| [CC Wiki · Ice](https://chipschallenge.fandom.com/wiki/Ice) | Q1 | 踏上冰就沿该向滑到停；角冰会转弯（我们不做角冰） |
| [Kluiver 塞尔达冰块论文](https://theses.liacs.nl/pdf/2019-2020-KluiverS.pdf) | Q2 ①② | 块滑到顶；要停在目标旁必须有障碍；错推可无解 |
| [Parabox 评测](https://www.eurogamer.net/patricks-parabox-review-a-simple-minimalist-puzzler-with-recursive-depths) | Q5 | 无教程，一世界一个拧；时长金带 |
| [Bonfire Peaks 评测](https://www.pcgamer.com/bonfire-peaks-review/) | Q2 Q5 | 箱子当台阶/桥；早关空间刚好够用；没学会某招后面会读错题 |
| [IceFitter 评测](https://steamcommunity.com/id/sdumitriu/recommended/2789650/) | Q5 Q6 | 一章一个新机制；无限撤销；过半即可进下一章 |
| [TV Tropes · Frictionless Ice](https://tvtropes.org/pmwiki/pmwiki.php/Main/FrictionlessIce) | Q1 | 人滑 vs 只有块滑 两种；塞尔达常是后者 |
| [Wiki · Expedition](https://en.wikipedia.org/wiki/A_Monster's_Expedition) | Q2 Q5 | 木头搭桥；非线性；评论称教学很隐蔽 |

### 检索到此收束

再搜容易重复「推箱很难 / 冰关烦人」。Q1–Q6 足够出题；Q7 改内部画关。

**出题检查表（检索结论）**

1. 这关的一句话是什么？（说不清就拆关）  
2. 空手进门是否成立？（1 星）  
3. 两颗星是否都必须用箱当刹车/推箱？（3 星）  
4. 多出来的冰会不会变成满星捷径？（会就改星位，不要砌墙）  
5. 箱要停在当刹车的位置，滑向的下一格必须有挡。（Kluiver）  
6. 不要做「第 1 关之外无法失败」的 show level；第 2 关起强迫新交互。  
7. 本轮只提供重开，不做撤销。  

下一步：`docs/LEVEL-TEMPLATES.md`（6 个小盘），不是第四轮网页检索。
