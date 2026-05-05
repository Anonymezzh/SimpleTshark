// main.js
const { app, BrowserWindow, screen, ipcMain, dialog, shell } = require('electron');
const electron = require('electron')
const path = require('path');
const { execFile, execSync, spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');

// 禁用GPU，部分机器可能闪退
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-gpu-rasterization');
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('--no-sandbox');
app.disableHardwareAcceleration();

let logFilePath = null
if (process.platform === 'win32') {
  logFilePath = path.join(app.getPath('userData'), 'app.log');
} else if (process.platform === 'darwin') {
  logFilePath = path.join(os.homedir(), 'simpletshark', 'app.log');
}

// 获取日志文件路径

// tshark_server进程
let tsharkServerProcess = null

// 重定向 console.log 到日志文件
const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });
console.log = (...args) => {
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ') + '\n';
    logStream.write(message);
    process.stdout.write(message); // 同时输出到终端（如果存在）
};

//所有窗体
const windows = {
  windowIndex: 0,
  mainWindow: null, //主窗口
  subWindow: null, //主窗口
}


// 检查注册表，判断是否安装了 Npcap
function isNpcapInstalled() {
  try {
      // 执行 reg 命令查询 Npcap 注册表项
      const result = execSync('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Npcap"').toString();
      return result.includes('Npcap');
  } catch (error) {
      console.log("Npcap 未安装:", error.message);
      return false;
  }
}

// 安装 Npcap 并等待安装完成
function installNpcap() {
  const installerPath = path.join(process.resourcesPath, '\\tshark\\bin\\npcap-1.79.exe');

  console.log("正在安装 Npcap, installer path: ", installerPath);

  // **同步执行安装程序，并阻塞直到它退出**
  const result = spawnSync(installerPath, [], {
     shell: true, 
     stdio: 'inherit',
     windowsHide: true,
     detached: true
    });

  // **检查安装程序的退出码**
  if (result.error) {
      console.error("启动 Npcap 安装程序时出错:", result.error);
      process.exit(1); // 直接退出程序
  }

  if (result.status === 0 && isNpcapInstalled()) {
      console.log("Npcap 安装完成");
  } else {
      console.error(`Npcap 安装失败，退出码: ${result.status}`);
      process.exit(1); // 直接退出程序，防止继续执行
  }
}

async function checkNpcap() {
  if (!isNpcapInstalled()) {
    try {
      dialog.showMessageBoxSync({
        type: 'info',
        title: '安装Npcap',
        message: '检测到没有安装Npcap，需要先安装才能使用哦:)',
        buttons: ['确定']
      });
      await installNpcap(); // 等待安装完成
    } catch (err) {
      dialog.showMessageBoxSync({
        type: 'info',
        title: '安装Npcap失败',
        message: 'Npcap 安装失败，无法继续运行应用程序:(',
        buttons: ['确定']
      });
      console.error("Npcap 安装失败，无法继续运行应用程序:", err);
      app.quit();
      return;
    }
  }
}


// Mac平台需要安装ChmodBPF
function checkChmodBPF() {
  console.log("Enter checkAndInstallChmodBPF");

  let shouldInstall = false;

  try {
    const output = execSync('dseditgroup -o checkmember -m "$USER" access_bpf', {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log("Group check output:", output.trim());

    if (output.includes('is not a member')) {
      console.log("当前用户不在 access_bpf 组，需要安装");
      shouldInstall = true;
    } else {
      console.log("当前用户已在 access_bpf 组，无需安装");
    }
  } catch (e) {
    const stderr = e.stderr?.toString() || '';
    console.log("执行 checkmember 出错:", stderr.trim());

    if (stderr.includes('not found')) {
      console.log("access_bpf 组不存在，需安装 ChmodBPF");
      shouldInstall = true;
    } else {
      console.error("无法判断权限状态，可能缺少权限或其他错误:", e);
      return;
    }
  }

  if (shouldInstall) {

    dialog.showMessageBox({
      type: 'info',
      message: '检测到当前电脑未安装ChmodBPF，将无法使用抓包功能，只能离线分析文件。',
    });
  }

  console.log("Leave checkAndInstallChmodBPF");
}


// 启动tshark_server进程
function startTsharkServer() {

  const options = {
    detached: true,
    stdio: 'ignore',
    shell: false
  };

  if (process.platform === 'win32') {
    options.windowsVerbatimArguments = true;
    options.windowsHide = true;
    options.windowsBreakawayFromJob = true;

    const tsharkServerPath = path.join(process.resourcesPath, 'tshark_server_helper.exe')
    const args = ['--uipid=' + process.pid]; // 指定其前端进程的PID
    const tsharkServerProcess = spawn(tsharkServerPath, args, options)
    tsharkServerProcess.unref();
  } else if (process.platform === 'darwin') {
    options.windowsVerbatimArguments = true;
    options.windowsHide = true;
    options.windowsBreakawayFromJob = true;

    const tsharkServerPath = path.join(process.resourcesPath, 'tshark_server')
    const args = ['--uipid=' + process.pid]; // 指定其前端进程的PID
    const tsharkServerProcess = spawn(tsharkServerPath, args, options)
    tsharkServerProcess.unref();
  }
}

// 创建主窗口
function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  windows.mainWindow = new BrowserWindow({
    width: Math.ceil(width * 0.98),
    height: Math.ceil(height * 0.92),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      nativeWindowOpen: true,
      contextIsolation: true,
    },
    icon: path.join(__dirname, 'favicon.ico'),
    title: 'SimpleTshark',
    frame: false,
    // resizable: false,
  });
  /*获取electron窗体的菜单栏*/
  const Menu = electron.Menu;
  /*隐藏electron创听的菜单栏*/
  Menu.setApplicationMenu(null);
  const mode = process.argv[2];
  if (mode === 'dev') {
    windows.mainWindow.loadURL('http://localhost:3000/#/dataPacket');
    windows.mainWindow.webContents.openDevTools();
  } else {
    windows.mainWindow.loadFile(path.join(__dirname, 'index.html'), { hash: 'home' });
    // windows.mainWindow.webContents.openDevTools();
  }
}

