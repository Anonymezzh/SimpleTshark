import React, { useEffect, useState } from 'react';
import { Button, Tooltip, Typography } from '@arco-design/web-react';
import { IconPlayCircle } from '@arco-design/web-react/icon';
import styles from '../style/index.module.less';
import LineChart from './LineChart';
import { apiGet, apiPost, waitForBackendReady } from '@/services/api';
import emitter from '@/utils/emitter';
import logger from '@/utils/logger';
import adapterIcon from '@/assets/adapter.png';

function Capture({ type = '', onsubmit = null }) {
  const [datas, setDatas] = useState([]);
  const [loading, setLoading] = useState(false);
  let intervalId = null as any;

  // start monitoring adapters flow trend
  const startMonitorAdaptersFlowTrend = async () => {
    await apiGet('/api/startMonitorAdaptersFlowTrend');
    getAdaptersFlowTrendData();
  };

  // fetch flow trend data
  const getAdaptersFlowTrendData = async () => {
    const values = await apiGet('/api/getAdaptersFlowTrendData');
    setDatas((values as any)?.data || []);
  };

  // start capture
  const startCapture = async (key) => {
    setLoading(true);
    logger.info('[Capture] 📡 开始抓包，发送清空缓存事件');
    emitter.emit('clearPacketDetailCache'); // 清空数据包详情缓存
    await apiPost('/api/startCapture', { adapterName: key });
    onsubmit && onsubmit(type);
    setLoading(false);
  };

  // stop monitoring
  const stopMonitorAdaptersFlowTrend = async (item?: any, t?: string) => {
    await apiGet('/api/stopMonitorAdaptersFlowTrend');
    if (t) startCapture(item);
  };

  useEffect(() => {
    // 等待后端就绪后再开始监控网卡流量
    const initMonitoring = async () => {
      const isReady = await waitForBackendReady();
      if (isReady) {
        startMonitorAdaptersFlowTrend();
        intervalId = setInterval(getAdaptersFlowTrendData, 1000);
      } else {
        logger.error('[Capture] Backend service is not ready');
      }
    };
    initMonitoring();

    return () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        stopMonitorAdaptersFlowTrend();
      }
    };
  }, []);

  return (
    <div className={`${styles['glass-card']}`} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className={styles['panel-header']} style={{ flexShrink: 0 }}>实时抓包分析</div>
      <div className={styles['glass-scroll']} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px', minHeight: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 16,
          }}
        >
        {Object.entries(datas as any).map(([key, value]) => (
          <div
            key={key as string}
            className={styles['glass-card']}
            style={{
              borderRadius: 12,
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              background: 'rgba(250, 249, 246, 0.2)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)'
            }}
          >
            <div className='flex items-center' style={{ paddingLeft: 6, gap: 8 }}>
              <div className='flex items-center' style={{ gap: 8, flex: '1 1 0', minWidth: 0, overflow: 'hidden' }}>
                <img src={adapterIcon} alt="adapter" style={{ width: 18, height: 18, flexShrink: 0 }} />
                <Typography.Ellipsis showTooltip style={{ flex: 1, minWidth: 0 }}>{key as string}</Typography.Ellipsis>
              </div>
              <div style={{ flexShrink: 0 }}>
                <Tooltip content={'\u5f00\u59cb\u6293\u5305'}>
                  <Button
                    type='text'
                    size={type ? 'small' : 'large'}
                    onClick={() => stopMonitorAdaptersFlowTrend(key, 'cap')}
                    icon={<IconPlayCircle style={{ fontSize: 22, color: '#3b82f6' }} />}
                  />
                </Tooltip>
              </div>
            </div>
            <div className='mt-3' style={{ marginBottom: 10, marginLeft: 10, marginRight: 10 }}>
              <LineChart data={value} />
            </div>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}

export default Capture;
