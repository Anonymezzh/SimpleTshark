import React from 'react';
import { Typography, Link } from '@arco-design/web-react';
import { ipWithAddrAndFlag } from '@/utils/tools';
import { formatFileSize } from '@/utils/tool';
import dayjs from 'dayjs';

const { Text, Ellipsis } = Typography;
const dateFormat = 'YYYY-MM-DD';
const StatusEnum = ['今日', '全部'];
const sameDay = dayjs(new Date()).format(dateFormat);
const lastDay = dayjs().subtract(1, 'day').format(dateFormat);
// 表格配置
export const deviceTableConfig = {
  dataUrl: `/api/getCountryStatsList`,
  rowKey: 'country',
  paramType: 'data',
  scrollHeight: 310,
  filter: {
    controls: [
    ],
  },
  columns: [
    {
      title: '国家',
      dataIndex: 'country',
      width: 120,
      render: (value, record) => {
        return value && <span className='flex items-center'>
          <img className="nation-flag" style={{marginRight:' 5px'}} src={require(`@/assets${ipWithAddrAndFlag(value, record.country)}`)}/><span>{value}</span>
        </span> 
      }
    },
    {
      title: 'IP数量',
      dataIndex: 'ipCount',
      width: 120,
    },
    {
      title: '数据包数量',
      dataIndex: 'totalPackets',
      width: 120,
    },
    {
      title: '字节数',
      dataIndex: 'totalBytes',
      width: 120,
      render: (value) => formatFileSize(value)
    },
    {
      title: '会话数',
      dataIndex: 'sessionCount',

    },
  ],
};
