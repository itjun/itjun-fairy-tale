@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 26.13 或更高的 26 LTS 版本，再运行本文件。
  pause
  exit /b 1
)
if not exist node_modules (
  echo 正在安装游戏组件，首次安装需要联网……
  call npm ci
  if errorlevel 1 goto failed
)
echo 正在准备花园王国……
call npm run build
if errorlevel 1 goto failed
echo 正在打开全屏桌面版……
call npm run desktop:run
if errorlevel 1 goto failed
exit /b 0
:failed
echo 启动失败，请查看上方提示。请确认 Node 版本和 4173 端口没有被其他程序占用。
pause
exit /b 1
