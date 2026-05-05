#!/usr/bin/env node
/* Cross-platform tauri dev runner for Windows/macOS/Linux */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const http = require('http');

const root = path.resolve(__dirname, '..');
const srcTauri = path.join(root, 'src-tauri');
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';

function log(msg) {
  console.log(msg);
}

async function fileExists(p) {
  try { await fsp.access(p); return true; } catch { return false; }
}

async function syncVersion() {
  const pkgPath = path.join(root, 'package.json');
  const cargoPath = path.join(srcTauri, 'Cargo.toml');
  const tauriConfPath = path.join(srcTauri, 'tauri.conf.json');

  const pkg = JSON.parse(await fsp.readFile(pkgPath, 'utf8'));
  const version = pkg.version;

  let cargo = await fsp.readFile(cargoPath, 'utf8');
  cargo = cargo.replace(/^version\s*=\s*"[^"]*"/m, `version = "${version}"`);
  await fsp.writeFile(cargoPath, cargo);

  const tauriConf = JSON.parse(await fsp.readFile(tauriConfPath, 'utf8'));
  tauriConf.version = version;
  await fsp.writeFile(tauriConfPath, JSON.stringify(tauriConf, null, 2));
}

async function rimraf(p) {
  if (!(await fileExists(p))) return;
  await fsp.rm(p, { recursive: true, force: true });
}

async function copyDir(src, dst) {
  if (!(await fileExists(src))) return;
  await fsp.mkdir(dst, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const e of entries) {
    const sp = path.join(src, e.name);
    const dp = path.join(dst, e.name);
    if (e.isDirectory()) {
      await copyDir(sp, dp);
    } else if (e.isFile()) {
      await fsp.copyFile(sp, dp);
    }
  }
}

async function prepareResources() {
  const srcDir = isWin
    ? path.join(root, 'resources', 'tshark_win')
    : isMac
      ? path.join(root, 'resources', 'tshark_mac')
      : path.join(root, 'resources', 'tshark_linux');

  const dstDir = srcTauri;
  // clean
  await Promise.all([
    rimraf(path.join(dstDir, 'tshark_server')),
    rimraf(path.join(dstDir, 'tshark_server.exe')),
    rimraf(path.join(dstDir, 'tshark_server_helper.exe')),
    rimraf(path.join(dstDir, 'tshark_fields.db')),
  ]);
  // copy
  await copyDir(srcDir, dstDir);
}

async function setupDevResources() {
  const debugDir = path.join(srcTauri, 'target', 'debug');
  const releaseDir = path.join(srcTauri, 'target', 'release');
  const srcDir = isWin
    ? path.join(root, 'resources', 'tshark_win')
    : isMac
      ? path.join(root, 'resources', 'tshark_mac')
      : path.join(root, 'resources', 'tshark_linux');

  await fsp.mkdir(debugDir, { recursive: true });
  await fsp.mkdir(releaseDir, { recursive: true });

  await rimraf(path.join(debugDir, 'resources'));
  await rimraf(path.join(releaseDir, 'resources'));

  await copyDir(srcDir, debugDir);
  await copyDir(srcDir, releaseDir);

  // executable bit for non-Windows
  if (!isWin) {
    const tryChmod = async (p) => { try { await fsp.chmod(p, 0o755); } catch {} };
    await tryChmod(path.join(debugDir, 'tshark_server'));
    await tryChmod(path.join(releaseDir, 'tshark_server'));
  }
}

// Build a temporary dev config that injects devUrl without touching repo files
async function prepareDevConfig() {
  try {
    const basePath = path.join(srcTauri, 'tauri.conf.json');
    const raw = await fsp.readFile(basePath, 'utf8');
    const base = JSON.parse(raw);
    const merged = JSON.parse(JSON.stringify(base));
    merged.build = merged.build || {};
    // keep frontendDist as-is, only add devUrl for dev
    merged.build.devUrl = 'http://127.0.0.1:3000';

    const tmpPath = path.join(srcTauri, '.tauri.dev.config.json');
    await fsp.writeFile(tmpPath, JSON.stringify(merged));
    return tmpPath;
  } catch (e) {
    console.error('构建临时 dev 配置失败:', e && (e.stack || e.message || e));
    return null;
  }
}

function pollDevServer(url, timeoutMs = 60000, interval = 500) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const doTry = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) reject(new Error('dev server wait timeout'));
        else setTimeout(doTry, interval);
      });
    };
    doTry();
  });
}

function withCargoPathEnv(env) {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const cargoBin = path.join(home, '.cargo', 'bin');
  env.PATH = cargoBin + path.delimiter + env.PATH;
  return env;
}

function resolveCargoCmd() {
  if (process.env.CARGO && fs.existsSync(process.env.CARGO)) return process.env.CARGO;

  if (isWin) {
    const candidates = [];
    const home = process.env.USERPROFILE || '';
    const local = process.env.LOCALAPPDATA || '';
    if (home) candidates.push(path.join(home, '.cargo', 'bin', 'cargo.exe'));
    candidates.push(
      'C\\\\Program Files\\\\Rust\\\\bin\\\\cargo.exe',
      'C\\\\Program Files\\\\Rust stable MSVC\\\\bin\\\\cargo.exe',
      'C\\\\Program Files (x86)\\\\Rust\\\\bin\\\\cargo.exe'
    );
    if (local) candidates.push(path.join(local, 'Programs', 'Rust', 'bin', 'cargo.exe'));

    for (const c of candidates) { if (fs.existsSync(c)) return c; }

    try {
      const out = spawnSync('cmd.exe', ['/d', '/s', '/c', 'where cargo']);
      if (out.status === 0) {
        const line = String(out.stdout || '').split(/\r?\n/).find(l => l.toLowerCase().includes('cargo'));
        if (line && fs.existsSync(line.trim())) return line.trim();
      }
    } catch {}

    throw new Error('未找到 cargo.exe。请安装 Rust MSVC 工具链或将 cargo 加入 PATH（示例: winget install Rustlang.Rust.MSVC）。');
  } else {
    const home = process.env.HOME || '';
    const candidate = path.join(home, '.cargo', 'bin', 'cargo');
    if (fs.existsSync(candidate)) return candidate;
    try {
      const out = spawnSync('which', ['cargo']);
      if (out.status === 0) {
        const p = String(out.stdout || '').trim();
        if (p && fs.existsSync(p)) return p;
      }
    } catch {}
    throw new Error('未找到 cargo。请安装 Rust 工具链或将 cargo 加入 PATH。');
  }
}

