import { apiGet, apiPost } from '@/services/api';

// 获取部门树
export const fetchDepartTree = async () => {
  return await apiGet('/inside/depart/queryDepartTree');
};

// 新增部门
export const addDepart = async (data) => {
  return await apiPost('/inside/depart/add', data);
};

// 修改部门
export const updateDepart = async (data) => {
  return await apiPost('/inside/depart/update', data);
};

// 删除部门
export const delDepart = async (data) => {
  return await apiPost('/inside/depart/delById', null, { params: data });
};

// 修改用户密码
export const modifyUserPwd = async (data) => {
  return await apiPost('/inside/user/modifyUserPwd', data);
};

// 查询员工列表
export const fetchUserList = async (params) => {
  return await apiGet('/inside/user/pageUserInfo', params);
};

// 新增员工
export const addUser = async (data) => {
  return await apiPost('/inside/user/add', data);
};

// 修改员工
export const updateUser = async (data) => {
  return await apiPost('/inside/user/update', data);
};

// 删除员工
export const delUser = async (data) => {
  return await apiPost('/inside/user/delById', null, { params: data });
};