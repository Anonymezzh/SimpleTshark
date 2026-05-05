import './style/global.less';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import store from './stores';
import { Provider } from 'react-redux';
import { ConfigProvider } from '@arco-design/web-react';
import zhCN from '@arco-design/web-react/es/locale/zh-CN';
import enUS from '@arco-design/web-react/es/locale/en-US';
import { HashRouter, Switch, Route, Redirect } from 'react-router-dom';
import PageLayout from './layout';
import { GlobalContext } from './context';
import changeTheme from './utils/changeTheme';
import useStorage from './hooks/useStorage';
import Home from './pages/home'
import FlowDetails from './pages/flow/components/FlowDetails'
import WiresharkSetup from './pages/wireshark-setup'
import './mock';
import logger from './utils/logger';
import { isTauri, tauriAPI } from './utils/tauri';
import { invoke } from '@tauri-apps/api/core';

// 应用启动日志
logger.info('=== SimpleTshark Frontend Starting ===');
logger.info('Environment:', process.env.NODE_ENV);
logger.info('Platform:', navigator.platform);
logger.info('User Agent:', navigator.userAgent);
logger.info('Is Tauri:', '__TAURI__' in window);

interface WiresharkInfo {
  installed: boolean;
  version?: string;
  tshark_path?: string;
  error?: string;
}

function Index() {
  const [needWiresharkSetup, setNeedWiresharkSetup] = useState(false);
  const [checkingWireshark, setCheckingWireshark] = useState(true);
  const [lang, setLang] = useStorage('arco-lang', 'zh-CN');
  const [theme, setTheme] = useStorage('arco-theme', 'light');
  const [background, setBackground] = useStorage('simpletshark-background', '');

  function getArcoLocale() {
    switch (lang) {
      case 'zh-CN':
        return zhCN;
      case 'en-US':
        return enUS;
      default:
        return zhCN;
    }
  }

  useEffect(() => {
    logger.info('Changing theme to:', theme);
    changeTheme(theme);
  }, [theme]);

  // Check Wireshark on startup (Tauri only)
  useEffect(() => {
    const checkWiresharkOnStartup = async () => {
      if (isTauri()) {
        try {
          logger.info('Checking Wireshark installation on startup...');
          const result = await invoke<WiresharkInfo>('check_wireshark');
          logger.info('Wireshark check result:', result);

          // If not installed or version too old, show setup page
          if (!result.installed || !result.tshark_path) {
            logger.warn('Wireshark not properly installed, redirecting to setup page');
            setNeedWiresharkSetup(true);
          } else {
            logger.info('Wireshark properly installed, version:', result.version);
            setNeedWiresharkSetup(false);
          }
        } catch (error) {
          logger.error('Failed to check Wireshark on startup:', error);
          setNeedWiresharkSetup(true);
        } finally {
          setCheckingWireshark(false);
        }
      } else {
        setCheckingWireshark(false);
      }
    };

    checkWiresharkOnStartup();
  }, []);

  useEffect(() => {
    logger.info('Index component mounted');
    logger.info('Current route:', window.location.hash);
    // 自动打开 Tauri DevTools，便于排查问题
    // if (isTauri()) {
    //   tauriAPI.openDevtools?.();
    // }
  }, []);

  // 关闭右键菜单（全局）
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, []);

  // 监听localStorage变化，实现跨窗口同步
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'simpletshark-background' && e.newValue !== null) {
        setBackground(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [setBackground]);

  const contextValue = {
    lang,
    setLang,
    theme,
    setTheme,
    background,
    setBackground
  };

  // Show loading while checking Wireshark
  if (checkingWireshark) {
    return (
      <ConfigProvider locale={getArcoLocale()}>
        <div style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff'
        }}>
          <div style={{ textAlign: 'center', color: 'rgb(var(--primary-6))' }}>
            <div style={{ fontSize: 18, marginBottom: 16 }}>正在检查 Wireshark 安装状态...</div>
          </div>
        </div>
      </ConfigProvider>
    );
  }

  // Show Wireshark setup page if needed
  if (needWiresharkSetup) {
    return (
      <HashRouter>
        <ConfigProvider locale={getArcoLocale()}>
          <WiresharkSetup />
        </ConfigProvider>
      </HashRouter>
    );
  }

  return (
    <HashRouter>
      <ConfigProvider
        locale={getArcoLocale()}
        componentConfig={{
          Card: {
            bordered: false
          },
          List: {
            bordered: false
          },
          Table: {
            border: false
          }
        }}
      >
        <Provider store={store}>
          <GlobalContext.Provider value={contextValue}>
            <Switch>
              <Route path="/home" component={Home} />
              <Route path="/dataPacket" component={PageLayout} />
              <Route path="/flow" component={PageLayout} />
              <Route path="/statistics" component={PageLayout} />
              <Route path="/process" component={PageLayout} />
              <Route path="/details" component={FlowDetails} />
              <Redirect to="/home" />
            </Switch>
          </GlobalContext.Provider>
        </Provider>
      </ConfigProvider>
    </HashRouter>
  );
}

ReactDOM.render(<Index />, document.getElementById('root'));
