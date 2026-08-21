#!/data/data/com.termux/files/usr/bin/bash
# 启动手机本地的 DeepSeek Harness
# 启动后,用手机浏览器或"DeepSeek Harness"App 打开 http://127.0.0.1:3080
set -e

export DSH_HOME="$HOME/.dsh"
mkdir -p "$HOME/dsh-workspace"
cd "$HOME/dsh-workspace"

echo "正在启动 harness(首次启动需要几十秒)..."
echo "启动完成后,在手机浏览器打开: http://127.0.0.1:3080"
exec dsh web --host 127.0.0.1 --port 3080 --no-open
