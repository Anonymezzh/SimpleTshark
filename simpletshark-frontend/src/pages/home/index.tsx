import React, { useEffect, useRef, useState, useContext } from 'react';
import { Button, Card, Grid, Message, Spin, Typography, Upload } from '@arco-design/web-react';
import { useHistory } from 'react-router-dom';
import styles from './style/index.module.less'
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
  const fileInputRef = useRef(null)
  const [loading, setLoading] = useState(false)
  const [networkLoading, setNetworkLoading] = useState(false)
  const [historyList, setHistoryList] = useState([])
  const [data, setData] = useState([])
  const [cap, setCap] = useState(false)

  const handleSelectFile = async (type = '', path = '') => {
    try {
      const selectedFilePath = type ? await electronAPI.openFileDialog() : path

      if (selectedFilePath) {
        setLoading(true)
        logger.info('[Home] 📂 开始离线分析文件，发送清空缓存事件');
        emitter.emit('clearPacketDetailCache'); // 清空数据包详情缓存
        try {
          if (type) await apiGet('/api/stopMonitorAdaptersFlowTrend')
          await apiPost('/api/analysisFile', { filePath: selectedFilePath })
          history.push('/dataPacket/all')
          getHistoryFileList()
          setLoading(false)
        } catch {
          setLoading(false)
        }
      }
    } catch (error) {
      console.error('文件选择或读取失败', error);
    }
  };
  const getFile = async (e) => {
    // const split = e.target.value.split('.')
    // if (!['pcap', 'cap', 'pcapng'].includes(split[split.length - 1])) {
    //   return Message.error('只能上传扩展名为pcap、cap、pcapng格式的文�?)
    // }
  }
  // 获取历史分析文件列表
  const getHistoryFileList = async () => {
    const values = await apiGet('/api/getHistoryFileList')
    setHistoryList(values?.data)
  }


  // 停止监控网卡流量趋势
  const stopMonitorAdaptersFlowTrend = async (item?: any, type?: any) => {
    await apiGet('/api/stopMonitorAdaptersFlowTrend')
    handleSelectFile(null, item)
  }
  const onsubmit = () => {
    setCap(true)
    setLoading(true)
    history.push('/dataPacket/all')
  }
  useEffect(() => {
    // 等待后端就绪后再获取历史文件列表
    const initData = async () => {
      const isReady = await waitForBackendReady();
      if (isReady) {
        getHistoryFileList();
      } else {
        logger.error('[Home] Backend service is not ready');
      }
    };
    initData();
  }, [])

  // 使用纯白色作为默认背景
  const actualBackground = background !== undefined ? background : '';

  // 判断是否为渐变色（以linear-gradient开头）
  const isGradient = actualBackground && typeof actualBackground === 'string' && actualBackground.startsWith('linear-gradient');

  const bgStyle = background === ''
    ? {
        backgroundColor: '#fff'
      }
    : isGradient
    ? {
        background: actualBackground,
        transition: "filter 0.5s textEmphasisStyle"
      }
    : {
        backgroundImage: `url(${actualBackground})`,
        transition: "filter 0.5s textEmphasisStyle",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      };

  return <div
    className={styles['techBgWrap']}
    style={bgStyle}
  >
    <Header type="mainWindow" transparent />
    <Spin loading={loading} style={{ width: '100%' }} tip={`${cap ? '实时抓包' : '文件'}分析中...`}>
      <div className={styles['home']} style={{ padding: '30px 20%' }}>
        <div className={styles['inner']} style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '50px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <Capture onsubmit={onsubmit} />
          </div>

          <div className={`${styles['glass-card']} ${styles['glass-scroll']}`} style={{ flex: 1, borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className={styles['panel-header']}>离线分析文件</div>
            <div className={styles['upload-row']} onClick={() => handleSelectFile('upload')} style={{ height: 60, flexShrink: 0 }}>
              <p><IconPlus style={{ fontSize: 22 }} /></p>
              <p>点击上传文件</p>
            </div>
            {historyList.length > 0 && (
              <>
                <div className={styles['divider']} style={{ flexShrink: 0 }} />
                <div className={styles['glass-scroll']} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
                  <div className={styles['list']}>
                    {historyList.map((item, index) => (
                      <div className='flex justify-between items-center' key={index}>
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
}

export default Home;
