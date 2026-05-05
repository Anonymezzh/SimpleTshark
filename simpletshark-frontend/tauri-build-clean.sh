#!/bin/bash

# Tauri 打包脚本（带清理功能）
# 用法: npm run tauri-build-mac-app  (仅生成.app)
#      npm run tauri-build-mac      (生成.app和.dmg)

set -e

# 参数：app 或 dmg (默认dmg)
TARGET="${1:-dmg}"

# 获取脚本所在目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BUILD_TYPE="App Bundle"
if [ "$TARGET" = "dmg" ]; then
  BUILD_TYPE="DMG Installer"
fi

echo "======================================"
echo "  Tauri macOS Build ($BUILD_TYPE)"
echo "======================================"
echo ""

# 步骤 1: 准备资源文件
echo "[1/4] 正在准备资源文件..."
bash prepare-resources.sh

# 步骤 2: 执行 Tauri 打包
echo "[2/4] 正在执行 Tauri 打包..."
source $HOME/.cargo/env

# 在 macOS 上加载平台专用配置层
if [[ "$OSTYPE" == "darwin"* ]]; then
  export TAURI_CONFIG_PATH="$SCRIPT_DIR/src-tauri/tauri.macos.conf.json"
fi

# 仅生成 .app
tauri build --bundles app

# 步骤 3: 根据目标类型生成 DMG
if [ "$TARGET" = "dmg" ]; then
  echo "[3/4] 正在生成 DMG 安装包..."
  bash build-dmg.sh
else
  echo "[3/4] 跳过 DMG 生成（仅 App Bundle）"
fi

# 步骤 4: 清理临时文件
echo "[4/4] 正在清理临时文件..."
rm -rf src-tauri/tshark_server*
rm -rf src-tauri/tshark_fields.db
echo "✓ 临时文件清理完成"

echo ""
echo "======================================"
echo "  打包完成！"
echo "======================================"
echo ""
if [ "$TARGET" = "dmg" ]; then
  echo "输出目录: src-tauri/target/release/bundle/dmg/"
else
  echo "输出目录: src-tauri/target/release/bundle/app/"
fi
echo ""
