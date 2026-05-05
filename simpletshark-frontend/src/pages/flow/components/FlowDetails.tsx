import React, { useEffect, useLayoutEffect, useRef, useState, useContext } from 'react';
import { Card, Spin, Tabs, Tag, Typography } from '@arco-design/web-react';
import { Resizable } from 're-resizable';
import { useLocation } from 'react-router-dom';
import DataPage from '@/components/DataPage';
import { deviceTableConfig } from './config';
import { ipWithAddrAndFlag } from '@/utils/tools';
import DetailsList from '@/components/DetailsList';
import DataStream from '@/components/DataStream';
import styles from './styles/index.module.less'
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { calculateDuration } from '@/utils/tool';
import { protocolColor } from '@/components/enum';
import { apiPost } from '@/services/api';
import { GlobalContext } from '@/context';
const TabPane = Tabs.TabPane;
const { Ellipsis } = Typography
const FlowDetails = () => {
  const { background } = useContext(GlobalContext);
  const leftRef = useRef(null)
  const dataRef = useRef(null)
  const [data, setData] = useState([])
  const [newData, setNewData] = useState([])
  const [row, setRow] = useState(null)
  const [currentId, setCurrentId] = useState(null)
  const [leftScroll, setLeftScroll] = useState(false)
  const [page, setPage] = useState(null)
  const [obj, setObj] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const windowParams = new URLSearchParams(window.location.search)

  const sessionId = params.get('sessionId') || windowParams.get('sessionId')
  const [record, setRecord] = useState(JSON.parse(localStorage.getItem(`row${sessionId}`)))

  const handleResize = (e) => {
    const tableDom: any = document.querySelector('.arco-table-body')
    const listDom: any = document.querySelector('.datapackage-info')
    if (listDom && tableDom) {
      listDom.style.height = `calc(100vh - ${e.clientY + 63}px)`
      tableDom.style.height = `calc(100vh - ${listDom.offsetHeight + 200}px)`
      tableDom.style.maxHeight = `calc(100vh - ${listDom.offsetHeight + 200}px)`
    }
  }
  const onLoadFinish = (res, currentId, page) => {

    setLeftScroll(false)
    setPage(page)
    if (page > 1) {
      setNewData(res.data)
    } else {
      setData(res.data);
    }
    setCurrentId(currentId);
  }
  // 滚动到特定的行
  const scrollToBox = (rowIndex) => {
    // 使用 setTimeout 确保 DOM 已更新
    setTimeout(() => {
      const targetBox: any = document.getElementById(`new-box-${rowIndex}`);
      if (targetBox && leftRef.current) {
        // 计算目标元素相对于滚动容器的位置
        const container = leftRef.current;
        const containerRect = container.getBoundingClientRect();
        const targetRect = targetBox.getBoundingClientRect();

        // 计算滚动位置，使目标元素居中
        const scrollTop = container.scrollTop + (targetRect.top - containerRect.top) - (containerRect.height / 2) + (targetRect.height / 2);

        // 直接设置scrollTop，避免scrollIntoView导致页面滚动
        container.scrollTo({
          top: scrollTop,
          behavior: 'smooth'
        });
      }
    }, 100);
  };
  const getPacketCountInfo = async () => {
    const res: any = await apiPost('/api/getPacketCountInfo', { sessionId: record.belongSessionId ?? record.sessionId })
    setObj(res.data)
  }
  // 获取单个会话
  const getSessionList = async () => {
    const res: any = await apiPost('/api/getSessionList', { sessionId: record.belongSessionId })
    if (res.data.length > 0)
      setRecord(res.data[0])
  }
  useEffect(() => {
    getPacketCountInfo()
    // 定义处理滚动事件的函数
    const handleScroll = () => {
      if (leftRef.current) {
        const { scrollTop, scrollHeight, clientHeight } = leftRef.current;
        if (scrollTop + clientHeight >= scrollHeight) {
          setLeftScroll(true)
          // dataRef.current.loadData()
          console.log('Scrolled to the bottom!');
        }
      }
    };

    // 监听宽度变化
    const observeWidth = () => {
      if (leftRef.current) {
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            console.log('Left panel width changed to:', entry.contentRect.width);
            console.log('Computed style width:', window.getComputedStyle(entry.target).width);
          }
        });
        observer.observe(leftRef.current);
        return observer;
      }
    };

    if (leftRef.current) {
      leftRef.current.addEventListener('scroll', handleScroll);
    }
    const widthObserver = observeWidth();

    return () => {
      if (leftRef.current) {
        leftRef.current.removeEventListener('scroll', handleScroll);
      }
      if (widthObserver) {
        widthObserver.disconnect();
      }
      localStorage.removeItem('row')
    };
  }, [])
  useEffect(() => {
    setData([...data, ...newData])
  }, [newData])
  useLayoutEffect(() => {
    // const dom = document.querySelector(`#box-${currentId}`)
    // if(dom) dom.scrollIntoView({ block: 'center' })
  }, [data, currentId])
  useEffect(() => {
    if (record.type === 'all') {
      getSessionList()
    }
  }, [record])

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
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }
    : {
        backgroundImage: `url(${actualBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      };

  return (
    <div className={styles['detailsWrap']} style={bgStyle}>
      <Header type={params.get('windowIndex') == '0' || windowParams.get('windowIndex') == '0' ? "subWindow" : `subWindow${params.get('windowIndex') || windowParams.get('windowIndex')}`} />
      <div style={{ margin: 20 }} className={styles['details']}>
        <Tabs defaultActiveTab='1' type="card-gutter">
          <TabPane key='1' title='会话时序图'>
            <div style={{ margin: '0 0 10px 10px', overflow: 'visible' }}>
              <div style={{ display: 'flex', flexFlow: 'nowrap', gap: '24px', overflow: 'visible' }}>
                {/* 时序图面板 */}
                <div
                  style={{
                    flex: '0 0 450px',
                    flexShrink: 0,
                    flexGrow: 0,
                    flexBasis: '450px',
                    width: '450px',
                    minWidth: '450px',
                    maxWidth: '450px',
                    background: 'transparent',
                    backgroundColor: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.18)',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                    height: 'calc(100vh - 155px)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                  }}>
                  {/* 固定的头部区域：五元组和进程信息 */}
                  <div style={{
                    flexShrink: 0,
                    padding: '8px'
                  }}>
                    {/* 五元组信息区域 */}
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}>
                    <div style={{ width: 165 }}>
                      <Typography.Ellipsis showTooltip style={{ fontSize: '14px' }}>{record.ip1}:{record.ip1Port}</Typography.Ellipsis>
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                        <img className="nation-flag" style={{ marginRight: '5px', flexShrink: 0 }} src={require(`@/assets${ipWithAddrAndFlag(record.ip1, record.ip1Location)}`)} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.ip1Location}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '0 15px 0 5px' }}>
                      <div className={styles['arrow']}>
                        <span className={styles["agreement"]}>
                          <Tag color={protocolColor.find(v => v.label === (record.appProto || record.transProto))?.color} size='small' bordered style={{ padding: 0 }}>{record.appProto || record.transProto}</Tag>
                        </span>
                        <span className={styles["icon"]}></span>
                      </div>
                      <span>{calculateDuration(record.startTime, record.endTime)}</span>
                    </div>
                    <div style={{ width: 165 }}>
                      <Typography.Ellipsis showTooltip style={{ fontSize: '14px' }}>{record.ip2}:{record.ip2Port}</Typography.Ellipsis>
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                        <img className="nation-flag" style={{ marginRight: '5px', flexShrink: 0 }} src={require(`@/assets${ipWithAddrAndFlag(record.ip2, record.ip2Location)}`)} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.ip2Location}</span>
                      </div>
                    </div>
                  </div>

                    {/* 进程信息 */}
                    {record.processInfo && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        height: '40px',
                        marginTop: '6px',
                        padding: '0 12px'
                      }}>
                        进程信息：
                        <img
                          src={record.processInfo?.processIcoDataBase64}
                          style={{
                            width: '24px',
                            height: '24px',
                            flexShrink: 0
                          }}
                        />
                        <span style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: 1
                        }}>
                          {record.processInfo?.processName}(PID:{record.processInfo?.processId})
                        </span>
                      </div>
                    )}
                  </div>

                  {/* 可滚动的数据条目列表 */}
                  <div
                    ref={leftRef}
                    style={{
                      flex: 1,
                      overflowY: 'scroll',
                      overflowX: 'hidden',
                      padding: '0 8px 8px 8px',
                      position: 'relative',
                      WebkitOverflowScrolling: 'touch',
                      transform: 'translate3d(0, 0, 0)',
                      WebkitTransform: 'translate3d(0, 0, 0)',
                      overscrollBehavior: 'contain'
                    } as React.CSSProperties}
                  >
                  {data.map((item, index) => {
                    const isSelected = (currentId === item.frameNumber) || (!currentId && index === 0);
                    const isHovered = hoveredId === item.frameNumber;

                    // 确定背景色：选中 > hover > 颜色标记 > 默认
                    let bgColor;
                    if (isSelected) {
                      bgColor = 'rgba(82, 101, 255, 0.25)';
                    } else if (isHovered) {
                      bgColor = 'rgba(82, 101, 255, 0.15)';
                    } else if (item?.color) {
                      bgColor = `rgb(var(--${item.color}))`;
                    } else {
                      bgColor = 'rgba(255, 255, 255, 0.08)';
                    }

                    return (
                      <div
                        key={item.frameNumber}
                        id={`new-box-${item.frameNumber}`}
                        style={{
                          marginTop: '6px',
                          padding: '12px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          cursor: 'pointer',
                          background: bgColor,
                          backgroundColor: bgColor,
                          transition: 'background-color 0.2s ease',
                          width: '100%',
                          boxSizing: 'border-box'
                        }}
                        onMouseEnter={() => setHoveredId(item.frameNumber)}
                        onMouseLeave={() => setHoveredId(null)}
                        onClick={() => {
                          setCurrentId(item.frameNumber);
                          setRow(item);
                          if (dataRef.current && dataRef.current.scrollToRow) {
                            dataRef.current.scrollToRow(item.frameNumber);
                          }
                        }}
                      >
                        <div style={{ display: 'flex', width: 165 }}>
                          <div style={{ width: 60 }}>{item.orderNumber}</div>
                          <div>{index === 0 ? 0 : ((item.timestamp * 1000000) - (data[0].timestamp * 1000000)) / 1000000}</div>
                        </div>
                        <div style={{ margin: '0 15px 0 10px' }}>
                          <div className={`${styles['arrow']} ${styles[item.srcIP === record.ip1 ? 'arrow-right' : 'arrow-left']}`} style={{ marginTop: '-10px' }}>
                            <span className={styles["icon"]}></span>
                          </div>
                        </div>
                        <div style={{ width: 165 }}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{ width: 40 }}>{item.capLength}</div>
                            <Typography.Ellipsis showTooltip style={{ width: 130 }}>{item.timeorderInfo}</Typography.Ellipsis>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>

                <div style={{ width: 'calc(100% - 500px)', marginTop: -10, paddingRight: 10 }}>
                  <Resizable
                    style={{ paddingBottom: 10 }}
                    enable={{ left: false, right: false, bottom: true, top: false }}
                    onResize={(e: any) => handleResize(e)}
                  >
                    <DataPage
                      ref={dataRef}
                      config={deviceTableConfig}
                      currentId={currentId}
                      leftScroll={leftScroll}
                      page={page}
                      submitRowDetails={(value) => { setRow(value); setCurrentId(value.frameNumber); scrollToBox(value.frameNumber) }}
                      extraParams={{ sessionId: parseInt(record.belongSessionId) || parseInt(record.sessionId) }}
                      onLoadFinish={(res, currentId, page) => { onLoadFinish(res, currentId, page) }} />
                  </Resizable>
                  <div>
                    <DetailsList row={row} type="details" />
                  </div>
                </div>
              </div>
            </div>
          </TabPane>
          <TabPane key='2' title='会话数据流'>
            <div style={{ margin: '0 20px 20px 20px' }}>
              <DataStream sessionId={sessionId}/>
            </div>
          </TabPane>
        </Tabs>
        <Footer config={{ data: [{ title: '数据包总数', num: obj?.totalPackets || 0, unit: '个' }, { title: '总字节数', num: obj?.totalBytes || 0 }] }} />
      </div>
    </div>
  );
};

export default FlowDetails;
