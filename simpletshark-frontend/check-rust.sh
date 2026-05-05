#!/bin/bash

# 检查 Rust 是否安装的脚本

echo "检查 Rust 安装状态..."

if command -v cargo &> /dev/null; then
    echo "✅ Rust 已安装"
    echo "Rust 版本: $(rustc --version)"
    echo "Cargo 版本: $(cargo --version)"
    echo ""
    echo "可以运行以下命令："
    echo "  npm run tauri-dev    # 开发模式"
    echo "  npm run tauri-build  # 生产构建"
else
    echo "❌ Rust 未安装"
    echo ""
    echo "请运行以下命令安装 Rust："
    echo ""
    echo "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo ""
    echo "安装完成后运行："
    echo "source \$HOME/.cargo/env"
    echo ""
    echo "详细说明请查看 INSTALL_RUST.md"
    exit 1
fi
