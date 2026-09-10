# 检索计划：iOS 铃声震动（声触一体）

日期：**2026-09-10**（三波检索 + 反查补漏已收束）。配套接入真源：[HAPTICS.md](./HAPTICS.md)。JS：`src/utils/haptics.ts`。Swift 真源：`plugins/native-haptics/`。玩法现状：`iceGame.ts` 只打 UIKit `impact` / `notification`。

本文是检索过程存档。接入命令与插件注册仍以 HAPTICS.md 为准；冲突时改其中一侧。检索结论未写进玩法前，**不要**把铃声式长震接到出手热路径。

本游戏不是来电铃，也不是系统闹钟。检索「铃声震动」是为了弄清 **Apple 怎么把声音和 Taptic Engine 编成同一条时间线**，以及 **设计规则**（何时用、何时禁、和静音开关怎么相处）。能搬进游戏的是原则与原语，不是来电 UI。

```
铃声震动在系统里是什么
        │
        ├─ 设计：因果 / 和谐 / 有用（WWDC19 三原则）
        │     听得到的节奏与摸得到的节奏同一拍；不为震而震
        │
        ├─ 实现：AHAP = Apple Haptic and Audio Pattern
        │     连续事件 ≈ 铃声的「嗡」；瞬态 ≈ 节拍点；可叠音频事件
        │
        └─ 系统策略：响铃音量、静音键、Haptics Always/Silent/Never
              App 不能替代系统来电铃；只能在前台编自己的声触 pattern
```

玩家（本游戏）目标：**出手有短回声、过关有仪式、不要震糊、设置能关。**  
铃声资料只服务「怎么编长节奏 / 怎么和音效对齐」，不服务「后台响铃」。

---

## 1. 要回答的问题（检索成功标准）

改插件或加 `gameHaptics` 之前，资料必须能帮我们拍板这些事：

| # | 问题 | 为何要问 |
|---|------|----------|
| Q1 | 系统「铃声 + 震动」是 **一条 AHAP 时间线**，还是铃声走 AVAudio、震动另开一条旧 `AudioServices` 长震？第三方能复现到什么程度？ | 弄清真实现 vs 用户口头「铃声震动」 |
| Q2 | Apple 设计三原则 **Causality / Harmony / Utility** 在铃声场景怎么落地？游戏出手/过关各对应哪条，哪条禁止套铃声式连续震？ | 设计规则，不是 API 清单 |
| Q3 | Transient vs Continuous：文档把 Continuous 比成「ringtone 的震」。游戏里哪些事件该 Continuous、哪些必须 Transient？连续最长多少才不烦？ | 原语选型 |
| Q4 | Intensity / Sharpness 在「铃」和「敲」上怎么分工？铃声是低锐度长包络 + 节拍点高锐度叠上去吗？ | 调参语言 |
| Q5 | 声触同步：同一 `CHHapticPattern` 里塞 `AudioCustom`，还是震动走 Core Haptics、音效走我们现有 Native Audio？引擎 `playsHapticsOnly` 现在是 true，开音频事件会和音效插件抢 session 吗？ | 和 AUDIO.md 的边界 |
| Q6 | 静音键 / Settings → Sounds & Haptics → Ringtone Haptics（Always / Silent / Never）/ System Haptics：App 内震动跟哪条走？游戏是否必须自备开关、不能假设系统会替我们关？ | 合规与开关 |
| Q7 | 旧 API `AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)` / 用户「自创振动」录音条，和 Core Haptics 是什么关系？还要不要碰？ | 禁止走回头路 |
| Q8 | 引擎生命周期：铃声式长 pattern 要 `CHHapticAdvancedPatternPlayer` 循环？`resetHandler` / 进后台 / 来电打断后怎么停？我们 `startContinuous` 已有淡出，够不够？ | 热路径与泄漏 |
| Q9 | 验收：真机在响铃模式、静音模式、系统触感关、本游戏开关关，四格各应震/不震？AHAP 用 Finder Quick Look 看波形是否算设计步骤？ | 检索要落到可测 |

资料若只谈「调用 `impact('heavy')`」「Android Vibrator 波形数组」「给来电写 VoIP 后台」，算未命中。

---

## 2. 现行实现（检索对照用，不是规范副本）

规则以 [HAPTICS.md](./HAPTICS.md) 为准。检索时用下表标 **已有 / 缺口 / 冲突**。

