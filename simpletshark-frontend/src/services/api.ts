import axios, {
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
  AxiosError
} from 'axios';
import { Message } from '@arco-design/web-react';

interface RequestConfig extends AxiosRequestConfig {
  returnFullResponse?: boolean; // 返回完整数据
  noDecrypt?: boolean; // 响应参数不解密
}

const instance = axios.create({
  baseURL: 'http://127.0.0.1:9122',
  //baseURL: process.env.REACT_APP_BASE_HOST,
  timeout: 10000,
  withCredentials: false // 禁用凭证，避免 CORS 错误
});

const backendInstance = axios.create({
  baseURL: 'https://www.simpletshark.com',
  timeout: 10000
});

// 请求拦截器
instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    return config;
  },
  (error: AxiosError) => {
    Promise.reject(error);
  }
);

// 响应拦截器
instance.interceptors.response.use(
  (response) => {
    const { code, msg } = response.data;
    if (code === 0) {
      return response.data
    } else {
      Message.error(msg);
      return Promise.reject(msg);
    }
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

export function apiGet<T = any>(
  url: string,
  params?: any,
  options?: RequestConfig
): Promise<T> {
  return instance.get(url, { params, ...options });
}

export async function apiPost<T>(
  url: string,
  data?: any,
  config?: RequestConfig
): Promise<T> {
  return instance.post(url, data, config);
}


export function backendApiGet<T = any>(
  url: string,
  params?: any,
  options?: RequestConfig
): Promise<T> {
  return backendInstance.get(url, { params, ...options });
}

// 检查后端服务是否就绪
export async function waitForBackendReady(maxRetries = 30, retryInterval = 500): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response: any = await instance.get('/api/getWorkStatus', { timeout: 500 });
      // 响应拦截器返回格式为 { code: 0, msg: "...", data: { workStatus: 0 } }
      // 检查 workStatus 是否为 0（空闲中）
      if (response?.code === 0 && response?.data?.workStatus === 0) {
        console.log(`Backend is ready (idle) after ${i + 1} attempts`);
        return true;
      }
      // 如果状态不是 0，继续等待
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryInterval));
      }
    } catch (error) {
      // 请求失败，继续重试
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryInterval));
      }
    }
  }
  console.error('Backend failed to become ready after', maxRetries, 'attempts');
  return false;
}

