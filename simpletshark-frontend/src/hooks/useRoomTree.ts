import { useState } from 'react';
import { Message } from '@arco-design/web-react';
import { apiGet } from '@/services/api';
import { isArray } from 'lodash';
import { getAvailableArray } from '@/utils/tools';

/**
 * 获取所有的 区域-房间 树形列表
 */
const useRoomTree = (filterAraeType?: string) => {
  const [roomTree, setRoomTree] = useState([]);
  const getRoomTree = async () => {
    try {
      const source = await apiGet('/inside/area/queryAreaTree?range=2');
      setRoomTree(formatFunc(source));
    } catch ({ message }) {
      Message.error(message);
    }
  };

  const formatFunc = (list: any[]) => {
    if (!isArray(list) || list.length === 0) return [];
    const result = [];
    for (const item of list) {
      const { areaType, areaId, areaName, childList, roomList } = item;
      // 这里将有 areaType 属性则视为区域
      if (
        (!filterAraeType || areaType === filterAraeType) &&
        (getAvailableArray(childList).length > 0 || getAvailableArray(roomList).length > 0)
      ) {
        const childrenRoomList = roomList.map((v: any) => ({
          label: v.roomName,
          value: v.roomId,
          extra: v
        }));
        result.push({
          label: areaName,
          value: areaId,
          extra: item,
          children: childrenRoomList.concat(formatFunc(getAvailableArray(childList)))
        });
      }
    }
    return result;
  };

  return { roomTree, getRoomTree };
};

export default useRoomTree;