| 机制 | 现状 | 对照计划 |
|------|------|----------|
| 插件注册 | bootstrap → `BridgeViewController` `registerPluginInstance` | 已有；与铃声无关 |
| 引擎 | `load()` 里 `CHHapticEngine()`，`playsHapticsOnly = true`，`isAutoShutdownEnabled = false` | **有意分层（收束）。** 音频事件会被丢掉；Unity 官方插件文档确认该旗 **降低启动延迟**。改值须停引擎再 start |
| UIKit 短击 | `impact` / `notification` / `selection` | 已有。过关用 `notification('success')`。跟 System Haptics + 前台 |
| Core Haptics 瞬态 | `stackImpact` / `playPattern` | 插件有；**玩法未用**。`playPattern` 的 player **不持有**，等同 fire-and-forget、停不了、可叠 |
| 连续震 | `startContinuousHaptic` / `stopContinuousHaptic`（stop 淡出约 50ms） | 插件有；**玩法未用**。默认 `duration` **30.0 = API 上限**，不是「铃声时长」 |
| AHAP 文件 | 无 | **不缺桥。** 与 JS `playPattern` 字典等价；设计师未交付 `.ahap` |
| 音频事件同 pattern | 无；音效另走 `plugins/native-audio` | **保持分层。** 不要开 CH 音频抢 AUDIO.md 的 `.ambient` session |
| 玩法事件 | 推箱 medium、滑停/非法 light、过关 success、设置三档验通路 | **缺口仍在游戏层：** cooldown、具名 `gameHaptics`。铃声式过关乐句 **非必须** |
| 开关 | 模块布尔 `enabled`；未进存档 | **不读 System Haptics**（无公开 API）。`enabled` 仍要；Accessibility Vibration 是总闸 |
| `prepare()` | Swift 没有；JS 有空壳 | 已有坑，不发明 JS prepare 桥 |
| `isMutedForHaptics` | 未用 | App 自己静音引擎的旗，**不是**系统 System Haptics。游戏开关可继续走 JS `enabled`，不必绑这面旗 |

本壳已站在「插件只负责震一下，节奏在游戏层」一侧。检索不要把 AHAP 解析塞进 Swift 当新桥方法，除非结论明确「文件比字典更好维护」。

---

## 3. 检索范围（三轴 + 交叉）

### A. 系统设计规则（优先）

Apple 怎么教人编「听得到 + 摸得到」。

| 对象 | 要挖什么 |
|------|----------|
| HIG *Playing haptics* | 系统 pattern 不许挪用含义；一致因果；触听视和谐；不要为震而震 |
| WWDC19 *Designing Audio-Haptic Experiences* | Causality / Harmony / Utility；铃声作 Continuous 的隐喻 |
| WWDC21 *Practice audio haptic design* | 同一三原则的练习：AHAP + AudioCustom、Quick Look 可视化 |
| HIG *Playing audio* / *Designing for games* | 静音键预期、游戏采用 Core Haptics、可关强度 |
| 用户设置：Sounds & Haptics | Ringtone/Text Tone 可配震动图案；Always Play vs Silent；System Haptics 总闸 |

### B. 实现原语（优先）

铃声震动在代码里长什么样。

| 对象 | 要挖什么 |
|------|----------|
| Core Haptics 总览 | Transient = 开关那种一下；Continuous = **铃声那种震**；可叠 Audio |
| AHAP 格式 | Pattern / Event / Parameter / Parameter Curve；Haptic vs AudioCustom |
| HapticSampler 示例 | `playPattern(from:)` fire-and-forget；可层叠多 pattern |
| `CHHapticEngine` 属性 | `playsHapticsOnly`、`init(audioSession:)`、打断、静音 |
| Advanced player | 循环、暂停、速率 — 是否铃声循环所需 |
| 旧路 | `AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)`、自定义振动录音；仅作对照，不采用 |

### C. 系统策略与权限（优先，iOS）

| 对象 | 要挖什么 |
|------|----------|
| 来电铃是系统服务 | 第三方 App **不能**注册为系统铃声播放器；CallKit 是电话场景，与游戏无关 |
| 静音键 | 游戏音效 vs 触感是否分轨；HIG 对 category 的预期 |
| 系统通知/来电可覆盖 App 触感 | 引擎文档已写 OS 可 override |
| Music Haptics（较新） | 系统把音乐译成触感；是否暴露 API、和我们自编 AHAP 的关系 |
| 无 Taptic 机型 / 模拟器 | `capabilitiesForHardware`；连续震退化为无 |

