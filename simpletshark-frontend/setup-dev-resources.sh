#!/bin/bash

# 自动设置开发环境的资源文件
# 根据当前平台，将对应平台的资源文件直接复制到 target/debug 和 target/release 根目录
# 优化版本：只在资源变化时才复制，避免不必要的 I/O 操作

# 获取脚本所在目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 目标目录（直接在 debug/release 根目录，模拟生产环境）
DEBUG_DIR="src-tauri/target/debug"
RELEASE_DIR="src-tauri/target/release"
CHECKSUM_FILE="$DEBUG_DIR/.resource_checksum"

# 计算目录的 checksum
calculate_dir_checksum() {
    local dir=$1
    if [ -d "$dir" ]; then
        # 使用 find + md5 计算目录内所有文件的 checksum
        # 只检查文件修改时间和大小，更快
        find "$dir" -type f -exec stat -f "%m %z %N" {} \; 2>/dev/null | sort | md5
    else
        echo "missing"
    fi
}

# 检查资源是否需要更新
needs_update() {
    local source_dir=$1

    # 如果源目录不存在，跳过
    if [ ! -d "$source_dir" ]; then
        return 1  # false, no update needed
    fi

    # 如果目标文件不存在，需要复制
    if [ ! -f "$DEBUG_DIR/tshark_server" ] && [ ! -f "$DEBUG_DIR/tshark_server_helper.exe" ]; then
        return 0  # true, needs update
    fi

    # 计算 checksum
    local source_checksum=$(calculate_dir_checksum "$source_dir")
    local stored_checksum=""

    if [ -f "$CHECKSUM_FILE" ]; then
        stored_checksum=$(cat "$CHECKSUM_FILE" 2>/dev/null)
    fi

    # 比较 checksum
    if [ "$source_checksum" != "$stored_checksum" ]; then
        return 0  # true, needs update
    else
        return 1  # false, no update needed
    fi
}

# 保存 checksum
save_checksum() {
    local source_dir=$1
    local checksum=$(calculate_dir_checksum "$source_dir")

    mkdir -p "$(dirname "$CHECKSUM_FILE")"
    echo "$checksum" > "$CHECKSUM_FILE"
}

# 复制资源文件
copy_resources() {
    local source_dir=$1
    local platform_name=$2

    echo "  → 复制 $platform_name 资源到 target/debug 和 target/release"

    # 创建目标目录
    mkdir -p "$DEBUG_DIR"
    mkdir -p "$RELEASE_DIR"

    # 清理旧的 resources 子目录（如果存在）
    rm -rf "$DEBUG_DIR/resources"
    rm -rf "$RELEASE_DIR/resources"

    # 复制文件到 debug 和 release 目录（直接复制，不创建子目录）
    if command -v rsync &> /dev/null; then
        rsync -a "$source_dir/" "$DEBUG_DIR/"
        rsync -a "$source_dir/" "$RELEASE_DIR/"
    else
        cp -rf "$source_dir"/* "$DEBUG_DIR/"
        cp -rf "$source_dir"/* "$RELEASE_DIR/"
    fi

    # 设置执行权限
    if [[ "$OSTYPE" == "darwin"* ]]; then
        chmod +x "$DEBUG_DIR/tshark_server" 2>/dev/null || true
        chmod +x "$RELEASE_DIR/tshark_server" 2>/dev/null || true
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        chmod +x "$DEBUG_DIR/tshark_server" 2>/dev/null || true
        chmod +x "$RELEASE_DIR/tshark_server" 2>/dev/null || true
    fi

    # 保存 checksum
    save_checksum "$source_dir"
}

# 主流程
main() {
    echo "🔧 检查 Tauri 开发环境资源文件..."

    # 根据当前平台确定源目录
    local source_dir=""
    local platform_name=""

    if [[ "$OSTYPE" == "darwin"* ]]; then
        source_dir="resources/tshark_mac"
        platform_name="tshark_mac"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        source_dir="resources/tshark_win"
        platform_name="tshark_win"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        source_dir="resources/tshark_linux"
        platform_name="tshark_linux"
    else
        echo "❌ 未知平台: $OSTYPE"
        exit 1
    fi

    # 检查源目录是否存在
    if [ ! -d "$source_dir" ]; then
        echo "❌ 资源目录不存在: $source_dir"
        exit 1
    fi

    # 检查是否需要更新
    if needs_update "$source_dir"; then
        copy_resources "$source_dir" "$platform_name"
        echo ""
        echo "✅ 资源文件已更新！"
        echo ""
        echo "📋 Debug 目录中的资源文件:"
        ls -lh "$DEBUG_DIR"/tshark_server* "$DEBUG_DIR"/tshark_fields.db || echo "部分文件不存在"
    else
        echo "  ✓ $platform_name 资源已是最新（跳过复制）"
        echo ""
        echo "✅ 所有资源文件已是最新，无需更新"
    fi

    echo ""
    echo "当前系统使用: $platform_name"
}

# 运行主流程
main
