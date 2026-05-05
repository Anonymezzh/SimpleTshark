// Tauri API wrapper to replace Electron APIs
import { invoke } from '@tauri-apps/api/core';

export const tauriAPI = {
  // 打开 DevTools
  openDevtools: async (): Promise<void> => {
    try {
      await invoke('open_devtools');
    } catch (e) {
      console.error('open_devtools 调用失败:', e);
    }
  },
  // 窗口操作
  operationWindow: async (windowName: string, actionType: string) => {
    // Tauri v2 中参数名需与 Rust 函数入参一致（snake_case）
    try {
      await invoke('operation_window', { operation_type: actionType });
    } catch (e) {
      console.error('operation_window 调用失败:', e);
    }
  },

  // 打开文件对话框
  openFileDialog: async (): Promise<string | null> => {
    try {
      const result = await invoke<string | null>('open_file_dialog');
      return result;
    } catch (error) {
      console.error('Failed to open file dialog:', error);
      return null;
    }
  },

  // 显示保存对话框
  showSavePath: async (): Promise<string | null> => {
    try {
      const result = await invoke<string | null>('show_save_dialog');
      return result;
    } catch (error) {
      console.error('Failed to show save dialog:', error);
      return null;
    }
  }
};

// 检查是否在 Tauri 环境中运行
export const isTauri = () => {
  return '__TAURI__' in window;
};

// 统一的 API 接口，自动检测环境
export const electronAPI = {
  openDevtools: () => {
    if (isTauri()) {
      return tauriAPI.openDevtools();
    }
  },
  operationWindow: (windowName: string, actionType: string) => {
    if (isTauri()) {
      return tauriAPI.operationWindow(windowName, actionType);
    } else if (window.electronAPI) {
      return window.electronAPI.operationWindow(windowName, actionType);
    }
  },

  openFileDialog: async (): Promise<string | null> => {
    if (isTauri()) {
      return tauriAPI.openFileDialog();
    } else if (window.electronAPI) {
      return window.electronAPI.openFileDialog();
    }
    return null;
  },

  showSavePath: async (): Promise<string | null> => {
    if (isTauri()) {
      return tauriAPI.showSavePath();
    } else if (window.electronAPI) {
      return window.electronAPI.showSavePath();
    }
    return null;
  }
};
