#!/bin/bash

# SimpleTshark 开发模式启动脚本

# 获取脚本所在目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 清理函数
cleanup() {
    local exit_code=$?
    echo ""
    echo "🧹 清理进程和临时文件..."

    # 停止前端服务器
    if [ ! -z "$FRONTEND_PID" ]; then
        echo "  → 停止前端服务器 (PID: $FRONTEND_PID)"
        kill $FRONTEND_PID 2>/dev/null || true
        wait $FRONTEND_PID 2>/dev/null || true
    fi

    # 清理 src-tauri/ 下的资源文件
    echo "  → 清理临时资源文件"
    bash "$SCRIPT_DIR/cleanup-dev-resources.sh"

    exit $exit_code
}

# 捕获退出信号，确保清理
trap cleanup EXIT INT TERM SIGHUP

echo "🚀 启动 SimpleTshark 开发环境..."

# 准备资源文件（用于 Tauri 编译时检查，会自动同步版本号）
echo "📂 准备资源文件..."
bash "$SCRIPT_DIR/prepare-resources.sh"

# 设置开发环境资源（复制到 target/debug）
echo "📂 设置开发资源..."
bash "$SCRIPT_DIR/setup-dev-resources.sh"

# 启动前端开发服务器（后台）
echo "🌐 启动前端开发服务器..."
BROWSER=none npm run dev &
FRONTEND_PID=$!

# 等待前端服务器启动
echo "⏳ 等待前端服务器启动..."
sleep 10

# 检查前端服务器是否正常
if curl -s http://localhost:3000 > /dev/null; then
    echo "✅ 前端服务器已启动"
else
    echo "❌ 前端服务器启动失败"
    kill $FRONTEND_PID 2>/dev/null
    exit 1
fi

# 启动 Tauri
echo "🦀 启动 Tauri 应用..."
cd src-tauri

if [ -f "$HOME/.cargo/env" ]; then
    source "$HOME/.cargo/env"
fi

cargo run

# cleanup 函数会在脚本退出时自动调用（通过 trap）
