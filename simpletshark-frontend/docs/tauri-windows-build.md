## Windows 打安装包（Tauri v2 + NSIS）

前置准备：
- 安装 Rust MSVC 工具链（已安装可跳过）：
  - winget install Rustlang.Rust.MSVC
- 安装 NSIS：
  - winget install NSIS.NSIS
  - 或 https://nsis.sourceforge.io/Download 下载并安装

打包步骤：
- 运行：`npm run tauri-build-win`
- 构建完成后产物路径：`src-tauri/target/release/bundle/`
  - 可执行文件：`app/`
  - 安装包（NSIS）：`nsis/`

说明：
- Windows 专用配置位于：`src-tauri/tauri.windows.conf.json`
- 已启用 `bundle.targets = ["app", "nsis"]`，默认会生成安装包。
- 若未安装 NSIS，脚本将提示安装并退出，不会仅构建可执行文件（避免误解为已生成安装包）。