### D. 游戏怎么偷师（本仓库）

| 对象 | 要挖什么 |
|------|----------|
| 出手 | 必须 Transient / UIKit impact；禁止铃声式连续 |
| 过关 / 领星 | 是否一小段「乐句」（连续底 + 两下瞬态）配现有音效，而不是 notification 一声 |
| 非法 / 顶墙 | 比成功更短、更钝，避免像走了棋 |
| 与 AUDIO.md | 热路径：震动一次桥可接受；**禁止**把 wav 塞进 CH 引擎当主音效管道 |
| 节流 | 铃声乐句未播完再出手：切还是叠？（HapticSampler 默认叠） |

### E. 交叉（最值钱）

| 对象 | 要挖什么 |
|------|----------|
| Harmony：过关 iris + 星 + notification 是否同拍 | 视觉已有时长；触感应对齐 `YOU-MOTION` 数字，不另发明秒数 |
| `playsHapticsOnly = true` vs 将来 AHAP 带音频 | 保持只震、音效插件播 wav，用同一相对时间表手工对齐 |
| Utility：十五关每步都 medium 会不会震疲 | 推箱 / 刹车 / 非法要分级；铃声式只留给稀有事件 |
| 静音键开着玩：只震不响是否仍「像铃」 | 触感必须独自可读，不能靠声补全因果 |

### 不作为主检索（除非顺手）

- Android `VibrationEffect` / 通知渠道  
- Watch / 手柄 Core Haptics（可作 sharpness 对照，不当实现）  
- VoIP / CallKit / 推送来电  
- 用 ML 从 wav 自动生成 AHAP（AHAPpy 一类只当附录）  
- 再写一条 Capacitor 插件替代 AdvancedHaptics  
- 把 `prepare()` 加进 Swift  

---

## 4. 查询清单（执行时按波次）

语言：英文为主。中文补「iPhone 铃声 震动 自定义」「系统触感 静音」。

### 波次 1 — 把类型钉死

1. `Apple HIG playing haptics best practices system patterns`  
2. `WWDC 2019 designing audio-haptic experiences causality harmony utility`  
3. `Core Haptics continuous event ringtone vibration`  
4. `AHAP Apple Haptic Audio Pattern AudioCustom`  
5. `iPhone Settings Sounds Haptics ringtone vibration Always Play Silent`  
6. `CHHapticEngine playsHapticsOnly audioSession mute switch`

### 波次 2 — 对准我们的机制

7. `WWDC 2021 practice audio haptic design AHAP Quick Look`  
8. `HapticSampler playPattern from file layering`  
9. `CHHapticAdvancedPatternPlayer loop continuous stop fade`  
10. `UIKit UIImpactFeedbackGenerator vs Core Haptics when to use`  
11. `AudioServicesPlaySystemSound kSystemSoundID_Vibrate deprecated custom vibration`  
12. `game haptics cooldown named events vs ringtone phrase`  
13. `System Haptics setting app Core Haptics still plays?`

### 波次 3 — 抽验收（读完 1、2 再搜）

14. 对照本插件方法表：哪些铃声能力已有、缺的是 **pattern 数据** 还是 **新桥**  
15. 真机四格：响铃 / 静音 / 系统触感关 / 游戏开关关  
16. 过关乐句时长 vs `irisWipe` / overlay 280ms：应短于视觉还是对齐  
17. Finder Quick Look `.ahap` 是否作为设计交付（Mac 编辑、真机播）

来源类型优先级：Apple HIG + Core Haptics 文档 + WWDC > 本仓库 HAPTICS.md / Swift > 官方 sample（HapticSampler / HapticBounce）> 系统设置用户文档 > 社区实现帖 > 自动 AHAP 工具（仅附录）。

---

## 5. 每条资料要摘的字段

读的时候填这张表，否则检索会散。

| 字段 | 写什么 |
|------|--------|
| 来源 | 标题、年份、URL |
| 轴 | A 设计 / B 原语 / C 系统策略 / D 游戏偷师 / E 交叉 |
| 主张 | 一句话 |
| 对 Q? | 回答了表 1 哪几问 |
| 可搬？ | 原则 / 原语 / 数字 / 不可搬（来电、后台） |
| 与现状 | 已有 / 缺口 / 冲突（尤其 `playsHapticsOnly`） |
| 证据强度 | 官方文档 > WWDC > sample > 用户指南 > 博客 |

