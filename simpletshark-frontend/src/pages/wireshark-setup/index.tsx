import React, { useState, useEffect } from 'react';
import { Card, Button, Typography, Space, Alert, Message } from '@arco-design/web-react';
import { IconCheckCircleFill, IconCloseCircleFill, IconInfoCircle, IconCopy } from '@arco-design/web-react/icon';
import { invoke } from '@tauri-apps/api/core';
import { open as shellOpen } from '@tauri-apps/plugin-shell';
import styles from './style.module.less';
import logger from '@/utils/logger';
import Header from '@/components/Header';
import { platform } from '@tauri-apps/plugin-os';

const { Title, Text, Paragraph } = Typography;

interface WiresharkInfo {
  installed: boolean;
  version?: string;
  tshark_path?: string;
  error?: string;
}

const WIRESHARK_DOWNLOAD_URL = 'https://www.wireshark.org/download.html';
const LINUX_INSTALL_COMMAND = 'sudo apt install tshark';

const WiresharkSetup: React.FC = () => {
  const [checking, setChecking] = useState(false);
  const [wiresharkInfo, setWiresharkInfo] = useState<WiresharkInfo | null>(null);
  const [isLinux, setIsLinux] = useState<boolean | null>(null); // null 表示未检测

  const checkWireshark = async (autoEnter = false) => {
    setChecking(true);
    try {
      logger.info('Checking Wireshark installation...');
      const result = await invoke<WiresharkInfo>('check_wireshark');
      logger.info('Wireshark check result:', result);
      setWiresharkInfo(result);

      // 如果是重新检测且检测成功，直接进入应用
      if (autoEnter && result.installed && result.tshark_path) {
        try {
          logger.info('Auto-entering app after successful detection...');
          await invoke('start_tshark_server_command');
          logger.info('TShark server started successfully');
          window.location.hash = '#/home';
          window.location.reload();
        } catch (error) {
          logger.error('Failed to start TShark server:', error);
          // Still allow user to enter app
          window.location.hash = '#/home';
          window.location.reload();
        }
      }
    } catch (error) {
      logger.error('Failed to check Wireshark:', error);
      setWiresharkInfo({
        installed: false,
        error: '检测失败: ' + String(error),
      });
    } finally {
      setChecking(false);
    }
  };

  const openDownloadLink = async (url: string) => {
    try {
      logger.info('Opening URL in browser:', url);
      // Use Tauri's shell plugin to open URL in default browser
      await shellOpen(url);
    } catch (error) {
      logger.error('Failed to open URL:', error);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      Message.success('命令已复制到剪贴板');
    } catch (error) {
      logger.error('Failed to copy to clipboard:', error);
      Message.error('复制失败');
    }
  };

  useEffect(() => {
    // Check platform
    const checkPlatform = async () => {
      try {
        const platformName = await platform();
        const isLinuxPlatform = platformName === 'linux';
        setIsLinux(isLinuxPlatform);
      } catch (error) {
        logger.error('Failed to detect platform:', error);
        setIsLinux(false);
      }
    };

    // Auto check on mount
    checkPlatform();
    checkWireshark();
  }, []);

  const renderLinuxGuide = () => {
    return (
      <div>
        <Card bordered style={{ borderColor: 'rgb(var(--danger-6))' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 标题 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconCloseCircleFill style={{ color: 'rgb(var(--danger-6))', fontSize: 20 }} />
              <Text bold style={{ fontSize: 18 }}>启动失败！</Text>
            </div>

            {/* 提示文字 */}
            <div>
              <Text>
                SimpleTshark 需要使用 tshark（Wireshark 核心组件）进行数据包分析，请执行下面的命令安装：
              </Text>
            </div>

            {/* 命令框 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              backgroundColor: 'var(--color-fill-2)',
              borderRadius: 4,
              fontFamily: 'monospace'
            }}>
              <Text code style={{ flex: 1 }}>{LINUX_INSTALL_COMMAND}</Text>
              <Button
                type="text"
                size="small"
                icon={<IconCopy />}
                onClick={() => copyToClipboard(LINUX_INSTALL_COMMAND)}
              >
                复制
              </Button>
            </div>

            {/* 重新检测 */}
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">我已安装tshark，</Text>
              <Button
                type="text"
                style={{ color: 'rgb(var(--primary-6))', padding: '0 4px' }}
                onClick={() => checkWireshark(true)}
                loading={checking}
              >
                点击重新检测
              </Button>
            </div>
          </Space>
        </Card>
      </div>
    );
  };

  const renderOtherPlatformGuide = () => {
    return (
      <div>
        <Card bordered style={{ borderColor: 'rgb(var(--danger-6))' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* 标题 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconCloseCircleFill style={{ color: 'rgb(var(--danger-6))', fontSize: 20 }} />
              <Text bold style={{ fontSize: 18 }}>启动失败！</Text>
            </div>

            {/* 提示文字 */}
            <div>
              <Text>
                SimpleTshark 需要使用 Wireshark 的核心组件进行数据包分析，请先根据您的操作系统下载并安装 Wireshark (4.2 或更高版本)。
              </Text>
            </div>

            {/* 下载按钮 */}
            <div style={{ textAlign: 'center' }}>
              <Button
                type="primary"
                size="large"
                style={{ minWidth: 200 }}
                onClick={() => openDownloadLink(WIRESHARK_DOWNLOAD_URL)}
              >
                前往官网下载安装Wireshark（4.2或更高版本）
              </Button>
            </div>

            {/* 重新检测 */}
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary">我已安装Wireshark，</Text>
              <Button
                type="text"
                style={{ color: 'rgb(var(--primary-6))', padding: '0 4px' }}
                onClick={() => checkWireshark(true)}
                loading={checking}
              >
                点击重新检测
              </Button>
            </div>
          </Space>
        </Card>
      </div>
    );
  };

  return (
    <div className={styles.container} style={{ overflow: 'hidden' }}>
      <Header type="mainWindow" />
      <div className={styles.content} style={{ overflow: 'hidden' }}>
        <div className={styles.contentInner} style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100%',
          padding: '20px',
          overflow: 'hidden'
        }}>
          <div style={{ maxWidth: 600, width: '100%' }}>
            {/* 根据平台显示对应的引导 */}
            {isLinux === null ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Text>正在检测系统平台...</Text>
              </div>
            ) : (
              isLinux ? renderLinuxGuide() : renderOtherPlatformGuide()
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WiresharkSetup;
