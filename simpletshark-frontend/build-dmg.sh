#!/bin/bash

# SimpleTshark DMG 创建脚本
# 用法: ./build-dmg.sh
# 前提：.app 文件已经在 src-tauri/target/release/bundle/macos/ 目录下

set -e  # 遇到错误立即退出

# 获取脚本所在目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "======================================"
echo "  SimpleTshark DMG 创建脚本"
echo "======================================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# hdiutil/diskutil 辅助函数，必要时自动切换 sudo
USE_SUDO_FOR_HDIUTIL=0
USE_SUDO_FOR_DISKUTIL=0

run_hdiutil() {
    if [[ $USE_SUDO_FOR_HDIUTIL -eq 1 ]]; then
        sudo hdiutil "$@"
        return
    fi

    if hdiutil "$@"; then
        return 0
    fi

    local status=$?
    echo -e "${RED}hdiutil $* 执行失败 (exit ${status})${NC}"
    if command -v sudo >/dev/null 2>&1; then
        echo "尝试使用 sudo hdiutil $*"
        if sudo hdiutil "$@"; then
            USE_SUDO_FOR_HDIUTIL=1
            return 0
        fi
    fi

    return $status
}

run_diskutil() {
    if [[ $USE_SUDO_FOR_DISKUTIL -eq 1 ]]; then
        sudo diskutil "$@"
        return
    fi

    if diskutil "$@"; then
        return 0
    fi

    local status=$?
    echo -e "${RED}diskutil $* 执行失败 (exit ${status})${NC}"
    if command -v sudo >/dev/null 2>&1; then
        echo "尝试使用 sudo diskutil $*"
        if sudo diskutil "$@"; then
            USE_SUDO_FOR_DISKUTIL=1
            return 0
        fi
    fi

    return $status
}

# 确保 Tauri 使用 macOS 专用配置
if [[ "$OSTYPE" == "darwin"* ]]; then
    export TAURI_CONFIG_PATH="$SCRIPT_DIR/src-tauri/tauri.macos.conf.json"
fi

# 检查 .app 是否存在
APP_PATH="src-tauri/target/release/bundle/macos/SimpleTshark.app"
if [ ! -d "$APP_PATH" ]; then
    echo -e "${RED}错误: 找不到 .app 文件: $APP_PATH${NC}"
    echo "请先运行 'npm run tauri-build-mac-app' 来生成 .app 文件"
    exit 1
fi

# 清理所有已挂载的 SimpleTshark 相关卷
echo "正在检查并清理已挂载的卷..."
for vol in /Volumes/SimpleTshark*; do
    if [ -d "$vol" ]; then
        echo "卸载: $vol"
        run_hdiutil detach "$vol" -force >/dev/null 2>&1 || run_diskutil unmount force "$vol" >/dev/null 2>&1 || true
    fi
done
sleep 1

# 创建 DMG 文件
echo -e "${BLUE}[1/1]${NC} 正在创建 DMG 文件..."

# 获取版本号（从 package.json 读取）
VERSION=$(node -p "require('$SCRIPT_DIR/package.json').version")

# 获取架构信息
ARCH=$(uname -m)

# 获取年月日时分秒格式的时间戳
TIMESTAMP=$(date +%Y%m%d%H%M%S)

# 创建 DMG
cd src-tauri/target/release/bundle/macos
DMG_NAME="SimpleTshark_${VERSION}_${TIMESTAMP}_${ARCH}.dmg"
DMG_PATH="../../${DMG_NAME}"

# 删除旧的 DMG 文件（如果存在）
if [ -f "${DMG_PATH}" ]; then
    echo "删除旧的 DMG 文件..."
    rm -f "${DMG_PATH}"
fi

echo "正在创建 DMG 文件: ${DMG_NAME}"

# 创建临时目录用于 DMG 内容
TEMP_DIR="../../dmg_temp_${TIMESTAMP}"
rm -rf "${TEMP_DIR}"
mkdir -p "${TEMP_DIR}"

# 移除隔离属性，防止图标显示禁止浮层
echo "正在移除隔离属性..."
xattr -cr "SimpleTshark.app"

