import React from 'react';
import { Typography, Tag } from '@arco-design/web-react';
import { ipWithAddrAndFlag } from '@/utils/tools';
import dayjs from 'dayjs';
import { protocolColor } from '@/components/enum'
import { formatFileSize } from '@/utils/tool';

const { Text, Ellipsis } = Typography;
// 表格配置
export const deviceTableConfig = {
  dataUrl: `/api/getPacketList`,
  rowKey: 'frameNumber',
  maxHeight: 280,
  paramType: 'data',
  hiddenPagination: true,
  scrollLoad: true,
  filter: {
    controls: [
    ],
  },
  columns: [
    {
      title: '源IP',
      dataIndex: 'srcIP',
      width: 180,
      render: (value, record) => {
        return <span className='flex items-center'>
          <img className="nation-flag" style={{ marginRight: ' 5px' }} src={require(`@/assets${ipWithAddrAndFlag(value, record.srcLocation)}`)} />
          <Typography.Ellipsis showTooltip style={{ width: 'calc(100% - 40px)' }}>{value}</Typography.Ellipsis>
        </span>
      }
    },
    {
      title: '源端口',
      dataIndex: 'srcPort',
      width: 80,
      render: (value) => value > 0 ? value : '-'
    },
    {
      title: '目的IP',
      dataIndex: 'dstIP',
      width: 180,
      render: (value, record) => {
        return <span className='flex items-center'>
          <img className="nation-flag" style={{ marginRight: ' 5px' }} src={require(`@/assets${ipWithAddrAndFlag(value, record.dstLocation)}`)} />
          <Typography.Ellipsis showTooltip style={{ width: 'calc(100% - 40px)' }}>{value}</Typography.Ellipsis>
        </span>
      }
    },
    {
      title: '目的端口',
      dataIndex: 'dstPort',
      width: 80,
      render: (value) => value > 0 ? value : '-'
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      width: 230,
      render: (value) => {
        const split = value.toString().split('.')
        return (`${dayjs(value * 1000).format('YYYY-MM-DD HH:mm:ss')}.${split[1]}`)
      }
    },
    {
      title: '协议',
      dataIndex: 'protocol',
      width: 80,
      render: (value) => value && <Tag size='small' bordered color={protocolColor.find(v => v.label === value)?.color}>{value}</Tag>
    },
    {
      title: '数据包大小',
      dataIndex: 'capLength',
      width: 90,
      render: (value) => formatFileSize(value)
    },
    {
      title: '信息',
      dataIndex: 'info',
      width: 500,
      render: (value) => <Ellipsis showTooltip>{value}</Ellipsis>
    },
  ],
  rowDetailAction: 'change'
};
