import axios, {
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
  AxiosError
} from 'axios';
import { Message } from '@arco-design/web-react';

interface RequestConfig extends AxiosRequestConfig {
  returnFullResponse?: boolean;
  noDecrypt?: boolean;
}

const instance = axios.create({
  baseURL: 'http://127.0.0.1:9122',
  timeout: 10000,
  withCredentials: false
});

const backendInstance = axios.create({
  baseURL: 'https://www.simpletshark.com',
  timeout: 10000
});

instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    return config;
  },
  (error: AxiosError) => {
    Promise.reject(error);
  }
);

instance.interceptors.response.use(
  (response) => {
    const { code, msg } = response.data;
    if (code === 0) {
      return response.data;
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

export async function waitForBackendReady(maxRetries = 30, retryInterval = 500): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response: any = await instance.get('/api/getWorkStatus', { timeout: 1000 });
      if (response?.code === 0 && typeof response?.data?.workStatus === 'number') {
        console.log(
          `Backend is reachable after ${i + 1} attempts, workStatus=${response.data.workStatus}`
        );
        return true;
      }
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, retryInterval));
      }
    } catch (error) {
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, retryInterval));
      }
    }
  }
  console.error('Backend failed to become ready after', maxRetries, 'attempts');
  return false;
}
