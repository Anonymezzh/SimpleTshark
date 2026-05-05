import React, { useContext, useEffect, useState } from 'react';
import { Divider, Grid, Image, Link, Modal, Typography } from '@arco-design/web-react';
import { LayoutContext } from '@/layoutContext';

const githubIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M12 .5C5.65.5.5 5.66.5 12.02c0 5.09 3.29 9.4 7.86 10.92.58.11.79-.25.79-.56 0-.28-.01-1.19-.02-2.16-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.78 1.2 1.78 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.29-5.25-5.72 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.19 1.18a11.1 11.1 0 0 1 5.81 0c2.22-1.5 3.19-1.18 3.19-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.44-2.69 5.43-5.26 5.72.41.36.78 1.05.78 2.12 0 1.53-.01 2.76-.01 3.13 0 .31.21.68.8.56A11.53 11.53 0 0 0 23.5 12C23.5 5.66 18.35.5 12 .5Z" />
  </svg>
);

function Footer({ config }) {
  const statusMap = {
    0: '空闲中',
    1: '离线分析中',
    2: '抓包中',
    3: '监控网卡流量中',
  };

  const [visible, setVisible] = useState(false);
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
    const statusText = statusMap[workStatus];
    if (workStatus === 2) {
      return <>{statusText}{'.'.repeat(dotCount)}</>;
    }
    return statusText;
  };

  return (
    <div style={{ position: 'absolute', bottom: '-30px', left: 0, right: 0, color: 'var(--color-text-1)' }}>
      <Grid.Row>
        <Grid.Col span={8}>
          <div>
            {config.data?.map((item, index) => (
              <span key={index} className="mr-7">{item.title}：{item.num}{item.unit}</span>
            ))}
          </div>
        </Grid.Col>
        <Grid.Col span={8} style={{ textAlign: 'center' }}>
          <div>{renderStatusText()}</div>
        </Grid.Col>
        <Grid.Col span={8} style={{ textAlign: 'right' }}>
          <div onClick={() => setVisible(true)}>
            <Link>关于</Link>
          </div>
        </Grid.Col>
      </Grid.Row>

      <Modal
        title="关于SimpleTshark"
        visible={visible}
        onOk={() => setVisible(false)}
        onCancel={() => setVisible(false)}
        autoFocus={false}
        focusLock={true}
        footer={null}
      >
        <div style={{ textAlign: 'center' }}>
          <Typography.Title heading={5}>SimpleTshark：一款简单好用的抓包软件</Typography.Title>
          <div className="mt-5 mb-3">版本：V1.0.2</div>
          <div style={{ marginBottom: 16, fontSize: 14, lineHeight: 1.8 }}>
            <div style={{ fontWeight: 600 }}>开源地址：</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>{githubIcon}</span>
              <a href="https://github.com/xuanyuanzhifeng/simpletshark" target="_blank" rel="noopener noreferrer">
                https://github.com/xuanyuanzhifeng/simpletshark
              </a>
            </div>
            <div>如果这个项目对你有帮助，欢迎前往 GitHub 点个 Star 支持一下。</div>
          </div>
          <p>
            本软件调用了Wireshark项目的tshark工具用于网络分析。
            <br />
            tshark基于GPLv2协议，您可以在www.wireshark.org下载其源代码。
          </p>
          <div className="flex justify-between items-center" style={{ width: 400, margin: 'auto' }}>
            <span style={{ width: '50%', textAlign: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Image
                  width={135}
                  src={require('@/assets/images/1.png')}
                  alt="lamp"
                />
                <div style={{ marginTop: 20, minHeight: '40px' }}>
                  <div>问题反馈</div>
                  <div>请通过开源仓库 Issue 提交</div>
                </div>
              </div>
            </span>

            <Divider type="vertical" style={{ height: 120 }} />

            <span style={{ width: '50%', textAlign: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Image
                  width={135}
                  src={require('@/assets/images/3.png')}
                  alt="lamp"
                />
                <div style={{ marginTop: 20, minHeight: '40px', textAlign: 'center' }}>
                  <div><a href="https://wx.zsxq.com/group/51288824515124" target="_blank" rel="noopener noreferrer">欢迎加入知识星球学习SimpleTshark开发教程</a></div>
                </div>
              </div>
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default Footer;
