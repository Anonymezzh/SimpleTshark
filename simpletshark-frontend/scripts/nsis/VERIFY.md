# NSIS Modern UI 验证指南

## 第一步：运行验证脚本

在 **Windows PowerShell** 中运行：

```powershell
cd E:\ai-program\simpletshark-frontend
powershell -ExecutionPolicy Bypass -File .\scripts\verify-nsis.ps1
```

这个脚本会检查：
- ✅ 自定义 NSIS 脚本是否存在
- ✅ Tauri 配置是否指向自定义脚本
- ✅ NSIS 编译器版本和图形文件
- ✅ 最近的构建输出

## 第二步：测试 Modern UI 是否工作

编译一个最小测试安装程序：

```powershell
cd E:\ai-program\simpletshark-frontend\scripts\nsis
makensis test-modern-ui.nsi
```

这会生成 `test-installer.exe`。运行它并检查：

### ✅ Modern UI 2 的特征（应该看到）：

1. **欢迎页面左侧有蓝色渐变侧边栏**
   - 如果看到了 → Modern UI 工作正常 ✅
   - 如果没看到 → NSIS 版本太旧或配置有问题 ❌

2. **目录选择页面顶部有蓝色横幅**
   - 带有标题文字的蓝色条
   - 如果看到了 → Modern UI 工作正常 ✅

### ❌ 经典 UI 的特征（不应该看到）：

1. 全灰色背景，没有任何彩色图片
2. Windows 95 风格的按钮
3. 单调的纯文字界面
4. 没有侧边栏或横幅

## 第三步：检查 NSIS 版本

```powershell
makensis /VERSION
```

**需要 NSIS 3.0 或更高版本** 才能使用 Metro 图形。

- 如果是 `v2.x` → **太旧了！** 需要升级
- 如果是 `v3.x` → 版本正确 ✅

### 升级 NSIS（如果需要）

```powershell
# 使用 winget 安装最新版
winget install NSIS.NSIS

# 或使用 Chocolatey
choco install nsis

# 或从官网下载
# https://nsis.sourceforge.io/Download
```

## 第四步：确认 Tauri 使用了自定义脚本

检查 Windows 配置文件：

```powershell
cat src-tauri\tauri.windows.conf.json
```

**必须包含：**

```json
{
  "bundle": {
    "windows": {
      "nsis": {
        "template": "../scripts/nsis/simpletshark.nsi"
      }
    }
  }
}
```

如果 **没有** `"template"` 字段 → Tauri 会使用内置的默认模板，不会用你的自定义脚本！

## 第五步：清理并重新构建

如果前面的检查都通过了，但安装包还是旧界面，尝试：

```powershell
# 1. 删除旧的构建输出
Remove-Item src-tauri\target\release\bundle\nsis -Recurse -Force -ErrorAction SilentlyContinue

# 2. 重新构建
npm run tauri-build-win

# 3. 检查构建日志
# 搜索 "Processing script file" 看看用的是哪个 .nsi 文件
```

在构建日志中查找：

```
Processing script file: "...\scripts\nsis\simpletshark.nsi"
```

如果看到的是其他路径 → 说明没有使用自定义脚本！

## 常见问题排查

### 问题 1：看不到蓝色侧边栏

**可能原因：**
- NSIS 版本低于 3.0
- Metro 图形文件缺失
- 没有使用 Modern UI 2

**解决方法：**
```powershell
# 检查 Metro 图形是否存在
Test-Path "C:\Program Files (x86)\NSIS\Contrib\Graphics\Header\nsis3-metro.bmp"
Test-Path "C:\Program Files (x86)\NSIS\Contrib\Graphics\Wizard\nsis3-metro.bmp"
```

如果返回 `False` → 重新安装 NSIS 3.x

### 问题 2：自定义脚本没有被使用

**检查构建日志中的这一行：**
```
Processing script file: "..."
```

**如果路径不是你的 `simpletshark.nsi`：**

1. 确认 `tauri.windows.conf.json` 中有 `template` 配置
2. 确认路径是相对于 `src-tauri` 目录的
3. 尝试使用绝对路径测试：
   ```json
   "template": "E:/ai-program/simpletshark-frontend/scripts/nsis/simpletshark.nsi"
   ```

### 问题 3：Tauri 构建脚本没有合并 Windows 配置

**查看你的构建脚本** `tauri-build-win.ps1`：

确保它正确合并了 Windows 配置：
```powershell
$winCfg = Get-Content $winCfgPath -Raw | ConvertFrom-Json
# ... 合并逻辑
if ($winCfg.bundle.windows) {
    $merged.bundle.windows = $winCfg.bundle.windows
}
```

## 对比图示

### Modern UI 2（应该看到的）：

```
┌─────────────────────────────────────┐
│ [蓝色横幅]                          │
│  Choose Install Location           │
├─────────────────────────────────────┤
│                                     │
│  Destination Folder                │
│  ┌───────────────────────┐         │
│  │ C:\Program Files\...  │ Browse  │
│  └───────────────────────┘         │
│                                     │
│            [< Back] [Next >]       │
└─────────────────────────────────────┘
```

### 经典 UI（不应该看到的）：

```
┌─────────────────────────────────────┐
│ Choose Install Location             │
│                                     │
│  Destination Folder                │
│  ┌───────────────────────┐         │
│  │ C:\Program Files\...  │ Browse  │
│  └───────────────────────┘         │
│                                     │
│            < Back   Next >         │
└─────────────────────────────────────┘
```

注意：Modern UI 有顶部横幅，按钮样式不同！

## 最终验证清单

- [ ] NSIS 版本 ≥ 3.0
- [ ] Metro 图形文件存在
- [ ] 测试安装程序显示蓝色侧边栏
- [ ] `tauri.windows.conf.json` 包含 template 配置
- [ ] 构建日志显示使用了自定义 .nsi 文件
- [ ] 清理后重新构建

如果所有项都勾选了，但还是看不到 Modern UI，请把：
1. 验证脚本的输出
2. 构建日志
3. 测试安装程序的截图

发给我看看，我帮你诊断！
