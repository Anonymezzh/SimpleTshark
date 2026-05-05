import { apiGet, apiPost } from '@/services/api';

// 字典列表
export const getDictList = async (dictCode) => {
  return await apiGet('/inside/dict/queryAvailItemList', { dictCode });
};

// 单文件上传
export const uploadFile = async (data) => {
  return await apiPost('/inside/file/uploadFile', data);
};