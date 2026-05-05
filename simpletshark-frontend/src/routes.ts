import auth, { AuthParams } from '@/utils/authentication';
import { useEffect, useMemo, useState } from 'react';

export type IRoute = AuthParams & {
  name: string;
  key: string;
  // 当前页是否展示面包屑
  breadcrumb?: boolean;
  children?: IRoute[];
  // 当前路由是否渲染菜单项，为 true 的话不会在菜单中显示，但可通过路由地址访问。
  ignore?: boolean;
};

export const routes: IRoute[] = [
  {
    name: '数据包',
    key: 'dataPacket',
    children: [
      {
        name: '全部数据包',
        key: 'dataPacket/all'
      },
      {
        name: 'ARP数据包',
        key: 'dataPacket/arp'
      },
      {
        name: 'ICMP数据包',
        key: 'dataPacket/icmp'
      },
      {
        name: 'ICMPv6数据包',
        key: 'dataPacket/icmpv6'
      },
    ]
  },
  {
    name: '通信会话',
    key: 'flow',
    children: [
      {
        name: 'TCP会话',
        key: 'flow/tcp'
      },
      {
        name: 'UDP会话',
        key: 'flow/udp'
      },
      {
        name: 'DNS会话',
        key: 'flow/dns'
      },
      {
        name: 'HTTP会话',
        key: 'flow/http'
      },
      {
        name: 'SSL/TLS会话',
        key: 'flow/ssl'
      },
      {
        name: 'SSH会话',
        key: 'flow/ssh'
      },
      {
        name: '进程分析',
        key: 'flow/process'
      }
      // {
      //   name: 'Redis会话',
      //   key: 'flow/redis'
      // },
      // {
      //   name: 'MySQL会话',
      //   key: 'flow/mysql'
      // }
    ]
  },
  {
    name: '统计分析',
    key: 'statistics',
    children: [
      {
        name: 'IP统计',
        key: 'statistics/ip'
      },
      {
        name: '协议统计',
        key: 'statistics/protocol'
      },
      {
        name: '国家统计',
        key: 'statistics/country'
      }
    ]
  },
];

export const getName = (path: string, routes) => {
  return routes.find((item) => {
    const itemPath = `/${item.key}`;
    if (path === itemPath) {
      return item.name;
    } else if (item.children) {
      return getName(path, item.children);
    }
  });
};

export const generatePermission = (role: string) => {
  const actions = role === 'admin' ? ['*'] : ['read'];
  const result = {};
  routes.forEach((item) => {
    if (item.children) {
      item.children.forEach((child) => {
        result[child.name] = actions;
      });
    }
  });
  return result;
};

const useRoute = (userPermission): [IRoute[], string] => {
  const filterRoute = (routes: IRoute[], arr = []): IRoute[] => {
    if (!routes.length) {
      return [];
    }
    for (const route of routes) {
      const { permission } = route;
      let visible = true;
      if (permission) {
        visible = auth(permission, userPermission);
      }

      if (!visible) {
        continue;
      }
      if (route.children && route.children.length) {
        const newRoute = { ...route, children: [] };
        filterRoute(route.children, newRoute.children);
        if (newRoute.children.length) {
          arr.push(newRoute);
        }
      } else {
        arr.push({ ...route });
      }
    }

    return arr;
  };

  const [permissionRoute, setPermissionRoute] = useState(routes);

  useEffect(() => {
    const newRoutes = filterRoute(routes);
    setPermissionRoute(newRoutes);
  }, [JSON.stringify(userPermission)]);

  const defaultRoute = useMemo(() => {
    const first = permissionRoute[0];
    if (first) {
      const firstRoute = first?.children?.[0]?.key || first.key;
      return firstRoute;
    }
    return '';
  }, [permissionRoute]);

  return [permissionRoute, defaultRoute];
};

export default useRoute;
