import React from 'react';
import { Typography, Link, Tag } from '@arco-design/web-react';
import { ipWithAddrAndFlag } from '@/utils/tools';
import { formatFileSize } from '@/utils/tool';
import { protocolColor } from '@/components/enum'
import dayjs from 'dayjs';

const { Text, Ellipsis } = Typography;
const dateFormat = 'YYYY-MM-DD';
const StatusEnum = ['今日', '全部'];
const sameDay = dayjs(new Date()).format(dateFormat);
const lastDay = dayjs().subtract(1, 'day').format(dateFormat);
// 表格配置
export const deviceTableConfig = (goHistory) => {
  return {
    dataUrl: `/api/getProtoStatsList`,
    rowKey: 'proto',
    paramType: 'data',
    scrollHeight: 310,
    filter: {
      controls: [
      ],
    },
    columns: [
      {
        title: '协议',
        dataIndex: 'proto',
        width: 100,
        render: (value) => value && <Tag size='small' bordered color={protocolColor.find(v => v.label === value)?.color}>{value}</Tag>
      },
      {
        title: '数据包数量',
        dataIndex: 'totalPackets',
        width: 120,
        render: (value, record) => <span onClick={() => goHistory(`/dataPacket/all?protocol=${record.proto}`)}><Link>{value}</Link></span>
      },
      // {
      //   title: '最早通信时间',
      //   dataIndex: 'creatTime',
      //   width: 180,
      // },
      {
        title: '字节数',
        dataIndex: 'totalBytes',
        width: 100,
        render: (value) => formatFileSize(value)
      },
      {
        title: '会话数',
        dataIndex: 'sessionCount',
        width: 100,
      },
      {
        title: '协议描述',
        dataIndex: 'protoDescription',
      },
    ],
  }

};
