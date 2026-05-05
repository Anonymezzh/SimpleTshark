import React from 'react';
import { Typography, Tag, Space, Popover, Tooltip } from '@arco-design/web-react';
import { ipWithAddrAndFlag } from '@/utils/tools';
import { formatFileSize, calculateDuration } from '@/utils/tool';
import { protocolColor } from '@/components/enum'
import dayjs from 'dayjs';
import defaultExeIcon from '@/assets/images/exe.png'

const { Text, Ellipsis } = Typography;
const dateFormat = 'YYYY-MM-DD';
// 公共表格
const commonColumns = [
  {
    title: 'IP1',
    dataIndex: 'ip1',
    width: 160,
    sorter: true,
    render: (value, record) => {
      return <Ellipsis showTooltip className='flex items-center'>
        <img className="nation-flag" style={{ marginRight: ' 5px' }} src={require(`@/assets${ipWithAddrAndFlag(value, record.ip1Location)}`)} /><span>{value}</span>
      </Ellipsis>
    }
  },
  {
    title: 'IP1归属地',
    dataIndex: 'ip1Location',
    width: 150,
    sorter: true,
    render: (value) => <Ellipsis showTooltip>{value}</Ellipsis>
  },
  {
    title: 'IP1端口',
    dataIndex: 'ip1Port',
    width: 70,
    render: (value) => value > 0 ? value : '-'
  },
  {
    title: 'IP2',
    dataIndex: 'ip2',
    width: 160,
    sorter: true,
    render: (value, record) => {
      return <Ellipsis showTooltip className='flex items-center'>
        <img className="nation-flag" style={{ marginRight: ' 5px' }} src={require(`@/assets${ipWithAddrAndFlag(value, record.ip2Location)}`)} /><span>{value}</span>
      </Ellipsis>
    }
  },
  {
    title: 'IP2归属地',
    dataIndex: 'ip2Location',
    width: 150,
    sorter: true,
    render: (value) => <Ellipsis showTooltip>{value}</Ellipsis>
  },
  {
    title: 'IP2端口',
    dataIndex: 'ip2Port',
    width: 80,
    sorter: true,
    render: (value) => value > 0 ? value : '-'
  },
  {
    title: '进程名',
    dataIndex: 'processInfo.processName',
    width: 200,
    sorter: false,
    render: (value, record) => {
      if (record.processInfo != undefined) {

        let imageData = null
        if (record.processInfo.processIcoDataBase64 != "") {
          imageData = record.processInfo?.processIcoDataBase64
        } else {
          imageData = defaultExeIcon
        }
        return <Tooltip content={`${record.processInfo?.processFullPath}`}>
                <div className='flex items-center' style={{ overflow: 'hidden' }}>
                  <img 
                    src={imageData} 
                    style={{
                      width: '20px',
                      height: '20px',
                      marginRight: '5px',
                      flexShrink: 0, // 防止图片被压缩
                    }}
                  />
                  <span 
                    style={{
                      whiteSpace: 'nowrap', // 防止换行
                      overflow: 'hidden',   // 隐藏超出部分
                      textOverflow: 'ellipsis', // 显示省略号
                    }}
                  >
                    {value}
                  </span>
                </div>
              </Tooltip>
      } else {
        return <span></span>
      }
    }
  },
  {
    title: '开始时间',
    dataIndex: 'startTime',
    width: 230,
    sorter: true,
    render: (value) => {
      const split = value.toString().split('.')
      return (`${dayjs(value * 1000).format('YYYY-MM-DD HH:mm:ss')}.${split[1]}`)
    }
  },
  // {
  //   title: '结束时间',
  //   dataIndex: 'endTime',
  //   width: 230,
  //   sorter: true,
  //   render: (value) => {
  //     const split = value.toString().split('.')
  //     return (`${dayjs(value * 1000).format('YYYY-MM-DD HH:mm:ss')}.${split[1]}`)
  //   }
  // },
  {
    title: '持续时间',
    dataIndex: 'durTime',
    width: 100,
    render: (value, record) => (
      calculateDuration(record.startTime, record.endTime)
    )
  },
]
// http dns
const dnsAndHttpColumns = [
  {
    title: '应用协议',
    dataIndex: 'appProto',
    width: 85,
    sorter: true,
    render: (value) => value && <Tag size='small' bordered color={protocolColor.find(v => v.label === value)?.color}>{value}</Tag>
  },
  {
    title: '协议版本',
    dataIndex: 'version',
    width: 85,
    sorter: true,
  },
  {
    title: '数据包大小',
    dataIndex: 'totalBytes',
    width: 95,
    sorter: true,
    render: (value) => formatFileSize(value)
  },
  {
    title: '数据包数量',
    dataIndex: 'packetCount',
    width: 95,
    sorter: true,
  },
  {
    title: '域名信息',
    dataIndex: 'remark',
    width: 300,
    sorter: true,
    render: (value: string) => {
      const split = value.split(',')
      const url = 'https://' + split[0]
      return <div className='flex items-center'>
        <Ellipsis showTooltip style={{maxWidth: 300}}><a href={url} target="_blank" rel="noopener noreferrer">{split[0]}</a></Ellipsis>

        {split.length > 1 &&
          <Popover
            trigger='hover'
            content={value.split('，')}
          >
            <Tag color='blue' size='small' bordered style={{ borderRadius: 20, height: 17, lineHeight: '17px', cursor: 'pointer' }}>{split.length - 1}</Tag>
          </Popover>}
      </div>
    }
  },
]
// 表格配置
export const deviceTableConfig = (type) => {
  let columns = []
  switch (type) {
    case 'http':
    case 'dns': columns = [...commonColumns, ...dnsAndHttpColumns.filter(v => v.dataIndex !== 'version')]; break;
    case 'tls': columns = [...commonColumns, ...dnsAndHttpColumns]; break;
    default: columns = [...commonColumns, ...dnsAndHttpColumns.filter(v => ['appProto', 'totalBytes', 'packetCount'].includes(v.dataIndex))]; break;
  }
  const props = {
    dataUrl: '/api/getSessionList',
    rowKey: 'sessionId',
    scrollHeight: 265,
    filter: {
      controls: [
      ],
    },
    paramType: 'data',
    rowDetailAction: 'open',
    columns,
    rowActions: true
  }

  if (type == 'process') {
    props['maxHeight'] = `calc(100vh - 220px)`
  }

  return props
};
