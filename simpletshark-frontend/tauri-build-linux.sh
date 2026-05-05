#!/bin/bash

# Tauri 打包脚本（Linux/Ubuntu）
# 用法: npm run tauri-build-linux-app  (仅生成可执行文件)
#      npm run tauri-build-linux      (生成deb安装包)

set -e

# 参数：app 或 deb (默认deb)
TARGET="${1:-deb}"

# 获取脚本所在目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BUILD_TYPE="Debian Package"
case "$TARGET" in
  app)
    BUILD_TYPE="App Only"
    ;;
  deb)
    BUILD_TYPE="Debian Package"
    ;;
esac

echo "======================================"
echo "  Tauri Linux Build ($BUILD_TYPE)"
echo "======================================"
echo ""

# 步骤 1: 准备资源文件
echo "[1/3] 正在准备资源文件..."
bash prepare-resources.sh

# 步骤 2: 执行 Tauri 打包
echo "[2/3] 正在执行 Tauri 打包..."
source $HOME/.cargo/env

# 在 Linux 上加载平台专用配置层
export TAURI_CONFIG_PATH="$SCRIPT_DIR/src-tauri/tauri.linux.conf.json"

# 根据目标类型进行打包
case "$TARGET" in
  app)
    # 仅构建可执行文件，不生成安装包
    cargo build --release --manifest-path src-tauri/Cargo.toml
    ;;
  deb)
    tauri build --bundles deb
    ;;
  *)
    echo "错误: 未知的目标类型 '$TARGET'"
    echo "支持的目标: app, deb"
    exit 1
    ;;
esac

# 步骤 3: 重命名 deb 文件（添加时间戳）
if [ "$TARGET" = "deb" ]; then
  echo "[3/4] 正在重命名 deb 文件..."

  # 获取版本号（从 package.json 读取）
  VERSION=$(node -p "require('$SCRIPT_DIR/package.json').version")

  # 获取架构信息
  ARCH=$(uname -m)

  # 获取年月日时分秒格式的时间戳
  TIMESTAMP=$(date +%Y%m%d%H%M%S)

  # 定位原始 deb 文件
  DEB_DIR="src-tauri/target/release/bundle/deb"
  ORIGINAL_DEB=$(find "$DEB_DIR" -name "*.deb" -type f | head -n 1)

  if [ -n "$ORIGINAL_DEB" ]; then
    # 新的文件名格式：simpletshark_版本_时间戳_架构.deb
    NEW_DEB_NAME="simpletshark_${VERSION}_${TIMESTAMP}_${ARCH}.deb"
    NEW_DEB_PATH="$DEB_DIR/$NEW_DEB_NAME"

    mv "$ORIGINAL_DEB" "$NEW_DEB_PATH"
    echo "✓ deb 文件已重命名为: $NEW_DEB_NAME"
  else
    echo "警告: 未找到 deb 文件"
  fi
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
case "$TARGET" in
  app)
    echo "输出目录: src-tauri/target/release/"
    ;;
  deb)
    echo "输出目录: src-tauri/target/release/bundle/deb/"
    if [ -n "$NEW_DEB_NAME" ]; then
      echo "deb 文件: $NEW_DEB_NAME"
    fi
    ;;
esac
echo ""
