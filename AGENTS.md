# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## 已确认的游戏方向

- 面向 6～8 岁孩子，忠实保留用户女儿的彩笔绘画风格和彩色素材。
- 主玩法为网页 3D 横版平台跳跃，随机地图、无限生命、掉落后温柔恢复。
- 跳台参考马里奥式横版闯关节奏，加入适龄小怪、明显的高低落差和可上下切换的路线，沿用现有彩笔画风。此类关卡改版先出设计稿，再按选定方案开发。
- 已选定三种路线同时实现，按关卡分别使用阶梯分层、树屋升降回环、地面与地下切换；保留小怪和彩笔画风。
- 允许标准 Node 项目与依赖，目标家庭 Windows 电脑；不再要求单文件 HTML。
- 保留原花园互动与原画画展；已获授权开源 GitHub 仓库并发布桌面 Release，网页公开部署另行授权。

- 背景按 11 幅原画的不同元素组合成主题关卡，关卡内随机平台；积分按每次进入一关记录。
- 本机 Node 服务通过 SQLite 持久化积分，并提供日期/关卡筛选、汇总与时间曲线；数据不得作为演示数据随交付包发布。

- 跳台收集物不能只有花朵，应使用原画风格的爱心、星星、彩虹、冰淇淋等多种元素，按关卡混合出现。

- 关卡扩展到海边、草地、雪地、森林和卡通世界；融合适龄卡通元素，同时沿用女儿的彩笔画风。

- 按钮、文字、弹窗也统一使用手绘风格；中文手写字体随项目本地打包，保证清楚易读与足够大的点击区域。

- 不同宝物使用不同分值，拾取时显示加分和总分变化；旧历史积分保留，新局按新规则计分。

- 使用 Electron 作为桌面基座，支持 macOS 与 Windows，启动即全屏；提供窗口切换及保存退出入口。应用图标沿用彩笔城堡风格，包含 ICNS、ICO 和 PNG。
- 开发环境采用最新 Node LTS；Electron、React、Vite 等无 LTS 分支的组件采用受支持的稳定版并锁定版本。桌面存档位于用户数据目录，打包排除家庭存档，验证使用独立测试目录。

- GitHub 稳定 Release 是桌面更新来源；后台检查下载，仅在休息时保存成绩后安装重启。不得打包或公开家庭存档、凭据和测试产物。
- `python build.py` 一键停止本项目旧应用、构建、安装并启动；不得按通用 Electron/Node 进程名清场。
