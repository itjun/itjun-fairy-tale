# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## 已确认的游戏方向

- 面向 6～8 岁孩子，忠实保留用户女儿的彩笔绘画风格和彩色素材。
- 主玩法为网页 3D 横版平台跳跃，随机地图、无限生命、掉落后温柔恢复。
- 允许标准 Node 项目与依赖，目标家庭 Windows 电脑；不再要求单文件 HTML。
- 保留原花园互动与原画画展；未获公开部署授权。

- 背景按 11 幅原画的不同元素组合成主题关卡，关卡内随机平台；积分按每次进入一关记录。
- 本机 Node 服务通过 SQLite 持久化积分，并提供日期/关卡筛选、汇总与时间曲线；数据不得作为演示数据随交付包发布。

- 跳台收集物不能只有花朵，应使用原画风格的爱心、星星、彩虹、冰淇淋等多种元素，按关卡混合出现。

- 关卡扩展到海边、草地、雪地、森林和卡通世界；融合适龄卡通元素，同时沿用女儿的彩笔画风。

- 按钮、文字、弹窗也统一使用手绘风格；中文手写字体随项目本地打包，保证清楚易读与足够大的点击区域。
