# SimpleTshark NSIS 安装程序自定义说明

## 概述

本目录包含 SimpleTshark 的 NSIS 安装程序配置文件，提供现代化、简约的安装界面。

## 功能特性

### ✨ 主要特性

1. **现代化UI设计**
   - 使用 Modern UI 2 (MUI2) 框架
   - 简洁的中文界面
   - 专业的视觉效果

2. **自定义安装路径**
   - 支持用户选择安装位置
   - 默认安装到 `Program Files\SimpleTshark`
   - 记忆上次安装路径

3. **灵活的组件选择**
   - 桌面快捷方式（默认勾选）
   - 开始菜单快捷方式（默认勾选）
   - 添加到系统 PATH（可选）

4. **完整的卸载支持**
   - 在控制面板显示完整的程序信息
   - 自动清理所有安装文件和注册表项
   - 自动从 PATH 中移除

5. **安装完成选项**
   - 立即运行程序
   - 访问项目官网链接

## 安装界面流程

1. **欢迎页面** - 显示应用介绍和版本信息
2. **安装路径选择** - 自定义安装目录
3. **组件选择** - 选择快捷方式和 PATH 选项
4. **安装进度** - 显示文件复制进度
5. **完成页面** - 提供立即运行选项

## 当前界面特性

✅ **已启用的现代化功能：**

1. **Modern UI 2 风格** - 使用 NSIS 最新的 Metro 风格主题
2. **蓝色主题图标** - 使用 modern-install-blue.ico
3. **Metro 风格图片** - 欢迎页和标题栏使用 nsis3-metro.bmp
4. **自定义文本** - 所有界面文字都已自定义
5. **组件选择页面** - 可选桌面快捷方式、开始菜单、PATH 环境变量
6. **完成页面选项** - 立即运行程序、访问官网链接

## 进一步自定义界面

### 使用自己的品牌图标

1. 准备图标文件（ICO格式）：
   - `installer.ico` - 安装程序图标（建议 256x256）
   - `uninstaller.ico` - 卸载程序图标

2. 创建目录并放置图标：
   ```bash
   mkdir scripts/nsis/icons
   # 将你的图标文件放到这个目录
   ```

3. 修改 `simpletshark.nsi` 文件的图标路径（第 43-44 行）：

```nsis
; 替换这两行：
!define MUI_ICON "${NSISDIR}\Contrib\Graphics\Icons\modern-install-blue.ico"
!define MUI_UNICON "${NSISDIR}\Contrib\Graphics\Icons\modern-uninstall-blue.ico"

; 改为：
!define MUI_ICON "${__FILEDIR__}\icons\installer.ico"
!define MUI_UNICON "${__FILEDIR__}\icons\uninstaller.ico"
```

### 自定义欢迎页面侧边栏图片

创建自定义侧边栏图片（**164x314 像素，BMP 格式**）：

```bash
mkdir scripts/nsis/images
# 创建或放置 welcome.bmp (164x314)
```

修改 `simpletshark.nsi`（第 52 行）：

```nsis
; 替换：
!define MUI_WELCOMEFINISHPAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Wizard\nsis3-metro.bmp"

; 改为：
!define MUI_WELCOMEFINISHPAGE_BITMAP "${__FILEDIR__}\images\welcome.bmp"
```

### 自定义标题栏横幅图片

创建标题栏图片（**150x57 像素，BMP 格式**）：

```bash
# 创建或放置 header.bmp (150x57) 到 scripts/nsis/images/
```

修改 `simpletshark.nsi`（第 49 行）：

```nsis
; 替换：
!define MUI_HEADERIMAGE_BITMAP "${NSISDIR}\Contrib\Graphics\Header\nsis3-metro.bmp"

; 改为：
!define MUI_HEADERIMAGE_BITMAP "${__FILEDIR__}\images\header.bmp"
```

### 修改界面颜色

在 `simpletshark.nsi` 中修改（第 56-57 行）：

```nsis
!define MUI_BGCOLOR FFFFFF     ; 背景色（十六进制）
!define MUI_TEXTCOLOR 000000   ; 文字颜色（十六进制）

; 例如使用蓝色主题：
!define MUI_BGCOLOR E6F3FF
!define MUI_TEXTCOLOR 003366
```

## 自定义文本

所有界面文本都可以在 `simpletshark.nsi` 的 "Modern UI Appearance Settings" 部分修改：

```nsis
; 欢迎页面
!define MUI_WELCOMEPAGE_TITLE "欢迎安装 ${APP_NAME}"
!define MUI_WELCOMEPAGE_TEXT "您的自定义文本..."

; 完成页面
!define MUI_FINISHPAGE_TITLE "完成 ${APP_NAME} 安装向导"
!define MUI_FINISHPAGE_LINK "访问 ${APP_NAME} 官网"
!define MUI_FINISHPAGE_LINK_LOCATION "https://your-website.com"
```

## 构建安装程序

### 前提条件

- 安装 NSIS 3.0 或更高版本
- Tauri 项目已配置

### 构建命令

```bash
# Windows 构建
npm run tauri build -- --target nsis

# 或使用 Cargo
cargo tauri build -- --target nsis
```

### 构建输出

安装程序将生成在：
```
src-tauri/target/release/bundle/nsis/SimpleTshark_1.0.0_x64-setup.exe
```

## 高级自定义

### 添加许可协议页面

```nsis
!insertmacro MUI_PAGE_LICENSE "license.txt"
```

### 添加自定义页面

可以创建自定义对话框页面，参考 `ComponentsPage` 函数的实现。

### 修改安装目录默认值

```nsis
; 修改这一行：
InstallDir "$PROGRAMFILES64\${APP_NAME}"

; 例如改为：
InstallDir "$LOCALAPPDATA\${APP_NAME}"
```

### 更改压缩算法

```nsis
; 当前使用 LZMA（最佳压缩比）
SetCompressor /SOLID lzma

; 可选：使用 ZLIB（更快）
SetCompressor /SOLID zlib
```

## 注册表信息

安装程序会在以下位置写入注册表：

1. **应用程序信息**：
   - `HKLM\Software\SimpleTshark\InstallDir`
   - `HKLM\Software\SimpleTshark\Version`

2. **卸载信息**（显示在控制面板）：
   - `HKLM\Software\Microsoft\Windows\CurrentVersion\Uninstall\SimpleTshark`

3. **PATH 环境变量**（如果用户选择）：
   - `HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment\Path`

## 故障排除

### 构建失败

1. 确认 NSIS 已正确安装
2. 检查 `APP_SRC` 路径是否正确
3. 确认所有资源文件存在

### 图标不显示

1. 确认图标路径正确
2. 确认图标文件格式为 ICO
3. 使用绝对路径或相对于脚本的路径

### 权限问题

安装程序需要管理员权限（`RequestExecutionLevel admin`）来：
- 写入 Program Files 目录
- 修改系统 PATH 环境变量
- 写入 HKLM 注册表

## 维护建议

1. 每次发布新版本时更新版本号
2. 定期测试安装和卸载过程
3. 在虚拟机中测试完整安装流程
4. 检查卸载是否完全清理所有文件

## 参考资料

- [NSIS 官方文档](https://nsis.sourceforge.io/Docs/)
- [Modern UI 2 文档](https://nsis.sourceforge.io/Docs/Modern%20UI%202/Readme.html)
- [NSIS 中文教程](https://nsis.sourceforge.io/Category:Tutorials)
