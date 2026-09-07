# portrait-webgpu-base

**最稳健竖屏底座**：合并 **niantu** 的适配/TS/设备预览 + **three-webgpu-cap-shell** 的 Capacitor 打包、安全区、bootstrap。

| 文档 | 用途 |
|------|------|
| [AGENTS.md](./AGENTS.md) | AI / 新窗口第一入口 |
| [docs/README.md](./docs/README.md) | **docs 索引与规范优先级** |
| [docs/ICE-PUZZLE.md](./docs/ICE-PUZZLE.md) | **冰面推箱规则真源** |
| [docs/LEVEL-TEMPLATES.md](./docs/LEVEL-TEMPLATES.md) | **现行十五关** |
| [docs/ENGINEERING.md](./docs/ENGINEERING.md) | 底座打包 / 适配 |
| [docs/HAPTICS.md](./docs/HAPTICS.md) | 震动接入 |

## 30 秒上手

```bash
npm install
npm run dev
# → http://127.0.0.1:5210/
```

应看到：桌面手机框、冰面推箱第 1 关。右上角 **手机/Pad** 切换。滑动出手与旧 2048 手感 2 相同（要甩，慢拖不走）。十五关可连续「下一关」。

## iOS 真机

```bash
npm run ios:bootstrap   # 首次
npm run cap:open
# Xcode: Team → 真机 → Run
```

日常只改网页：`npm run cap:sync`。改 Swift / 第一次：`ios:bootstrap`（会改 SceneDelegate，否则真机 `plugin: false`）。

装真机前改 `capacitor.config.ts` 的 `appId`，避免和已装 App 冲突。

## 复用到新游戏

1. 复制本目录  
2. 改 `capacitor.config.ts` 的 `appId` / `appName`  
3. 玩法在 `src/game/*`，规则见 [docs/ICE-PUZZLE.md](./docs/ICE-PUZZLE.md)  
4. **保留** adapt / create-renderer / haptics / plugins / `base: './'`  