# 复制 app 到临时目录
cp -R "SimpleTshark.app" "${TEMP_DIR}/"

# 创建 Applications 文件夹的符号链接
ln -s /Applications "${TEMP_DIR}/Applications"

# 创建临时 DMG（读写模式）
TEMP_DMG="../../temp_${TIMESTAMP}.dmg"
rm -f "${TEMP_DMG}"

# 使用时间戳创建唯一卷名，完全避免冲突
UNIQUE_VOLNAME="SimpleTshark-Install-${TIMESTAMP}"
MOUNT_DIR="/Volumes/${UNIQUE_VOLNAME}"

# 检查并卸载已存在的同名卷
if [ -d "${MOUNT_DIR}" ]; then
    echo "检测到已挂载的卷，正在卸载..."
    run_hdiutil detach "${MOUNT_DIR}" -force >/dev/null 2>&1 || true
    sleep 1
fi

echo "正在创建临时 DMG..."
run_hdiutil create -volname "${UNIQUE_VOLNAME}" -srcfolder "${TEMP_DIR}" -ov -format UDRW "${TEMP_DMG}"

# 挂载临时 DMG
echo "正在挂载 DMG 进行配置..."
run_hdiutil attach "${TEMP_DMG}" -mountpoint "${MOUNT_DIR}"

# 等待挂载完成
sleep 2

# 复制并缩放背景图片（从 1200x800 缩放到 600x400）
BG_DIR="${MOUNT_DIR}/.background"
mkdir -p "${BG_DIR}"
# 使用 sips 命令缩放图片
sips -z 400 600 "../../../../../dmg-assets/dmg-background.png" --out "${BG_DIR}/background.png"

# 使用 AppleScript 配置 DMG 窗口外观
# 窗口大小匹配背景图片 600x400
echo "正在配置 DMG 窗口布局..."
osascript <<EOD
tell application "Finder"
    tell disk "${UNIQUE_VOLNAME}"
        open
        set current view of container window to icon view
        set toolbar visible of container window to false
        set statusbar visible of container window to false
        -- 窗口尺寸 600x400，加上标题栏高度 (22px)
        set the bounds of container window to {100, 100, 700, 522}
        set viewOptions to the icon view options of container window
        set arrangement of viewOptions to not arranged
        set icon size of viewOptions to 100
        set background picture of viewOptions to file ".background:background.png"
        set text size of viewOptions to 14
        set shows item info of viewOptions to false
        set shows icon preview of viewOptions to true
        -- 设置图标位置（基于 600x400 尺寸调整）：
        -- 左侧 app 位置，右侧 Applications 位置
        set position of item "SimpleTshark.app" of container window to {150, 180}
        set position of item "Applications" of container window to {450, 180}
        close
        open
        update without registering applications
        delay 2
    end tell
end tell
EOD

# 卸载 DMG
echo "正在卸载 DMG..."
sync
sleep 2
run_hdiutil detach "${MOUNT_DIR}" -force || {
    echo "警告: 无法正常卸载，尝试强制卸载..."
    run_diskutil unmount force "${MOUNT_DIR}" >/dev/null 2>&1 || true
    sleep 1
}

# 转换为压缩的只读 DMG
echo "正在压缩 DMG 文件..."
run_hdiutil convert "${TEMP_DMG}" -format UDZO -o "${DMG_PATH}"

# 清理临时文件
rm -f "${TEMP_DMG}"
rm -rf "${TEMP_DIR}"

cd ../../../../..

# 显示结果
echo ""
echo -e "${GREEN}======================================"
echo "  DMG 创建完成！"
echo "======================================${NC}"
echo ""
echo -e "生成的文件："
echo -e "  ${GREEN}✓${NC} DMG 文件: src-tauri/target/release/${DMG_NAME}"
echo ""

# 显示 DMG 文件大小
DMG_SIZE=$(du -h "src-tauri/target/release/${DMG_NAME}" | cut -f1)
echo -e "DMG 文件大小: ${DMG_SIZE}"
echo ""
