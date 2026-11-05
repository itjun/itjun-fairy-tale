# 桌面应用图标

- 工具：内置 Image Gen。
- 风格参考：`public/assets/garden.png`，延续女儿原画的蓝色尖顶、粉色墙、青绿墙面和粗彩笔留白。
- 源文件：`build/icon-source.png`；生成过程不修改原参考图。
- 格式转换：`npm run icons` 通过 Sharp 等比例缩放，保留透明外围，并封装 ICNS / ICO；不重新绘制图像。
- 用途：macOS Dock / Finder / DMG、Windows 安装程序 / 快捷方式 / 任务栏、网页 favicon。

## 完整提示词

Create a production desktop app icon for a children's hand-drawn game 花园王国. Use the provided garden drawing strictly as STYLE REFERENCE: thick wobbly charcoal outlines, intense felt-tip pink, cobalt blue, turquoise and lime green, white gaps in scribbled marker fills. Square 1024x1024 icon. A single simple cheerful castle with three blue pointed roofs, pink upper wall and turquoise lower wall, one yellow doorway, small rainbow arch above and one pink flower beside the castle. Very bold compact silhouette recognizable at 32px, few large shapes, no tiny details. Centered on a warm ivory paper rounded-square tile filling 88 percent of canvas; outside tile transparent. Child's own rough marker drawing, not glossy, not 3D, not vector-clean. No text, no letters, no watermark. Reference image is not an edit target.
