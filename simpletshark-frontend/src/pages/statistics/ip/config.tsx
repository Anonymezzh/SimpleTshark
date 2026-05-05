import React from 'react';
import { Typography, Tag, Link, Tooltip, Badge, Space, Popover } from '@arco-design/web-react';
import dayjs from 'dayjs';
import { ipWithAddrAndFlag } from '@/utils/tools';
import { formatFileSize } from '@/utils/tool';
import { protocolColor } from '@/components/enum'
// 表格配置
export const DeviceTableConfig = (goHistory) => {
  return {
    dataUrl: `/api/getIPStatsList`,
    rowKey: 'ip',
    paramType: 'data',
    scrollHeight: 310,
    filter: {
      controls: [
      ],
    },
    columns: [
      {
        title: 'IP',
        dataIndex: 'ip',
        width: 145,
        render: (value, record) => {
          return <Typography.Ellipsis showTooltip className='flex items-center'>
            <img className="nation-flag" style={{ marginRight: ' 5px' }} src={require(`@/assets${ipWithAddrAndFlag(value, record.location)}`)} /><span>{value}</span>
          </Typography.Ellipsis>
        }
      },
      {
        title: 'IP归属地',
        dataIndex: 'location',
        width: 130,
        render: (value) => <Typography.Ellipsis showTooltip>{value}</Typography.Ellipsis>
      },
      {
        title: '最早通信时间',
        dataIndex: 'earliestTime',
        width: 220,
        render: (value) => {
          const split = value.toString().split('.')
          return (`${dayjs(value * 1000).format('YYYY-MM-DD HH:mm:ss')}.${split[1]}`)
        }
      },
      {
        title: '最近通信时间',
        dataIndex: 'latestTime',
        width: 220,
        render: (value) => {
          const split = value.toString().split('.')
          return (`${dayjs(value * 1000).format('YYYY-MM-DD HH:mm:ss')}.${split[1]}`)
        }
      },
      {
        title: '通信端口',
        dataIndex: 'ports',
        width: 90,
        render: (value) => {
          return <Space className='flex items-center'>
            <div style={{ minWidth: 30 }}>{value[0]}</div>
            {value.length > 1 &&
              <Popover
                trigger='hover'
                content={value.join('，')}
              >
                <Tag color='blue' size='small' bordered style={{ borderRadius: 20, height: 17, lineHeight: '17px', cursor: 'pointer' }}>{value.length - 1}</Tag>
              </Popover>}
          </Space>
        }
      },
      {
        title: '通信协议',
        dataIndex: 'proto',
        width: 140,
        render: (value) => {
          const split = value.split(',')
          return <Space className='flex items-center'>
            <div style={{ minWidth: 30 }}>{value.split(',').splice(0, 2).join(',')}</div>
            {split.length > 2 &&
              <Popover
                trigger='hover'
                content={split.map(item => {
                  return <Tag bordered color={protocolColor.find(v => v.label === item)?.color} key={item} className='mr-2' size='small'>{item}</Tag>
                })}
              >
                <Tag color='blue' size='small' bordered style={{ borderRadius: 20, height: 17, lineHeight: '17px', cursor: 'pointer' }}>{split.length - 1}</Tag>
              </Popover>}
          </Space>
        }
      },
      {
        title: '接收数据包数量',
        dataIndex: 'totalRecvPackets',
        width: 115,
      },
      {
        title: '发送数据包数量',
        dataIndex: 'totalSentPackets',
        width: 115,
      },
      {
        title: '接收字节数',
        dataIndex: 'totalRecvBytes',
        width: 90,
        render: (value) => formatFileSize(value)
      },
      {
        title: '发送字节数',
        dataIndex: 'totalSentBytes',
        width: 90,
        render: (value) => formatFileSize(value)
      },
      {
        title: 'TCP会话数',
        dataIndex: 'tcpSessionCount',
        width: 85,
        render: (value, record) => value > 0 ? <span
          onClick={() => {
            goHistory(`/flow/tcp?ip=${record.ip}`)
          }}>
          <Link style={{ padding: 0 }}>{value}</Link>
        </span> : value
      },
      {
        title: 'UDP会话数',
        dataIndex: 'udpSessionCount',
        width: 90,
        render: (value, record) => value > 0 ? <span onClick={() => goHistory(`/flow/udp?ip=${record.ip}`)}><Link style={{ padding: 0 }}>{value}</Link></span> : value

      },
    ],
  }

};
