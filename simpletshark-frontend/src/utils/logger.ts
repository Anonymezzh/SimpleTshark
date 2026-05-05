// 前端日志工具
const isTauri = '__TAURI__' in window;

// 动态导入 Tauri log 插件（避免在非 Tauri 环境报错）
let tauriLog: any = null;
if (isTauri) {
  import('@tauri-apps/plugin-log').then(module => {
    tauriLog = module;
  }).catch(err => {
    console.warn('Failed to load Tauri log plugin:', err);
  });
}

// 统一的日志接口
export const logger = {
  debug: (message: string, ...args: any[]) => {
    console.debug(`[DEBUG] ${message}`, ...args);
    if (isTauri && tauriLog) {
      tauriLog.debug(JSON.stringify({ message, args }));
    }
  },

  info: (message: string, ...args: any[]) => {
    console.info(`[INFO] ${message}`, ...args);
    if (isTauri && tauriLog) {
      tauriLog.info(JSON.stringify({ message, args }));
    }
  },

  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
    if (isTauri && tauriLog) {
      tauriLog.warn(JSON.stringify({ message, args }));
    }
  },

  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
    if (isTauri && tauriLog) {
      tauriLog.error(JSON.stringify({ message, args }));
    }
  },

  trace: (message: string, ...args: any[]) => {
    console.trace(`[TRACE] ${message}`, ...args);
    if (isTauri && tauriLog) {
      tauriLog.trace(JSON.stringify({ message, args }));
    }
  }
};

// 捕获全局错误
if (typeof window !== 'undefined') {
  window.onerror = (message, source, lineno, colno, error) => {
    logger.error('Uncaught error:', { message, source, lineno, colno, error });
    return false;
  };

  window.onunhandledrejection = (event) => {
    logger.error('Unhandled promise rejection:', event.reason);
  };
}

export default logger;
