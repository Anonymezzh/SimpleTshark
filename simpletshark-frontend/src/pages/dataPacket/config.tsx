import React from 'react';
import { Typography, Tag, Link } from '@arco-design/web-react';
import { ipWithAddrAndFlag } from '@/utils/tools';
import dayjs from 'dayjs';
import { protocolColor } from '@/components/enum'
import { FlowIcon } from '@/utils/icons'
import { formatFileSize } from '@/utils/tool';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

const { Text, Ellipsis } = Typography;
const dateFormat = 'YYYY-MM-DD';
const StatusEnum = ['今日', '全部'];
const sameDay = dayjs(new Date()).format(dateFormat);
const lastDay = dayjs().subtract(1, 'day').format(dateFormat);
// 表格配置
export const deviceTableConfig = (proto) => {
  const arp = [
    {
      title: '源Mac地址',
      dataIndex: 'srcMac',
      width: 200,
      sorter: true,
    },
    {
      title: '目的Mac地址',
      dataIndex: 'dstMac',
      width: 200,
      sorter: true,
    },
  ]
  const other = [
    {
      title: !proto ? '源IP/源Mac' : '源IP',
      dataIndex: 'srcIP',
      width: 180,
      sorter: true,
      render: (value, record) => {
        return !value ? record.srcMac : (<Typography.Ellipsis showTooltip className='flex items-center'>
          <img className="nation-flag" style={{ marginRight: ' 5px' }} src={require(`@/assets${ipWithAddrAndFlag(value, record.srcLocation)}`)} /><span>{value}</span>
        </Typography.Ellipsis>)
      }
    },
    {
      title: '源IP归属地',
      dataIndex: 'srcLocation',
      width: 150,
      sorter: true,
      render: (value) => <Typography.Ellipsis showTooltip>{value}</Typography.Ellipsis>
    },
    {
      title: '源端口',
      dataIndex: 'srcPort',
      sorter: true,
      width: 90,
      render: (value) => value > 0 ? value : '-'

    },
    {
      title: !proto ? '目的IP/⽬的Mac' : '目的IP',
      dataIndex: 'dstIP',
      width: 180,
      sorter: true,
      render: (value, record) => {
        return !value ? record.srcMac : (value && <Typography.Ellipsis showTooltip className='flex items-center'>
          <img className="nation-flag" style={{ marginRight: ' 5px' }} src={require(`@/assets${ipWithAddrAndFlag(value, record.dstLocation)}`)} /><span>{value}</span>
        </Typography.Ellipsis>)
      }
    },
    {
      title: '目的IP归属地',
      dataIndex: 'dstLocation',
      width: 150,
      sorter: true,
      render: (value) => <Typography.Ellipsis showTooltip>{value}</Typography.Ellipsis>
    },
    {
      title: '目的端口',
      dataIndex: 'dstPort',
      width: 90,
      sorter: true,
      render: (value) => value > 0 ? value : '-'
    },
  ]
  return {
    dataUrl: '/api/getPacketList',
    rowKey: 'frameNumber',
    maxHeight: 380,
    paramType: 'data',
    size: 'small',
    page: {
      pageSize: proto ? 100 : 100
    },
    filter: {
      controls: [
      ],
    },
    columns: [
      {
        title: '时间',
        dataIndex: 'timestamp',
        width: 230,
        sorter: true,
        render: (value) => {
          const split = value.toString().split('.')
          return (`${dayjs(value * 1000).format('YYYY-MM-DD HH:mm:ss')}.${split[1]}`)
        }
      },
      ...(proto === 'ARP' ? arp : other),
      {
        title: '协议',
        dataIndex: 'protocol',
        width: 80,
       sorter: true,
        render: (value) => value && <Tag size='small' bordered color={protocolColor.find(v => v.label === value)?.color}>{value}</Tag>
      },
      {
        title: '数据包大小',
        dataIndex: 'capLength',
        width: 100,
       sorter: true,
      },
      {
        title: '信息',
        dataIndex: 'info',
        width: 500,
       sorter: true,
        render: (value) => <Ellipsis showTooltip>{value}</Ellipsis>
      },
      !proto && {
        title: '操作',
        dataIndex: 'belongSessionId',
        width: 50,
        fixed: 'right',
        align: 'center' as const,
        className: 'datapacket-operation-column',
        render: (value, record) => {
          return value > 0 && <div
            onClick={async (e) => {
              e.stopPropagation();
              console.log('=== 点击查看相关会话按钮 ===');
              console.log('sessionId:', record.belongSessionId);
              console.log('record:', record);

              localStorage.setItem(`row${record.belongSessionId}`, JSON.stringify({...record, type: 'all'}))
              console.log('已保存数据到 localStorage');

              try {
                // 使用 Tauri WebviewWindow API 创建新窗口
                console.log('开始创建新窗口...');
                const windowLabel = `details-${record.belongSessionId}`;
                const windowIndex = record.belongSessionId;
                const windowUrl = `/#/details?sessionId=${record.belongSessionId}&windowIndex=${windowIndex}`;
                console.log('窗口标签:', windowLabel);
                console.log('窗口 URL:', windowUrl);

                const webview = new WebviewWindow(windowLabel, {
                  url: windowUrl,
                  title: '会话详情',
                  width: 1200,
                  height: 800,
                  center: true,
                  decorations: false,
                });

                console.log('WebviewWindow 实例已创建:', webview);

                // 监听窗口创建事件
                webview.once('tauri://created', () => {
                  console.log('✓ 新窗口创建成功!');
                });

                webview.once('tauri://error', (e) => {
                  console.error('✗ 创建窗口失败:', e);
                });
              } catch (error) {
                console.error('创建窗口时发生错误:', error);
              }
            }}
          >
            <div title='查看相关会话' className='flow-icon'><FlowIcon /></div>
          </div>
        }
      },

    ],

    rowDetailAction: 'change'
  }
};
