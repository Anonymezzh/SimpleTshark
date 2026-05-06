import React, { useEffect, useRef, useState } from 'react';
import { Button, Tooltip, Typography } from '@arco-design/web-react';
import { IconPlayCircle } from '@arco-design/web-react/icon';
import styles from '../style/index.module.less';
import LineChart from './LineChart';
import { apiGet, apiPost, waitForBackendReady } from '@/services/api';
import emitter from '@/utils/emitter';
import logger from '@/utils/logger';
import adapterIcon from '@/assets/adapter.png';

function Capture({ type = '', onsubmit = null }) {
  const [datas, setDatas] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<any>(null);

  const startMonitorAdaptersFlowTrend = async () => {
    try {
      await apiGet('/api/startMonitorAdaptersFlowTrend');
      await getAdaptersFlowTrendData();
    } catch (error) {
      logger.error('[Capture] Failed to start adapter monitoring', error);
    }
  };

  const getAdaptersFlowTrendData = async () => {
    try {
      const values = await apiGet('/api/getAdaptersFlowTrendData');
      setDatas((values as any)?.data || {});
    } catch (error) {
      logger.error('[Capture] Failed to load adapter flow trend data', error);
    }
  };

  const startCapture = async (key) => {
    setLoading(true);
    logger.info('[Capture] Start capture and clear cached packet detail state');
    emitter.emit('clearPacketDetailCache');
    try {
      await apiPost('/api/startCapture', { adapterName: key });
      onsubmit && onsubmit(type);
    } catch (error) {
      logger.error('[Capture] Failed to start capture', error);
    } finally {
      setLoading(false);
    }
  };

  const stopMonitorAdaptersFlowTrend = async (item?: any, t?: string) => {
    try {
      await apiGet('/api/stopMonitorAdaptersFlowTrend');
    } catch (error) {
      logger.warn('[Capture] stopMonitorAdaptersFlowTrend failed', error);
    }
    if (t) {
      startCapture(item);
    }
  };

  useEffect(() => {
    const initMonitoring = async () => {
      const isReady = await waitForBackendReady();
      if (isReady) {
        await startMonitorAdaptersFlowTrend();
        intervalRef.current = setInterval(getAdaptersFlowTrendData, 1000);
      } else {
        logger.error('[Capture] Backend service is not reachable');
      }
    };

    initMonitoring();

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      void stopMonitorAdaptersFlowTrend();
    };
  }, []);

  return (
    <div
      className={`${styles['glass-card']}`}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <div className={styles['panel-header']} style={{ flexShrink: 0 }}>
        实时抓包分析
      </div>
      <div
        className={styles['glass-scroll']}
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px', minHeight: 0 }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 16
          }}
        >
          {Object.entries(datas).map(([key, value]) => (
            <div
              key={key}
              className={styles['glass-card']}
              style={{
                borderRadius: 12,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                background: 'rgba(250, 249, 246, 0.2)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)'
              }}
            >
              <div className="flex items-center" style={{ paddingLeft: 6, gap: 8 }}>
                <div
                  className="flex items-center"
                  style={{ gap: 8, flex: '1 1 0', minWidth: 0, overflow: 'hidden' }}
                >
                  <img src={adapterIcon} alt="adapter" style={{ width: 18, height: 18, flexShrink: 0 }} />
                  <Typography.Ellipsis showTooltip style={{ flex: 1, minWidth: 0 }}>
                    {key}
                  </Typography.Ellipsis>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <Tooltip content="开始抓包">
                    <Button
                      type="text"
                      size={type ? 'small' : 'large'}
                      loading={loading}
                      onClick={() => stopMonitorAdaptersFlowTrend(key, 'cap')}
                      icon={<IconPlayCircle style={{ fontSize: 22, color: '#3b82f6' }} />}
                    />
                  </Tooltip>
                </div>
              </div>
              <div className="mt-3" style={{ marginBottom: 10, marginLeft: 10, marginRight: 10 }}>
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
