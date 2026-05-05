#!/bin/bash

# 同步版本号脚本
# 从 package.json 读取版本号，自动同步到其他配置文件

set -e

# 获取脚本所在目录（项目根目录）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 从 package.json 读取版本号
VERSION=$(node -p "require('./package.json').version")

if [ -z "$VERSION" ]; then
    echo "❌ 错误：无法从 package.json 读取版本号"
    exit 1
fi

echo "📦 同步版本号: $VERSION"

# 更新 src-tauri/Cargo.toml
echo "  → 同步到 src-tauri/Cargo.toml"
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml
else
    # Linux/Windows
    sed -i "s/^version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml
fi

# 更新 src-tauri/tauri.conf.json
echo "  → 同步到 src-tauri/tauri.conf.json"
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json
else
    # Linux/Windows
    sed -i "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json
fi

echo "✅ 版本号同步完成: $VERSION"
