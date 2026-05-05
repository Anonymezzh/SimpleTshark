import { useState } from 'react';
import { Message } from '@arco-design/web-react';
import { apiGet } from '@/services/api';
import { getAvailableArray } from '@/utils/tools';
import { has } from 'lodash';

/**
 * 获取所有区域房间树形结构列表
 */
const useAreaRoomTree = () => {
  const [areaRoomTree, setAreaRoomTree] = useState([]);

  const getAreaRoomTree = async () => {
    try {
      const res = await apiGet('/inside/area/queryAreaTree', { range: 2 });
      setAreaRoomTree(formatFunc(res));
    } catch ({ message }) {
      Message.error(message);
    }
  };

  const formatFunc = (list: any[]) => {
    let result = [];
    result = list.map(item => {
      const option = {
        label: item.areaName,
        value: item.areaId,
        extra: item,
        children: []
      };
      if (getAvailableArray(item.childList).length > 0) {
        option.children = formatFunc(item.childList);
      }
      if (getAvailableArray(item.roomList).length > 0) {
        const roomList = item.roomList.map((v: any) => ({
          label: v.roomName,
          value: v.roomId,
          extra: v
        }));
        option.children.push(...roomList);
      }
      return option;
    });
    return result;
  };

  const getParentAreaId = (targetId: string) => {
    // 定义递归查找函数
    function findPath(nodes: any[], targetId: string, path = []) {
      for (const node of nodes) {
        if (node.value === targetId) {
          return path;
        }
        if (has(node, 'children') && node.children.length > 0) {
          const result = findPath(node.children, targetId, [...path, node.value]);
          if (result) {
            return result;
          }
        }
      }
      return null;
    }

    // 调用递归函数并返回结果
    const ids = findPath(areaRoomTree, targetId) || [];
    return ids.length > 0 ? [...ids, targetId] : [targetId];
  };

  return { areaRoomTree, getAreaRoomTree, getParentAreaId };
};

export default useAreaRoomTree;