---

## 6. 先钉死的约束（检索也不得推翻，除非改 HAPTICS.md）

1. 改 Swift 只改 `plugins/native-haptics/`，再 `ios:bootstrap`。  
2. 玩法只走 `src/utils/haptics.ts`（或再包 `gameHaptics`），禁止业务 `registerPlugin` / `navigator.vibrate`。  
3. 节奏、cooldown、具名 pattern 在游戏层，不塞进 Swift。  
4. iOS 生产音效仍走 AUDIO.md 管道，不把主 BGM/SFX 改成 CH 引擎音频事件。  
5. 出手热路径保持短击；铃声式长句最多给过关 / 极少仪式。  
6. 真机验收，不用模拟器。  
7. 不把系统来电铃、自定义振动录音器做成游戏功能。

---

## 7. 种子来源（波次 1 开读，不是结论）

检索开始时优先打开这些，再按引用往下爬。

| 源 | 轴 | 已知要点（待精读核实） |
|----|----|------------------------|
| [Playing haptics (HIG)](https://developer.apple.com/design/human-interface-guidelines/playing-haptics) | A | 系统 pattern 不挪用；因果；触听视同拍 |
| [Core Haptics](https://developer.apple.com/documentation/corehaptics) | B | Continuous **被写成 ringtone 那种震**；可叠自定义音频 |
| [AHAP files](https://developer.apple.com/documentation/corehaptics/representing-haptic-patterns-in-ahap-files) | B | JSON pattern；AudioCustom 相对 bundle 路径 |
| [Playing a custom pattern from a file](https://developer.apple.com/documentation/corehaptics/playing-a-custom-haptic-pattern-from-a-file) | B | HapticSampler；层叠；`init(audioSession:)` |
| WWDC19 *Designing Audio-Haptic Experiences* | A | Causality / Harmony / Utility |
| WWDC21 *Practice audio haptic design* | A/B | 原则练习 + Quick Look `.ahap` |
| [Change iPhone sounds and vibrations](https://support.apple.com/guide/iphone/iph07c867f28/ios) | C | 铃声/短信可配震动；Haptics Always/Silent；System Haptics 总闸 |
| 本仓库 `AdvancedHapticsPlugin.swift` | 对照 | `playsHapticsOnly = true`；无 AHAP loader |

---

## 8. 波次怎么收束

每波结束写一小节「本轮结论」，只允许三种句子：

- **已回答 Qn：** …  
- **仍未知：** …（写下一波查询）  
- **不搬：** …（例如 CallKit、自动 AHAP）

三波之后应能写出一页 **设计规则备忘**（可另文 `HAPTICS-LANGUAGE.md`，未写之前本计划不是规范）：

- 何时 UIKit、何时 transient、何时 continuous、何时禁止  
- 声触是否同引擎  
- 静音 / 系统触感 / 游戏开关真值表  
- 过关乐句要不要做、多长、和 iris 谁对齐  

未收束前，代码保持现状。

---

## 9. 波次 1 结论（类型钉死）

**已回答 Q1（部分）、Q2、Q3（选型）、Q4（语言）、Q7：**

- **系统来电铃 ≠ App 可播的 AHAP。** 用户设置里「铃声 + 震动图案」（含自创振动录音）是系统服务。第三方不能当来电播放器。Core Haptics 文档把 **Continuous** 比成「ringtone 那种震」，那是 **手感隐喻**，不是开放铃声 API。
- **第三方能复现的**是：同一 `CHHapticPattern` / `.ahap` 时间线上排 `HapticContinuous` + `HapticTransient` + 可选 `AudioCustom`。官方 sample HapticSampler：`CHHapticEngine(audioSession:)` + `playPattern(from:)`。
- **旧路不搬：** `AudioServicesPlaySystemSound(kSystemSoundID_Vibrate)` 是整机长震，不是 Taptic 乐句；设置里「自创振动」是用户录音条，不是游戏 API。
- **设计三原则（WWDC19/21 + HIG Playing haptics）：**
  - **Causality：** 一拍一因。系统 pattern 不许挪用含义（success 不能既当过关又当失败）。
  - **Harmony：** 触的强弱/锐度和画面、声音同一拍；「两件乐器同一 tempo」。
  - **Utility：** 不为震而震。最好的触感是平时感觉不到、关掉会想念。HIG：**多数 App 偏好短触感配离散事件**；长跑触感更像游戏流程，用多了会稀释含义。
- **原语：** Transient = 手电筒按钮那种一下；Continuous = 信息「激光」那种持续震（HIG）/ 铃声那种震（Core Haptics 总览）。Intensity = 力度 0–1；Sharpness = 软圆有机 vs 脆机械。另有 Attack / Decay / Release / Sustained 包络。
- **HIG iOS 三档系统触感含义（玩法已在用，勿改义）：** Impact = 碰撞隐喻；Notification = 任务结果（success/warning/error）；Selection = 值在变。

**仍未知（交给波次 2）：** App 内 Core Haptics 是否尊重 System Haptics / 静音键；`playsHapticsOnly` 与音效插件抢 session。

**不搬：** CallKit、VoIP 后台铃、Android 波形数组。

---

## 10. 波次 2 结论（对准本壳）

**已回答 Q5、Q6、Q8：**

- **声触分层保持现状。** AUDIO.md：iOS `.ambient` + `.mixWithOthers`，静音拨片仍静音游戏效。HapticSampler 要声触同播才 `init(audioSession:)`。本插件 `playsHapticsOnly = true`：**有意丢掉音频事件、降启动延迟**。主 SFX 继续 Native Audio；震动继续只震。Harmony 靠 **同一时刻 `void` 两路**（`gameHaptics.x()` 旁 `audio.playSfx('x')`），不要把 wav 塞进 CH。
- **若将来 AHAP 带 AudioCustom：** 必须关 `playsHapticsOnly`、改 `init(audioSession:)`，并和 AUDIO.md 的 session 策略对账。**现在不做。** JS 已有 `playPattern(events)`，够编无声乐句；不必为铃声检索加 AHAP 文件桥。
- **静音 / 开关真值（官方 + 社区，标证据）：**
  - **UIKit `UIFeedbackGenerator`：** 系统决定是否播。文档写明仅当：有 Taptic、**前台**、**System Haptics 开**（及电量等）。Apple Forums：后台不播是预期（因果：人必须把震和当前 App 对上号）。
  - **System Haptics 开关：没有公开读取 API**（Forums：trust the system）。HIG 仍要求 **App 自备可关**。游戏 `enabled` 必须留下。
  - **Settings → Sounds & Haptics → Haptics Always / Silent / Never：** 用户指南针对 **铃声和提醒**，不是 in-app 游戏触感的合同。
  - **Accessibility → Touch → Vibration Off：** 社区视为总闸（含紧急警报）。App 无法、也不该绕过。
  - **Core Haptics 是否尊重 System Haptics：** 官方未写死。社区大量「关 System Haptics 后 UIKit 不震」。**不要把 CH 当「关了系统触感还能震」的后门**；也 **不要假设关 System Haptics 就等于我们的 `enabled=false`**。验收四格必须真机记。
- **生命周期：**
  - `playPattern(from:)` **fire-and-forget，播到完不能停，后发会叠**。同类型同时叠会糊。
  - 要停 / 循环 / seek → `CHHapticAdvancedPatternPlayer`（本插件连续震已用）。
  - `resetHandler`：媒体服务恢复后要 `start()` 并重建 player。本插件已 quiet restart。
  - `stoppedHandler`：来电打断、进后台、idle、systemError。停是正常生命周期，**下次播前必须再 start**。
  - 连续震默认 duration 30s：像铃不响就一直嗡，**游戏禁用这种长度**。
  - 进后台应 `stopContinuous`；过关乐句用有限长 `playPattern`，不要 loop。

**仍未知：** 真机四格里 CH vs UIKit 在 System Haptics 关时是否分叉（Q9 要测，检索给不了数字）。

**不搬：** 自动 wav→AHAP；把 `prepare` 加进 Swift；铃声循环 player。

---

## 11. 波次 3 结论（验收与能力对照）

**已回答 Q9（验收设计）、对照表：**

| 铃声能力 | 本插件 | 结论 |
|----------|--------|------|
| UIKit impact/notification/selection | 有，玩法在用 | 出手 / 过关继续走这里 |
| CH transient（stackImpact / playPattern） | 有，玩法未用 | 碰撞分级、过关乐句的「节拍点」用这个 |
| CH continuous + 50ms fade stop | 有，玩法未用 | 只给摩擦/长按；**不要当铃声循环** |
| AHAP 文件 loader | 无 | **不缺桥。** 乐句用现有 `playPattern` 字典即可 |
| AudioCustom 同引擎 | 被 `playsHapticsOnly` 关掉 | **保持关** |
| cooldown / 具名事件 | 无 | **缺口在游戏层**，不是 Swift |
| 读 System Haptics | 无 | **不补。** 信系统 + 自备开关 |

**验收四格（真机，模拟器不作数）：**

| | 游戏 `enabled` 开 | 游戏关 |
|--|--|--|
| 响铃 + System Haptics 开 | 出手 light/medium、过关 success 有震 | 不震 |
| 静音拨片 | **仍应有触感**（效按 AUDIO 应静音）；记 SFX 是否真静 | 不震 |
| System Haptics 关 | **记录** UIKit 与 `stackImpact` 是否都不震（预期 UIKit 不震；CH 记实测） | 不震 |
| Accessibility Vibration 关 | 任何路径都不震 | 不震 |

Finder Quick Look `.ahap`：WWDC21 官方设计步骤。本仓库若只走 JS `playPattern` 字典，可用同等 JSON 在 Mac 上预览；**不是发版必须品**。

过关视觉：overlay 前有 iris + 约 280ms。乐句应 **短于或对齐这段**，不要比 iris 还长。HIG：稀有事件才配得起比出手更长的触感。

---

## 12. 九问收束

| # | 结论 | 搬进工程？ |
|---|------|------------|
| Q1 | 系统铃是系统服务；App 用 AHAP/CH pattern 复现「声触同一拍」。不是两条旧长震。 | 原则是；不做来电 |
| Q2 | Causality / Harmony / Utility。出手短因短果；过关才允许短乐句；禁止每步 notification success。 | 是，设计规则如下节 |
| Q3 | 出手/非法 = Transient 或 UIKit impact。Continuous 只给长按类。过关 = 很短的 transient 串，或现成 notification success。连续默认 30s 禁用。 | 是 |
| Q4 | Intensity=力，Sharpness=材质。推箱比滑停更重更脆；非法更轻更钝。无官方「铃声包络数字」，不要抄死。 | 调参语言；数字留给手感回合 |
| Q5 | 保持两路：CH 只震 + Native Audio。不对齐就不要硬塞 AudioCustom。 | 是，不改插件旗 |
| Q6 | 铃声 Always/Silent 管提醒。UIKit 跟 System Haptics + 前台。App 必须自备开关。读不到系统开关。 | 是 |
| Q7 | 不碰 `kSystemSoundID_Vibrate`、不做客制振动录音器。 | 不搬 |
| Q8 | 有限长 `playPattern`；能停的才用 advanced player。后台停连续。reset 已有。不要 fire-and-forget 叠在出手上。 | 是 |
| Q9 | 真机四格 + Accessibility 总闸。Quick Look 可选。 | 验收；尚未跑真机 |

---

## 13. 设计规则备忘（检索产出，还不是 HAPTICS.md 规范）

未改 HAPTICS.md / 未加 `gameHaptics` 前，下列只约束「以后怎么接」，**不改现行代码**。

1. **系统 pattern 不挪用。** `notification('success')` 只表示任务完成（过关）。出手禁止 success。非法禁止 error 四连（那是系统 error 的含义）。
2. **离散走棋用短击。** 推箱 `impact('medium')` 或 CH transient；刹车/滑停 `light`；非法更轻。禁止 Continuous。
3. **铃声式长句极度稀有。** 若做，用 `playPattern` 有限长（建议 ≤ overlay/iris 时长），transient 做拍、必要时极短 continuous 做底；播完自停；新出手 **不要叠**（等或切掉）。
4. **不为震而震。** 十五关每步都 medium 会疲。Utility：同拍重复可 cooldown。
5. **可关。** 游戏开关是真值之一。关了仍可玩。不探测 System Haptics。
6. **声触不同引擎。** 对齐靠同时 fire。保持 `playsHapticsOnly`。
7. **只走 `haptics.ts`。** 节奏在游戏层。不新增 AHAP 文件桥，除非设计师交付 `.ahap` 且不想用字典。
8. **真机验收，不用模拟器。**

代码现状保持：插件能力已够；缺的是游戏层具名事件 + cooldown，不是再接一条铃。

