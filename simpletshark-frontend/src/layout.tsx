import React, { useState, useRef, useMemo, useEffect, useContext } from 'react';
import { Switch, Route, Redirect, useHistory } from 'react-router-dom';
import { Layout, Menu, Spin } from '@arco-design/web-react';
import cs from 'classnames';
import {
  IconCodeSandbox,
  IconMenuFold,
  IconMenuUnfold,
  IconDesktop,
  IconLock,
} from '@arco-design/web-react/icon';
import { DataPacketIcon, FlowIcon, StatisticsIcon } from '@/utils/icons'
import { useAppSelector, useAppDispatch } from '@/stores/hooks';
import qs from 'query-string';
import NProgress from 'nprogress';
import Navbar from './components/NavBar';
import useRoute, { IRoute } from '@/routes';
import useLocale from './utils/useLocale';
import getUrlParams from './utils/getUrlParams';
import lazyload from './utils/lazyload';
import styles from './style/layout.module.less';
import notMenuKeys from '@/utils/notMenuKeys';
import Header from './components/Header';
import { apiGet, apiPost } from './services/api';
import { LayoutContext } from './layoutContext';
import { GlobalContext } from './context';
import homeBg from '@/assets/images/background4.jpg';
import emitter from '@/utils/emitter';
import logger from '@/utils/logger';

const MenuItem = Menu.Item;
const SubMenu = Menu.SubMenu;
// const ipcRenderer = require('electron').ipcRenderer;
const Sider = Layout.Sider;
const Content = Layout.Content;

function getIconFromKey(key) {
  switch (key) {
    case 'dataPacket':
      return <DataPacketIcon />;
    case 'flow':
      return <FlowIcon />;
    case 'statistics':
      return <StatisticsIcon />;
    default:
      return <div className={styles['icon-empty']} />;
  }
}

function getFlattenRoutes(routes) {
  const res = [];

  function travel(_routes) {
    _routes.forEach((route) => {
      const visibleChildren = (route.children || []).filter(
        (child) => !child.ignore
      );
      if (route.key && (!route.children || !visibleChildren.length)) {
        try {
          route.component = lazyload(() => import(`./pages/${route.key}`));
          res.push(route);
        } catch (e) {
          console.error(e);
        }
      }
      if (route.children && route.children.length) {
        travel(route.children);
      }
    });
  }

  travel(routes);
  return res;
}