async function main() {
  try {
    log('🚀 启动 SimpleTshark 开发环境...');
    log('📋 同步版本...');
    await syncVersion();

    log('📂 准备资源文件...');
    await prepareResources();

    log('📂 设置开发资源...');
    await setupDevResources();

    log('🌐 启动前端开发服务器...');
    const envWeb = { ...process.env, BROWSER: 'none', PORT: '3000' };
    let web;
    if (isWin) {
      // Windows 下统一通过 shell 执行，避免 EINVAL
      web = spawn('cmd.exe', ['/d', '/s', '/c', 'npm run start'], {
        cwd: root,
        env: envWeb,
        stdio: 'inherit',
        shell: true,
      });
    } else {
      const rewiredBin = path.join(root, 'node_modules', '.bin', 'react-app-rewired');
      if (fs.existsSync(rewiredBin)) {
        web = spawn(rewiredBin, ['start'], {
          cwd: root,
          env: envWeb,
          stdio: 'inherit',
        });
      } else {
        web = spawn('npm', ['run', 'start'], {
          cwd: root,
          env: envWeb,
          stdio: 'inherit',
        });
      }
    }
    web.on('error', (err) => {
      console.error('前端进程启动失败:', err && (err.stack || err.message || err));
      process.exit(1);
    });

    const onExit = async (code) => {
      try { web.kill(); } catch {}
      // 清理 src-tauri 下的临时资源（与 bash 脚本一致）
      await Promise.all([
        rimraf(path.join(srcTauri, 'tshark_server')),
        rimraf(path.join(srcTauri, 'tshark_server.exe')),
        rimraf(path.join(srcTauri, 'tshark_server_helper.exe')),
        rimraf(path.join(srcTauri, 'tshark_fields.db')),
        rimraf(path.join(srcTauri, '.tauri.dev.config.json')),
      ]);
      process.exit(code ?? 0);
    };
    process.on('SIGINT', () => onExit(0));
    process.on('SIGTERM', () => onExit(0));
    process.on('exit', () => onExit(0));

    log('⌛ 等待前端 3000 端口就绪...');
    await Promise.race([
      pollDevServer('http://127.0.0.1:3000'),
      new Promise((r)=>setTimeout(r, 10000))
    ]);
    log('前端端口等待结束，准备启动 Tauri');
    log('✅ 前端已就绪');

    log('🦀 启动 Tauri (cargo run)...');
    const envCargo = withCargoPathEnv({ ...process.env });
    // 注入临时 dev 配置路径，使编译期上下文读取 devUrl 而不改动仓库文件
    try {
      const devCfgPath = await prepareDevConfig();
      if (devCfgPath) {
        envCargo.TAURI_CONFIG_PATH = devCfgPath;
      }
    } catch {}
    let cargoCmd;
    try { cargoCmd = resolveCargoCmd(); }
    catch (e) { console.error('定位 cargo 失败:', e.message || e); process.exit(1); }
    // 确保 cargo 所在目录加入 PATH，从而让 build.rs 能找到 rustc 等可执行文件
    try {
      const cargoDir = path.dirname(cargoCmd);
      envCargo.PATH = cargoDir + path.delimiter + (envCargo.PATH || '');
    } catch {}
    // 若能探测到 rustc，则显式传入 RUSTC，进一步避免 NotFound
    try {
      let rustcCmd = null;
      if (isWin) {
        const guess = path.join(path.dirname(cargoCmd), 'rustc.exe');
        if (fs.existsSync(guess)) rustcCmd = guess;
        if (!rustcCmd) {
          const out = spawnSync('cmd.exe', ['/d', '/s', '/c', 'where rustc']);
          if (out.status === 0) {
            const line = String(out.stdout || '').split(/\r?\n/).find(l => l.toLowerCase().includes('rustc'));
            if (line && fs.existsSync(line.trim())) rustcCmd = line.trim();
          }
        }
      } else {
        const guess = path.join(path.dirname(cargoCmd), 'rustc');
        if (fs.existsSync(guess)) rustcCmd = guess;
        if (!rustcCmd) {
          const out = spawnSync('which', ['rustc']);
          if (out.status === 0) {
            const p = String(out.stdout || '').trim();
            if (p && fs.existsSync(p)) rustcCmd = p;
          }
        }
      }
      if (rustcCmd) {
        envCargo.RUSTC = rustcCmd;
        const rustcDir = path.dirname(rustcCmd);
        envCargo.PATH = rustcDir + path.delimiter + envCargo.PATH;
      }
    } catch {}

    const cargo = spawn(cargoCmd, ['run'], { cwd: srcTauri, env: envCargo, stdio: 'inherit' });
    cargo.on('error', (err) => {
      console.error('后端进程启动失败(cargo):', err && (err.stack || err.message || err));
    });
    cargo.on('exit', (code) => onExit(code));
  } catch (e) {
    console.error('开发启动失败:', e.message || e);
    process.exit(1);
  }
}

main();
