import React, { useContext, useEffect, useState } from 'react';
import { Grid } from '@arco-design/web-react';
import { LayoutContext } from '@/layoutContext';

interface FooterItem {
  title: string;
  num: string | number;
  unit?: string;
}

interface FooterProps {
  config?: {
    data?: FooterItem[];
  };
}

function Footer({ config }: FooterProps) {
  const statusMap: Record<number, string> = {
    0: '空闲中',
    1: '离线分析中',
    2: '抓包中',
    3: '监控网卡流量中',
  };

  const { workStatus } = useContext(LayoutContext);
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    if (workStatus === 2) {
      const interval = setInterval(() => {
        setDotCount((prev) => (prev + 1) % 4);
      }, 500);
      return () => clearInterval(interval);
    }

    setDotCount(0);
  }, [workStatus]);

  const renderStatusText = () => {
    const statusText = statusMap[workStatus] || '未知状态';
    if (workStatus === 2) {
      return `${statusText}${'.'.repeat(dotCount)}`;
    }
    return statusText;
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '-30px',
        left: 0,
        right: 0,
        color: 'var(--color-text-1)',
      }}
    >
      <Grid.Row>
        <Grid.Col span={8}>
          <div>
            {config?.data?.map((item, index) => (
              <span key={index} className="mr-7">
                {item.title}: {item.num}
                {item.unit || ''}
              </span>
            ))}
          </div>
        </Grid.Col>
        <Grid.Col span={8} style={{ textAlign: 'center' }}>
          <div>{renderStatusText()}</div>
        </Grid.Col>
        <Grid.Col span={8} style={{ textAlign: 'right' }}>
          <div />
        </Grid.Col>
      </Grid.Row>
    </div>
  );
}

export default Footer;
