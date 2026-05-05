# SimpleTshark 构建指南

## 📦 可用命令

### React 开发和构建

```bash
# 启动 React 开发服务器 (http://localhost:3000)
npm start

# 构建 React 生产版本
npm run build
```

### Tauri 开发

```bash
# 启动 Tauri 开发环境（带热重载）
npm run tauri-dev
```

### Windows 平台打包

```bash
# 生成 App Bundle (.exe)
npm run tauri-build-win-app

# 生成 NSIS 安装包 (.exe installer)
npm run tauri-build-win
```

**输出位置：**
- App: `src-tauri/target/release/bundle/app/`
- Installer: `src-tauri/target/release/bundle/nsis/`

### macOS 平台打包

```bash
# 生成 App Bundle (.app)
npm run tauri-build-mac-app

# 生成 DMG 安装包 (.dmg) - 先生成 .app，再创建 DMG
npm run tauri-build-mac
```

**输出位置：**
- App: `src-tauri/target/release/bundle/macos/`
- DMG: `src-tauri/target/release/`

**构建流程：**
1. `tauri-build-mac-app` → 只生成 `.app` 文件
2. `tauri-build-mac` → 执行步骤 1，然后创建 `.dmg` 安装包

## 🔧 构建要求

### Windows
- Node.js 16+
- Rust (cargo)
- NSIS 3.0+ (用于安装包)
  - 安装: `winget install NSIS.NSIS`
  - 或从 [https://nsis.sourceforge.io](https://nsis.sourceforge.io) 下载

### macOS
- Node.js 16+
- Rust (cargo)
- Xcode Command Line Tools

## 📝 注意事项

1. **首次构建**: 首次构建可能需要较长时间，因为需要下载和编译 Rust 依赖
2. **版本同步**: 构建脚本会自动同步 `package.json`、`Cargo.toml` 和 `tauri.conf.json` 中的版本号

## 🚀 快速开始

### 开发阶段
```bash
# 安装依赖
npm install

# 启动开发服务器
npm run tauri-dev
```

### 发布版本
```bash
# Windows
npm run tauri-build-win

# macOS
npm run tauri-build-mac
```
