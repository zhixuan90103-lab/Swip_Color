# 文档索引

打开仓库先读根目录 [AGENTS.md](../AGENTS.md)。本页只排 docs 职责，避免两份规范打架。

| 文件 | 角色 |
|------|------|
| **ICE-PUZZLE.md** | **冰面推箱规则真源**（冰格/墙、①②、三星、手感2、出题铁律） |
| **LEVEL-RESEARCH.md** | **关卡检索计划**（路径规划 × 推箱；三轮已收束） |
| **LEVEL-KNOWLEDGE.md** | **关卡设计知识**（检索收敛 + 实装翻车，出题用） |
| **LEVEL-TEMPLATES.md** | **现行十五关**（与 `levels.ts` 一致） |
| ENGINEERING.md | 底座打包/适配 |
| MERGE.md | 双工程合并决策 |
| HAPTICS.md | 震动接入（插件怎么接上） |
| AUDIO.md | 音效接入/热路径（底座；事件名仍是旧合成遗留） |
| ENTRYPOINTS.md | 入口链 |

**规范优先级：** 玩法以 `ICE-PUZZLE.md` 为准；关卡出题检索以 `LEVEL-RESEARCH.md` 为准；出手默认 `FEEL2_DEFAULT`；音效管道以 `AUDIO.md` 为准；震动插件以 `HAPTICS.md` 为准。代码与文档冲突时改其中一侧，不要并列两套默认。
