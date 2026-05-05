import React from 'react';
import { Typography, Tag } from '@arco-design/web-react';
import { setEncrypt } from '@/utils/tools';
import dayjs from 'dayjs';
import { protocolColor } from '@/components/enum'

const { Text, Ellipsis } = Typography;
const dateFormat = 'YYYY-MM-DD';
const StatusEnum = ['今日', '全部'];
const sameDay = dayjs(new Date()).format(dateFormat);
const lastDay = dayjs().subtract(1, 'day').format(dateFormat);
// 表格配置
export const deviceTableConfig = {
  dataUrl: `/inside/checker-record/pageLockerUsageRecords`,
  rowKey: 'deviceId',
  filter: {
    controls: [
    ],
  },
  columns: [
    {
      title: '源IP',
      dataIndex: 'srcIp',
      width: 180,
    },
    {
      title: '源IP归属地',
      dataIndex: 'srcArea',
      width: 180,
    },
    {
      title: '源端口',
      dataIndex: 'srcPort',
      width: 100,
      render: (value) => value > 0 ? value : '-'
    },
    {
      title: '目的IP',
      dataIndex: 'dstIp',
      width: 100,
    },
    {
      title: '目的IP归属地',
      dataIndex: 'dstArea',
      width: 180,
    },
    {
      title: '目的端口',
      dataIndex: 'dstPort',
      width: 100,
      render: (value) => value > 0 ? value : '-'
    },
    {
      title: '时间',
      dataIndex: 'creatTime',
      width: 230,
    },
    {
      title: '协议',
      dataIndex: 'proct',
      width: 80,
      render: (value) => value && <Tag size='small' bordered color={protocolColor.find(v => v.label === value)?.color }>{value}</Tag>
    },
    {
      title: '数据包大小',
      dataIndex: 'packetSize',
      width: 100,
    },
    {
      title: '信息',
      dataIndex: 'info',
      width: 500,
    },
  ],
};
