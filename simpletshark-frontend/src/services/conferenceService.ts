import { apiGet, apiPost } from '@/services/api';

// 新增会议信息
export const addConference = async (data) => {
  return await apiPost('/inside/conference/add', data);
};

// 查询会议列表信息
export const getListConferences = async (data) => {
  return await apiGet('/inside/conference/pageConferences', data);
};