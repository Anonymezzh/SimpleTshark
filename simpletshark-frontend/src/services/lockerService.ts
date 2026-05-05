import { apiGet, apiPost } from '@/services/api';

// 查询储物柜储物格列表
export const getListLockerCompartments = async (deviceId: string) => {
  return await apiGet('/inside/locker-compartment/listLockerCompartments', { deviceId });
};