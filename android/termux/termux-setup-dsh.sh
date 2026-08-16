#!/data/data/com.termux/files/usr/bin/bash
# DeepSeek Harness 手机本地版 - 一键安装(在 Termux 里运行)
set -e

echo "=== [1/4] 更新 Termux 软件源 ==="
pkg update -y
pkg upgrade -y

echo "=== [2/4] 安装 Node.js 与构建工具 ==="
pkg install -y nodejs-lts git build-essential python

echo "=== [3/4] 授权访问手机文件(会弹出系统授权窗口,请点允许) ==="
termux-setup-storage || echo "授权跳过,仍可读写 Termux 目录;如需读写相册/下载,请重跑本脚本"

echo "=== [4/4] 安装 DeepSeek Harness ==="
if npm install -g @deepseek-ai/dsh 2>/dev/null; then
  echo "安装成功"
else
  echo "部分原生依赖编译失败,尝试忽略脚本安装(核心功能仍可用)..."
  npm install -g @deepseek-ai/dsh --ignore-scripts || true
fi

mkdir -p "$HOME/dsh-workspace"
echo ""
echo "安装完成!"
echo "接下来运行:  bash termux-start-dsh.sh"
