# 素材与第三方说明

- 原画：花园王国小画家。由作品监护人提供并授权随本项目开源发布，适用根目录 MIT 许可；保持匿名署名。
- 角色、场景、界面纹理、应用图标：参考原画风格用 Image Gen 生成，自有素材按 MIT 发布。生成提示词记录在 `docs/asset-prompts*.md`。卡通角色为原创设计。
- 中文字体：霞鹜文楷（LXGW WenKai），https://github.com/lxgw/LxgwWenKai 。完整 SIL Open Font License 与字体版权声明位于 `public/fonts/OFL.txt`，不受项目 MIT 覆盖。
- Electron / Chromium 的第三方许可随安装包附带；前端依赖包括 React、Three.js、Chart.js、Phosphor Icons。具体依赖版本由 `package-lock.json` 锁定，构建保留库的许可证注释。

公开仓库及安装包不含家庭 SQLite 存档、个人成绩、QA 截图和认证凭据。游戏无需账户，不收集游戏记录；检查更新会向 GitHub 请求版本及安装包，GitHub 会接收正常网络请求信息。

## 小游戏离线引导语音

`public/audio/guidance/` 为游戏自有引导文案的预生成音频，使用 Microsoft `zh-CN-XiaoxiaoNeural` 普通话女声。文案与声音参数记录在同目录 `manifest.json`。游戏运行时只播放本地文件，不向语音服务发送玩家数据。

开发生成工具为 [edge-tts](https://github.com/rany2/edge-tts) 7.3.1（不随桌面包分发）；音色说明见 [Microsoft 语音支持文档](https://learn.microsoft.com/azure/ai-services/speech-service/language-support)。本段仅说明生成来源，不将合成语音冒充真人录音。

## 跳台肉鸽扩展素材

新增九种小怪、三种武器、工作台、强化图标、彩笔平台和树根洞素材由 Image Gen 参考已确认设计稿生成，沿用本项目的彩笔画风；自有素材按 MIT 发布。视觉依据及资产清单位于 `docs/design/roguelite-expansion/`。原始女孩和爸爸素材保持不变。

## 四位单人角色与出发营地

妈妈、姐姐、妹妹各自的站立和攻击图片，以及出发营地背景由 Image Gen 参考女儿第 7 幅原画与已选营地设计稿生成；爸爸沿用原素材。保留各自发型、衣服、原画线条和身高差异，生成及实现说明见 `docs/design/single-player-characters/README.md`。自有素材按 MIT 发布。