// 先启动后台进程，然后再创建前端窗口
app.whenReady().then(async () => {

  // 第一步：对于Windows平台，需要检查NPCAP
  if (process.platform === 'win32') {
    checkNpcap();
  } else if (process.platform === 'darwin') {
    checkChmodBPF();
  }

  // 第二步：启动tshark_server进程
  startTsharkServer();

  // 第三步：创建主窗口
  createWindow();

});


/**
 * 优雅退出：先尝试 app.quit()，超时后强制退出
 */
let forceExitTimer = null;
function gracefulQuit() {
  // 设置一个超时定时器（例如 3 秒后强制退出）
  forceExitTimer = setTimeout(() => {
    console.log('优雅退出超时，强制终止进程');
    process.exit(0); // 强制退出
  }, 3000);

  // 监听成功退出事件，取消强制退出
  // app.once('will-quit', () => {
  //   clearTimeout(forceExitTimer); // 取消强制退出
  //   console.log('app.quit() 成功退出');
  // });

  // 尝试优雅退出r
  console.log('尝试优雅退出...');
  app.quit();
}

ipcMain.on('operation-window', function (event, windowName, operationType) {
  const currOperationWindow = windows[windowName];//当前操作的窗口实例
  if (!currOperationWindow) return;
  switch (operationType) {
    case 'max'://窗口 最大化
      currOperationWindow.maximize();
      break;
    case 'restoreDown'://窗口 向下还原
      currOperationWindow.unmaximize();
      break;
    case 'min'://窗口 最小化
      currOperationWindow.minimize();
      break;
    case 'close'://窗口 关闭
      currOperationWindow.close();
      if (windowName === 'mainWindow') {
        gracefulQuit()
      }
      break;
  }
});


// 监听来自渲染进程的文件读取请求
ipcMain.handle('open-file-dialog', async (event) => {
  const result = await dialog.showOpenDialog(windows.mainWindow, {
    properties: ['openFile'], // 只允许选择单个文件
    filters: [
      { name: 'pcap', extensions: ['pcap', 'cap', 'pcapng'] },
    ],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]; // 返回第一个文件的路径
  }

  return null; // 用户取消选择
});
ipcMain.handle('show-save-dialog', async (event) => {
  const result = await dialog.showSaveDialog(windows.mainWindow, {
    title: "保存文件",
    defaultPath: `simpletshark_${dayjs().format('YYYY-MM-DD')}_${dayjs().format('HH-mm-ss')}.pcap`, // 默认文件名
    buttonLabel: "保存",
    filters: [
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  if (!result.canceled) {
    return result.filePath; // 发送所选路径回渲染进程
  } else {
    return null
  }
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

//当一个新的 webContents 被创建时触发。
app.on('web-contents-created', function (event, webContents) {

  // 监听 window.open 事件
  webContents.setWindowOpenHandler((details) => {
    console.log('details', details);

    // 获取要打开的 URL
    const { url } = details;

    // 允许打开超链接
    if (url.startsWith('https')) {

      // 上报打开超链接事件
      reportEvent('click_link', url)

      return { action: 'allow' };
    } else {
      // 不是超链接，就是打开会话详情弹窗，单独处理
      const params = url.split('?')[1];
      const { width, height } = screen.getPrimaryDisplay().workAreaSize;
      const browserWindow = new BrowserWindow({
        width: Math.ceil(width * 0.95),
        height: Math.ceil(height * 0.9),
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          nodeIntegration: true,
          nativeWindowOpen: true,
          contextIsolation: true,
        },
        icon: path.join(__dirname, 'favicon.ico'),
        frame: false,
        resizable: true,
        title: 'SimpleTshark'
      });

      if (windows.windowIndex === 0) {
        windows.subWindow = browserWindow;
      } else {
        windows[`subWindow${windows.windowIndex}`] = browserWindow;
      }

      // 隐藏 Electron 窗体的菜单栏
      const Menu = electron.Menu;
      Menu.setApplicationMenu(null);

      // 加载 URL
      const mode = process.argv[2];
      if (mode === 'dev') {
        browserWindow.loadURL(`http://localhost:3000/#/details?windowIndex=${windows.windowIndex}&${params}`);
        browserWindow.webContents.openDevTools();
      } else {
        browserWindow.loadFile(path.join(__dirname, 'index.html'), { hash: 'details', search: `windowIndex=${windows.windowIndex}&${params}` });
        //browserWindow.webContents.openDevTools();
      }

      windows.windowIndex = windows.windowIndex + 1;

      // 阻止 Electron 默认的窗口打开行为
      return { action: 'deny' };
    }
  });
});
