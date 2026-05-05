# SimpleTshark Frontend

`simpletshark-frontend` 是 SimpleTshark 的桌面端前端项目，基于 Tauri + React。

## 技术栈

- React 17
- Tauri 2
- TypeScript
- Arco Design

## 目录说明

```text
simpletshark-frontend/
├── src/                  # React 页面与组件
├── src-tauri/            # Tauri Rust 入口与桌面端配置
├── resources/            # 各平台运行资源
├── scripts/              # 构建辅助脚本
├── BUILD.md              # 打包说明
└── .env.example          # 示例环境变量
```

## 本地开发

要求：

- Node.js 18+
- Rust / Cargo
- Tauri 对应平台依赖

安装依赖：

```bash
npm install
```

启动开发环境：

```bash
npm run tauri-dev
```

## 构建

常用命令：

```bash
# Windows
npm run tauri-build-win-app
npm run tauri-build-win

# macOS
npm run tauri-build-mac-app
npm run tauri-build-mac

# Linux
npm run tauri-build-linux-app
npm run tauri-build-linux
```

更详细的打包说明见 [BUILD.md](/Users/xuanyuan/Documents/AI-Program/simpletshark/simpletshark-frontend/BUILD.md)。

## 环境变量

仓库不再提交真实环境配置，请基于 `.env.example` 自行创建本地 `.env`。

## 说明

- 本仓库已移除启动上报、更新检查和 Apple 签名/公证相关逻辑。
- `src-tauri` 打包依赖运行时资源，构建前请确保资源准备脚本已正确执行。
