import React, { useContext, useEffect, useMemo, useState, useRef } from 'react';
import { Space, Button, Divider, Popover, Grid, Typography, Message, Modal} from '@arco-design/web-react';
import { useHistory } from 'react-router-dom';
import styles from './style/index.module.less';
import { apiGet, apiPost } from '@/services/api';
import { LayoutContext } from '@/layoutContext';
import Capture from '../../pages/home/components/Capture';
import { IconPlayCircle, IconHome, IconRecord, IconRecordStop, IconFile, IconSave } from '@arco-design/web-react/icon';
import { electronAPI } from '@/utils/tauri';
import { getCurrentWindow } from '@tauri-apps/api/window';

function Navbar({ refresh, onsubmit, handleSelectFile }: { refresh: any; onsubmit?: () => void; handleSelectFile: () => void }) {
  const history = useHistory();
  const { refreshLoading, workStatus } = useContext(LayoutContext);
  const [poperVisible, setPoperVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [stopLoading, setStopLoading] = useState(false)

  // 是否显示保存按钮
  const [showSave, setShowSave] = useState(false)

  // 是否显示保存确认弹窗
  const [showSaveModal, setShowSaveModal] = useState(false)

  // 是否已经保存过了
  const [hadSaved, setHadSaved] = useState(true)

  // 保存点击保存后应该执行什么动作
  // 用户以下场景：
  // 1、当前分析数据还没有保存，点击了首页按钮
  // 2、当前分析数据还没有保存，点击了抓包按钮
  // 3、当前分析数据还没有保存，点击了分析文件按钮
  const doWorkAfterSaveRef = useRef(null);

  // 处理窗口拖拽
  const handleDragStart = async (e: React.MouseEvent) => {
    // 如果点击的是按钮或其他交互元素,不触发拖拽
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('.arco-btn') || target.closest('.arco-popover')) {
      return;
    }

    e.preventDefault();
    console.log('Drag area clicked, starting window drag...');
    try {
      const window = getCurrentWindow();
      console.log('Got current window:', window);
      await window.startDragging();
      console.log('Window dragging started successfully');
    } catch (error) {
      console.error('Failed to start dragging:', error);
    }
  };

  // 处理双击最大化/恢复
  const handleDoubleClick = async (e: React.MouseEvent) => {
    // 如果点击的是按钮或其他交互元素,不触发最大化
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('.arco-btn') || target.closest('.arco-popover')) {
      return;
    }

    try {
      const window = getCurrentWindow();
      const isMaximized = await window.isMaximized();

      if (isMaximized) {
        await window.unmaximize();
      } else {
        await window.maximize();
      }
    } catch (error) {
      console.error('Failed to toggle maximize:', error);
    }
  };

  const stopCapture = async () => {
    setStopLoading(true)
    refresh(2)
    await apiPost('/api/stopCapture')
    setStopLoading(false)
    setShowSave(true)
    setHadSaved(false)
    refresh(1)
  }

  // 点击首页按钮
  const onHomeButtonClick = (hadSaved = false) => {
    if (!hadSaved) {
      doWorkAfterSaveRef.current = onHomeButtonClick
      setShowSaveModal(true)
    } else {
      history.push('/home')
    }
  }

  // 点击开始抓包按钮
  const onCaptureButtonClick = (hadSaved = false) => {
    if (!hadSaved) {
      doWorkAfterSaveRef.current = onCaptureButtonClick
      setShowSaveModal(true)
    }
  }

  // 点击分析文件按钮
  const onFileButtonClick = (hadSaved = false) => {
    if (!hadSaved) {
      doWorkAfterSaveRef.current = onFileButtonClick
      setShowSaveModal(true)
    } else {
      handleSelectFile()
    }
  }

  // 保存
  const saveData = async () => {
    try {
      const selectedFilePath = await electronAPI.showSavePath()
      if (selectedFilePath) {
        try {
          await apiPost('/api/savePacket', { savePath: selectedFilePath, filter: '' })
          Message.success('保存成功')
          setHadSaved(true)
        } catch {
        }
      }
    } catch (error) {
      // console.error('文件选择或读取失败:', error);
    }
  }

  return (
    <div className={styles.navbar} onMouseDown={handleDragStart} onDoubleClick={handleDoubleClick}>
      <div className={styles.left}>
        <div className={styles.logo}>
          {/* <img src={Logo} style={{ width: '30px', marginLeft: '10px' }} alt="logo" />
          <div className={styles['logo-name']}>SimpleTshark</div> */}
          <Space>
            <Button style={{backgroundColor: '#F7BA1E'}} type={[2].includes(workStatus) ? 'secondary' : 'primary'} status='warning' disabled={[2].includes(workStatus)} onClick={() => onHomeButtonClick(hadSaved)}
              icon={<IconHome />}>
              首页
            </Button>

            <Popover
              trigger="click"
              popupVisible={poperVisible}
              className='!max-w-[650px]'
              onVisibleChange={(value) => setPoperVisible(value)}
              content={<div className='w-[600px]'><Capture type="home" onsubmit={() => {onsubmit(); setPoperVisible(false)}} /></div>}
            >
              <div onClick={(e) => e.stopPropagation()}>
                <Button type={[1, 2].includes(workStatus) ? 'secondary' : 'primary'} loading={loading} disabled={[1, 2].includes(workStatus)}
                  onClick={() => onCaptureButtonClick(hadSaved)}
                  icon={[1, 2].includes(workStatus) ? <IconRecord /> : <IconPlayCircle />}>
                  开始抓包
                </Button>
              </div>

            </Popover>

            <Button type={[0, 1].includes(workStatus) ? 'secondary' : 'primary'} loading={stopLoading} disabled={[0, 1, 3].includes(workStatus)} onClick={stopCapture} icon={<IconRecordStop />}>
              停止抓包
            </Button>
            <Button type={[1, 2].includes(workStatus) ? 'secondary' : 'primary'} disabled={[1, 2, 3].includes(workStatus)} onClick={() => onFileButtonClick(hadSaved)}
              icon={<IconFile />}>
              分析文件
            </Button>
            <Divider type='vertical' />
            <Button type={!showSave ? 'secondary' : 'primary'} disabled={!showSave} onClick={saveData} icon={<IconSave />}>保存</Button>
            {/* <Button type="primary">保存筛选结果</Button> */}
          </Space>
        </div>
      </div>
      <ul className={styles.right}>
        <li>

        </li>
      </ul>


      <Modal
        title='保存确认'
        visible={showSaveModal}
        onOk={() => {
          saveData()
          setShowSaveModal(false)
        }}
        onCancel={() => {
          setShowSaveModal(false)
        }}
        autoFocus={false}
        focusLock={true}
        footer={
          <>
            <Button onClick={() => {
              console.log('再看看')
              setShowSaveModal(false)
            }}>再看看</Button>
            <Button type='primary' status='danger' onClick={() => {
              setShowSaveModal(false)
              setHadSaved(true)
              if (doWorkAfterSaveRef.current != null) {
                doWorkAfterSaveRef.current(true)
              }
            }}>不保存</Button>
            <Button type="primary" onClick={async () => {
              setShowSaveModal(false)
              await saveData()
              if (doWorkAfterSaveRef.current != null) {
                doWorkAfterSaveRef.current(true)
              }
            }}>保存</Button>
          </>
        }
      >
        <p>
          数据包还没有保存，是否现在保存？
        </p>
      </Modal>

    </div>
  );
}

export default Navbar;
