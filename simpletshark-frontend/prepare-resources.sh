#!/bin/bash

# 准备打包资源脚本
# 将对应平台的 tshark 文件复制到 src-tauri 目录（用于 tauri build）

set -e

# 获取脚本所在目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "正在准备打包资源..."

# 同步版本号
echo "  → 同步版本号..."
bash sync-version.sh

# 清理旧的打包资源
rm -rf src-tauri/tshark_server*
rm -rf src-tauri/tshark_fields.db

# 检测当前平台并复制对应的资源文件
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - 复制 tshark_mac 里面的内容到 src-tauri
    echo "检测到 macOS 平台，复制 tshark_mac/* -> src-tauri/"
    cp -r resources/tshark_mac/* src-tauri/
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # Windows - 复制 tshark_win 里面的内容到 src-tauri
    echo "检测到 Windows 平台，复制 tshark_win/* -> src-tauri/"
    cp -r resources/tshark_win/* src-tauri/
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - 复制 tshark_linux 里面的内容到 src-tauri
    echo "检测到 Linux 平台，复制 tshark_linux/* -> src-tauri/"
    cp -r resources/tshark_linux/* src-tauri/
else
    echo "未知平台: $OSTYPE"
    exit 1
fi

echo "资源准备完成！"