function PageLayout() {
  const [isMaximized, setIsMaximized] = useState(false)
  const urlParams = getUrlParams();
  const history = useHistory();
  const pathname = history.location.pathname;
  const currentComponent = qs.parseUrl(pathname).url.slice(1);
  const locale = useLocale();
  const { userInfo, settings, userLoading } = useAppSelector((state) => state.user);
  const dispatch = useAppDispatch();
  const { background } = useContext(GlobalContext);

  const [routes, defaultRoute] = useRoute(userInfo?.permissionKeys);
  const defaultSelectedKeys = [currentComponent || defaultRoute];
  const paths = (currentComponent || defaultRoute).split('/');
  const defaultOpenKeys = ['dataPacket', 'flow', 'statistics'];

  const [breadcrumb, setBreadCrumb] = useState([]);
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [refreshLoading, setRefreshLoading] = useState(null)
  const [workStatus, setWorkStatus] = useState(0)

  const [selectedKeys, setSelectedKeys] =
    useState<string[]>(defaultSelectedKeys);
  const [openKeys, setOpenKeys] = useState<string[]>(defaultOpenKeys);

  const routeMap = useRef<Map<string, React.ReactNode[]>>(new Map());
  const menuMap = useRef<
    Map<string, { menuItem?: boolean; subMenu?: boolean }>
  >(new Map());

  const navbarHeight = 50;
  const menuWidth = collapsed ? 48 : settings.menuWidth;

  const showNavbar = settings.navbar && urlParams.navbar !== false;
  const showMenu = settings.menu && urlParams.menu !== false;
  const showFooter = settings.footer && urlParams.footer !== false;

  const flattenRoutes = useMemo(() => getFlattenRoutes(routes) || [], [routes]);

  function renderRoutes(locale) {
    routeMap.current.clear();
    return function travel(_routes: IRoute[], level, parentNode = []) {
      return _routes.map((route) => {
        const { breadcrumb = true, ignore } = route;
        const iconDom = getIconFromKey(route.key);
        const titleDom = (
          <>
            {iconDom} {locale[route.name] || route.name}
          </>
        );

        routeMap.current.set(
          `/${route.key}`,
          breadcrumb ? [...parentNode, route.name] : []
        );

        const visibleChildren = (route.children || []).filter((child) => {
          const { ignore, breadcrumb = true } = child;
          if (ignore || route.ignore) {
            routeMap.current.set(
              `/${child.key}`,
              breadcrumb ? [...parentNode, route.name, child.name] : []
            );
          }

          return !ignore;
        });

        if (ignore) {
          return '';
        }
        if (visibleChildren.length) {
          menuMap.current.set(route.key, { subMenu: true });
          return (
            <SubMenu key={route.key} title={titleDom}>
              {travel(visibleChildren, level + 1, [...parentNode, route.name])}
            </SubMenu>
          );
        }
        menuMap.current.set(route.key, { menuItem: true });
        return <MenuItem key={route.key}>{titleDom}</MenuItem>;
      });
    };
  }

  function onClickMenuItem(key) {
    const currentRoute = flattenRoutes.find((r) => r.key === key);
    const component = currentRoute.component;
    const preload = component.preload();
    NProgress.start();
    preload.then(() => {
      history.push(currentRoute.path ? currentRoute.path : `/${key}`);
      NProgress.done();
    });
  }

  function toggleCollapse() {
    setCollapsed((collapsed) => !collapsed);
  }

  const paddingLeft = showMenu ? { paddingLeft: menuWidth } : {};
  const paddingTop = showNavbar ? { paddingTop: navbarHeight } : {};
  const paddingStyle = { ...paddingLeft, ...paddingTop };
  function updateMenuStatus() {
    const pathKeys = pathname.split('/');
    const newSelectedKeys: string[] = [];
    const newOpenKeys: string[] = [...openKeys];
    while (pathKeys.length > 0) {
      const currentRouteKey = pathKeys.join('/');
      const menuKey = currentRouteKey.replace(/^\//, '');
      const menuType = menuMap.current.get(menuKey);
      if (menuType && menuType.menuItem) {
        newSelectedKeys.push(menuKey);
      }
      if (menuType && menuType.subMenu && !openKeys.includes(menuKey)) {
        newOpenKeys.push(menuKey);
      }
      pathKeys.pop();
    }
    setSelectedKeys(newSelectedKeys);
    setOpenKeys(newOpenKeys);
  }
  const handleSelectFile = async () => {
    try {
      const { electronAPI } = await import('@/utils/tauri');
      const selectedFilePath = await electronAPI.openFileDialog()
      if (selectedFilePath) {
        setRefreshLoading(2)
        logger.info('[Layout] 📂 开始离线分析文件，发送清空缓存事件');
        emitter.emit('clearPacketDetailCache'); // 清空数据包详情缓存
        try {
          await apiPost('/api/analysisFile', { filePath: selectedFilePath })
          setRefreshLoading(1)
        } catch {
          setRefreshLoading(1)
        }
      }
    } catch (error) {
      console.error('文件选择或读取失败:', error);
    }
  };
  let intervalId = null
  const getWorkStatus = async () => {
    const values = await apiGet('/api/getWorkStatus')
    setWorkStatus(values.data?.workStatus)
    if (values.data?.workStatus === 0)
      clearInterval(intervalId)
  }
  const onsubmit = () => {
    getWorkStatus()
    intervalId = setInterval(getWorkStatus, 5000);
  }
  useEffect(() => {
    getWorkStatus()
    intervalId = setInterval(getWorkStatus, 5000);
    return () => clearInterval(intervalId);
  }, [])
  // 监听路由变化时候更新菜单状态
  useEffect(() => {
    // 不展示侧边菜单栏页面处理
    if (notMenuKeys.some(key => pathname.startsWith(key))) {
      // dispatch(setSettings({ ...settings, menu: false }));
      // setCollapsed(true);
    } else {
      // dispatch(setSettings({ ...settings, menu: true }));
    }
    // 更新面包屑
    const routeConfig = routeMap.current.get(pathname);
    setBreadCrumb(routeConfig || []);
    updateMenuStatus();
  }, [pathname]);

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
        background: actualBackground
      }
    : {
        backgroundImage: `url(${actualBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      };

  return (
    <div
      className={styles['workBgWrap']}
      style={bgStyle}
    >
      <Header type="mainWindow" />
      <Spin loading={refreshLoading === 2} block>
        <LayoutContext.Provider value={{ refreshLoading, workStatus }}>
          <Layout className={styles.layout}>
            <div
              className={cs(styles['layout-navbar'], {
                [styles['layout-navbar-hidden']]: !showNavbar
              })}
            >
              <Navbar
                handleSelectFile={handleSelectFile}
                refresh={setRefreshLoading}
                onsubmit={onsubmit}
              />
            </div>
            {userLoading ? (
              <Spin className={styles['spin']} />
            ) : (
              <Layout>
                {showMenu && (
                  <Sider
                    className={styles['layout-sider']}
                    width={menuWidth}
                    collapsed={collapsed}
                    onCollapse={setCollapsed}
                    trigger={null}
                    collapsible
                    breakpoint="xl"
                    style={{
                      paddingTop: 0,
                      backgroundColor: collapsed ? 'rgba(var(--glass-white-rgb), 0)' : 'rgba(var(--glass-white-rgb), 0.08)',
                      background: collapsed ? 'rgba(var(--glass-white-rgb), 0)' : 'rgba(var(--glass-white-rgb), 0.08)'
                    }}
                  >
                    <div className={styles['menu-wrapper']}>
                      <Menu
                        collapse={collapsed}
                        onClickMenuItem={onClickMenuItem}
                        selectedKeys={selectedKeys}
                        openKeys={openKeys}
                        onClickSubMenu={(_, openKeys) => setOpenKeys(openKeys)}
                        ellipsis={false}
                      >
                        {renderRoutes(locale)(routes, 1)}
                      </Menu>
                    </div>
                    <div className={styles['collapse-btn']} onClick={toggleCollapse}>
                      {collapsed ? <IconMenuUnfold /> : <IconMenuFold />}
                    </div>
                  </Sider>
                )}
                <Layout className={styles['layout-content']} style={paddingStyle}>
                  <div className={styles['layout-content-wrapper']}>
                    {/*{!!breadcrumb.length && (*/}
                    {/*  <div className={style['layout-breadcrumb']}>*/}
                    {/*    <Breadcrumb>*/}
                    {/*      {breadcrumb.map((node, index) => (*/}
                    {/*        <Breadcrumb.Item key={index}>*/}
                    {/*          {typeof node === 'string' ? locale[node] || node : node}*/}
                    {/*        </Breadcrumb.Item>*/}
                    {/*      ))}*/}
                    {/*    </Breadcrumb>*/}
                    {/*  </div>*/}
                    {/*)}*/}
                    <Content>
                      <Switch>
                        {flattenRoutes.map((route, index) => {
                          return (
                            <Route
                              key={index}
                              path={`/${route.key}`}
                              component={route.component}
                            />
                          );
                        })}
                        <Route exact path="/">
                          <Redirect to={`/${defaultRoute}`} />
                        </Route>
                        {/*<Route*/}
                        {/*  path="*"*/}
                        {/*  component={lazyload(() => import('./pages/exception/403'))}*/}
                        {/*/>*/}
                      </Switch>
                    </Content>
                  </div>
                  {showFooter && <footer></footer>}
                </Layout>
              </Layout>
            )}
          </Layout>
        </LayoutContext.Provider>
      </Spin>
    </div>
  );
}

export default PageLayout;
