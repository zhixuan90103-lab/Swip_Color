# 文档索引

打开仓库先读根目录 [AGENTS.md](../AGENTS.md)。本页只排 docs 职责，避免两份规范打架。

| 文件 | 角色 |
|------|------|
| **ICE-PUZZLE.md** | **冰面推箱规则真源**（冰格/墙、①②、三星、手感2、出题铁律、十五关怎么排） |
| **LEVEL-RESEARCH.md** | **关卡检索计划**（路径规划 × 推箱；三轮已收束） |
| **LEVEL-KNOWLEDGE.md** | **关卡设计知识**（母本/变种、检查表、实装翻车） |
| **LEVEL-TEMPLATES.md** | **现行十五关**（设计思路 + 朝向表，与 `levels.ts` 一致） |
| **VISUAL.md** | **画面/资源真源**（贴图路径、托盘布局、调参、层级） |
| **YOU-MOTION.md** | **运动 juice 真源**（角色、箱子、格子 Additive、领星） |
| ENGINEERING.md | 底座打包/适配 |
| MERGE.md | 双工程合并决策 |
| HAPTICS.md | 震动接入（插件怎么接上） |
| AUDIO.md | 音效接入/热路径（底座；事件名仍是旧合成遗留） |
| ENTRYPOINTS.md | 入口链 |

**规范优先级：** 玩法 → `ICE-PUZZLE.md`；画面/贴图/调参 → `VISUAL.md`；运动/juice → `YOU-MOTION.md`；出题检索 → `LEVEL-RESEARCH.md`；出手 → `FEEL2_DEFAULT`；音效 → `AUDIO.md`；震动 → `HAPTICS.md`。代码与文档冲突时改其中一侧，不要并列两套默认。表现数字只写在 YOU-MOTION / 对应 ts 导出常量。
