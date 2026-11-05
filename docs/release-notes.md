## 花园王国 · 首个开源桌面版

- 女儿原画风格的八个彩笔世界，随机横版跳台、无限生命、单人及亲子双人模式。
- 九种宝物不同分值，拾取加分动画，本机 SQLite 成绩本与时间曲线。
- macOS / Windows 启动全屏，内置全部素材与中文手写字体，离线游玩。
- 自动检查 GitHub 正式新版，后台下载，休息时保存成绩后自动安装重启。
- `python build.py` 一键关闭本游戏旧进程、构建、安装、启动。

### 下载

- Mac Apple Silicon（M 系列）：`mac-arm64.dmg`
- Mac Intel：`mac-x64.dmg`
- Windows 常见 Intel / AMD 电脑：`win-x64.exe`
- Windows ARM 电脑：`win-arm64.exe`

ZIP 也是 Mac 自动更新包；`garden-update.json` 是更新清单，`SHA256SUMS.txt` 可校验下载文件。

目前 Mac 为 ad-hoc 签名，未做 Apple Developer ID 公证；Windows 未做发布者签名。首次打开可能出现系统来源确认，请仅从本仓库下载。Mac 请先移到“应用程序”目录运行。更新保留个人成绩；更新后需要重新选关，未结束的挑战会先保存。

本机已验证 Mac ARM64；其他架构提供构建产物，尚无对应真机游戏验收。
