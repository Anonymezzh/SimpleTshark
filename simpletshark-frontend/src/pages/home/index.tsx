import React, { useEffect, useState, useContext } from 'react';
import { Button, Spin } from '@arco-design/web-react';
import { useHistory } from 'react-router-dom';
import styles from './style/index.module.less';
import Header from '@/components/Header';
import { apiGet, apiPost, waitForBackendReady } from '@/services/api';
import { IconPlus } from '@arco-design/web-react/icon';
import Capture from './components/Capture';
import { electronAPI } from '@/utils/tauri';
import { GlobalContext } from '@/context';
import emitter from '@/utils/emitter';
import logger from '@/utils/logger';

const Home = () => {
  const history = useHistory();
  const { background } = useContext(GlobalContext);
  const [loading, setLoading] = useState(false);
  const [historyList, setHistoryList] = useState<string[]>([]);
  const [cap, setCap] = useState(false);

  const getHistoryFileList = async () => {
    try {
      const values = await apiGet('/api/getHistoryFileList');
      setHistoryList((values as any)?.data || []);
    } catch (error) {
      logger.error('[Home] Failed to load history file list', error);
    }
  };

  const handleSelectFile = async (type = '', path = '') => {
    try {
      const selectedFilePath = type ? await electronAPI.openFileDialog() : path;

      if (!selectedFilePath) {
        return;
      }

      setLoading(true);
      logger.info('[Home] Start offline analysis and clear cached packet detail state', selectedFilePath);
      emitter.emit('clearPacketDetailCache');

      try {
        if (type) {
          try {
            await apiGet('/api/stopMonitorAdaptersFlowTrend');
          } catch (error) {
            logger.warn('[Home] stopMonitorAdaptersFlowTrend failed before offline analysis', error);
          }
        }

        await apiPost('/api/analysisFile', { filePath: selectedFilePath });
        history.push('/dataPacket/all');
        await getHistoryFileList();
      } catch (error) {
        logger.error('[Home] analysisFile request failed', error);
      } finally {
        setLoading(false);
      }
    } catch (error) {
      logger.error('[Home] File selection failed', error);
      setLoading(false);
    }
  };

  const stopMonitorAdaptersFlowTrend = async (item?: string) => {
    try {
      await apiGet('/api/stopMonitorAdaptersFlowTrend');
    } catch (error) {
      logger.warn('[Home] stopMonitorAdaptersFlowTrend failed when reopening history file', error);
    }
    void handleSelectFile('', item || '');
  };

  const onsubmit = () => {
    setCap(true);
    setLoading(true);
    history.push('/dataPacket/all');
  };

  useEffect(() => {
    const initData = async () => {
      const isReady = await waitForBackendReady();
      if (isReady) {
        await getHistoryFileList();
      } else {
        logger.error('[Home] Backend service is not reachable');
      }
    };
    void initData();
  }, []);

  const actualBackground = background !== undefined ? background : '';
  const isGradient =
    actualBackground && typeof actualBackground === 'string' && actualBackground.startsWith('linear-gradient');

  const bgStyle =
    background === ''
      ? {
          backgroundColor: '#fff'
        }
      : isGradient
        ? {
            background: actualBackground,
            transition: 'filter 0.5s textEmphasisStyle'
          }
        : {
            backgroundImage: `url(${actualBackground})`,
            transition: 'filter 0.5s textEmphasisStyle',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          };

  return (
    <div className={styles['techBgWrap']} style={bgStyle}>
      <Header type="mainWindow" transparent />
      <Spin loading={loading} style={{ width: '100%' }} tip={`${cap ? '实时抓包' : '文件'}分析中...`}>
        <div className={styles['home']} style={{ padding: '30px 20%' }}>
          <div
            className={styles['inner']}
            style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '50px' }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <Capture onsubmit={onsubmit} />
            </div>

            <div
              className={`${styles['glass-card']} ${styles['glass-scroll']}`}
              style={{ flex: 1, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}
            >
              <div className={styles['panel-header']}>离线分析文件</div>
              <div className={styles['upload-row']} onClick={() => handleSelectFile('upload')} style={{ height: 60, flexShrink: 0 }}>
                <p>
                  <IconPlus style={{ fontSize: 22 }} />
                </p>
                <p>点击上传文件</p>
              </div>
              {historyList.length > 0 && (
                <>
                  <div className={styles['divider']} style={{ flexShrink: 0 }} />
                  <div className={styles['glass-scroll']} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
                    <div className={styles['list']}>
                      {historyList.map((item, index) => (
                        <div className="flex justify-between items-center" key={index}>
                          <span>{item}</span>
                          <Button
                            type="primary"
                            onClick={() => stopMonitorAdaptersFlowTrend(item)}
                            style={{ backgroundColor: '#3b82f6', borderColor: '#3b82f6', color: '#fff', marginRight: 8 }}
                          >
                            分析
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </Spin>
    </div>
  );
};

export default Home;
