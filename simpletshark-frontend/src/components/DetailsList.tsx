import React, { useEffect, useState } from 'react';
import { treeList, hexCharCodeToStr, strTwoSplit, isInteger, padNumber } from '@/utils/tool'
import { Empty, Spin, Tree } from '@arco-design/web-react';
import { apiPost } from '@/services/api';
import { IconCaretDown, IconDashboard, IconDown } from '@arco-design/web-react/icon';
import logger from '@/utils/logger';
import emitter from '@/utils/emitter';

function DetailsList({ row = null, type = null }) {
  const [sigleHexData, setSigleHexData] = useState([])
  const [hexadecimalData, setHexadecimalData] = useState([])
  const [selectedLeftHex, setSelectedLeftHex] = useState([])
  const [selectedRightHex, setSelectedRightHex] = useState([])
  const [ascData, setAscData] = useState([])
  const [treeData, setTreeData] = useState([])
  const [selectedKeys, setSelectedKeys] = useState([])
  const [spinning, setSpinning] = useState(false)
  const [bytesPerLine, setBytesPerLine] = useState(8) // 默认每行8字节
  const [cachedPacketData, setCachedPacketData] = useState<Map<number, any>>(new Map()) // 缓存已获取的数据包详情
  // 定义一个生成唯一ID的闭包
  const makeIdGenerator = () => {
    let idCounter = 0;
    return () => ++idCounter;
  };

  // 创建一个ID生成器实例
  const generateId = makeIdGenerator();
  const addUniqueID = (node) => {
    const updatedNode = { ...node, id: generateId().toString() };
    if (Array.isArray(updatedNode.field) && updatedNode.field.length > 0) {
      updatedNode.field = updatedNode.field.map(addUniqueID);
    }
    return updatedNode;
  };
  const handleResize = () => {
    const tableDom: HTMLElement | null = document.querySelector('.arco-table-body');
    const listDom: HTMLElement | null = document.querySelector('.datapackage-info');
    if (!tableDom || !listDom) {
      return;
    }
    const offset = type ? 180 : 270;
    listDom.style.height = `calc(100vh - ${tableDom.offsetHeight + offset}px)`;
  };

  // 监听窗口大小变化，动态调整每行字节数
  useEffect(() => {
    const updateBytesPerLine = () => {
      const offsetElement = document.querySelector('.datapackage-info .offset');
      if (offsetElement) {
        const width = offsetElement.clientWidth;
        // 如果宽度小于600px，使用8字节，否则使用16字节
        const newBytesPerLine = width < 600 ? 8 : 16;
        if (newBytesPerLine !== bytesPerLine) {
          setBytesPerLine(newBytesPerLine);
        }
      }
    };

    updateBytesPerLine();
    window.addEventListener('resize', updateBytesPerLine);
    return () => window.removeEventListener('resize', updateBytesPerLine);
  }, []);

  // 当bytesPerLine变化时，重新加载数据
  useEffect(() => {
    if (row) {
      getPacketDetail();
    }
  }, [bytesPerLine]);

  // 获取数据包详情
  const getPacketDetail = async () => {
    const frameNumber = row?.frameNumber
    if (!frameNumber) return

    // 检查缓存中是否已有数据
    const cached = cachedPacketData.get(frameNumber)
    if (cached) {
      logger.info(`[DetailsList] 📦 缓存命中 - frameNumber: ${frameNumber}, 缓存大小: ${cachedPacketData.size}`)
      const tree = cached?.proto.map(addUniqueID);
      setTreeData(tree)
      setSelectedKeys([cached?.proto[0]?.name])
      getAscTransformation(cached?.hexdata)
      handleResize()
      return
    }

    logger.info(`[DetailsList] 🌐 请求后端 - frameNumber: ${frameNumber}, 缓存大小: ${cachedPacketData.size}`)
    setSpinning(true)
    const res: any = await apiPost('/api/getPacketDetail', { frameNumber })
    if (res.data != null) {
      logger.info(`[DetailsList] ✅ 后端响应成功 - frameNumber: ${frameNumber}, 已缓存`)
      // 缓存成功获取的数据
      setCachedPacketData(prev => {
        const newCache = new Map(prev)
        newCache.set(frameNumber, res.data)
        return newCache
      })

      const tree = res?.data?.proto.map(addUniqueID);
      setTreeData(tree)
      setSelectedKeys([res?.data?.proto[0]?.name])
      getAscTransformation(res?.data?.hexdata)
      handleResize()
      setSpinning(false)
    } else {
      logger.warn(`[DetailsList] ⚠️ 后端响应为空 - frameNumber: ${frameNumber}`)
      setSpinning(false)
    }
  }

  // 重置缓存状态（在重新开始抓包或离线分析时调用）
  const resetCache = () => {
    logger.info(`[DetailsList] 🗑️ 清空缓存和界面数据 - 之前缓存大小: ${cachedPacketData.size}`)
    // 清空缓存
    setCachedPacketData(new Map())
    // 清空界面显示的数据
    setTreeData([])
    setSelectedKeys([])
    setSigleHexData([])
    setHexadecimalData([])
    setAscData([])
    setSelectedLeftHex([])
    setSelectedRightHex([])
  }
  // 点击hex,ascii高亮并高亮左侧树
  const clickCenter = (item) => {
    // tree转一维数组与当前选中字节对比，tree中size最小的选中
    const _treeList = treeList(treeData)
    // let pos = treeList.filter(v => v.Pos === item.key)
    const pos = []
    _treeList.map(v => {
      if (v.Size !== 0) {
        if (item.key >= v.Pos && item.key <= v.Pos + v.Size) {
          pos.push(v)
        }
      }
    })
    const min = pos.length > 0 && pos.reduce((a, b) => a.Size > 0 && a.Size < b.Size ? a : b)
    setSelectedRightHex([item.key])
    const posLeft = !isInteger((item.key + 1) / bytesPerLine) ? ((item.key + 1) / bytesPerLine >> 0) + 1 : (item.key + 1) / bytesPerLine
    setSelectedLeftHex([posLeft])
  }
  // 组装十六进制展示
  const getAscTransformation = (hex) => {
    const hexData = []
    const ascData = []
    const sigleHexData = []
    // 十六进制转换为ascii码
    const params = hexCharCodeToStr(hex)
    for (let i = 0; i < params.length; i++) {
      const asc = { label: params[i], key: i, show: false }
      // 如果是..，则表达找不到该ascii码，用虚拟.表达
      const str = ['换', '行', '无']
      if (str.includes(params[i])) {
        asc.label = '.'
        asc.show = true
      }
      ascData.push(asc)
    }
    const arr = strTwoSplit(hex).split(',')
    arr.map((item, index) => {
      hexData.push({ label: item, key: index })
    })
    // 判断是总偏移量个数是否为整数，不为整数向上取整
    let offset: any = ascData.length / bytesPerLine
    if (!isInteger(offset)) {
      offset = parseInt(offset) + 1
    }
    // 计算偏移量 不够四位左侧补位0
    for (let i = 0; i < offset; i++) {
      const hex = padNumber((i * bytesPerLine).toString(16), 4, 0)
      sigleHexData.push({ label: hex, key: i + 1 })
    }
    setHexadecimalData(hexData)
    setAscData(ascData)
    setSigleHexData(sigleHexData)
  }
  // 点击节点高亮偏移量
  const handleNodeClick = (node, data) => {
    setSelectedKeys(node)
    const pos = parseInt(data.node?.props.pos)
    const size = parseInt(data.node?.props.size) + pos
    const leftArr = []
    const rightArr = []
    for (let i = pos; i < size; i++) {
      leftArr.push(i)
    }
    setSelectedRightHex([...leftArr])
    // 计算偏移量是否选中
    if (data.node && parseInt(data.node?.props.size) !== 0) {
      const posLeft = !isInteger((pos + 1) / bytesPerLine) ? ((pos + 1) / bytesPerLine >> 0) + 1 : (pos + 1) / bytesPerLine
      const sizeLeft = !isInteger(size / bytesPerLine) ? (size / bytesPerLine >> 0) + 1 : size / bytesPerLine
      for (let i = posLeft; i <= sizeLeft; i++) {
        rightArr.push(i)
      }
      setSelectedLeftHex([...rightArr])
    } else {
      setSelectedLeftHex([])
    }
  }
  const renderTitle = (node) => {
    const title = node.dataRef.showname || node.dataRef.name || node.dataRef.show
    if (node._level === 0) {
      return <span style={{ color: 'rgb(var(--primary-5))' }}>{title}</span>;
    }
    return title;
  };

  // 监听清空缓存事件
  useEffect(() => {
    const handleClearCache = () => {
      logger.info(`[DetailsList] 📬 收到清空缓存事件`)
      resetCache()
    }

    // 注册事件监听
    emitter.on('clearPacketDetailCache', handleClearCache)

    // 组件卸载时移除监听
    return () => {
      emitter.off('clearPacketDetailCache', handleClearCache)
    }
  }, [])

  useEffect(() => {
    if (row) {
      setSelectedLeftHex([])
      setSelectedRightHex([])
      getPacketDetail()
    }
  }, [row?.frameNumber])
  // 动态计算每个字节的宽度百分比
  const bytesWidth = bytesPerLine === 8 ? '12.5%' : '6.25%';

  return row && <Spin loading={spinning} style={{ width: '100%' }}>
    <div className="datapackage-info">
      <div className="tree-container" id="tree-scrollbar">
        {treeData.length > 0 &&
          <Tree selectedKeys={selectedKeys} treeData={treeData} blockNode showLine autoExpandParent={false} fieldNames={{
            key: 'id',
            title: 'showname',
            children: 'field',
          }} renderTitle={renderTitle} onSelect={handleNodeClick}></Tree>}
      </div>
      <div className="offset" style={{ '--bytes-width': bytesWidth } as React.CSSProperties}>
        <div className="left pdt8 pdb8" style={{ backgroundColor: 'transparent', background: 'transparent' }}>
          {sigleHexData.map(item => {
            return <span key={item.key} className={selectedLeftHex.indexOf(item.key) !== -1 ? 'selected' : ''}>{item.label}</span>
          })}
        </div>
        <div className="center">
          {hexadecimalData.map(item => {
            return <span id={item.key} key={item.key} className={selectedRightHex.indexOf(item.key) !== -1 ? 'selected' : ''} onClick={() => clickCenter(item)}>{item.label}</span>
          })}
        </div>
        <div className="right">
          {ascData.map(item => {
            return <span key={item.key} className={selectedRightHex.indexOf(item.key) !== -1 ? 'selected' : ''} style={item.show ? { color: '#bbb' } : {}}>{item.label}</span>
          })}
        </div>
      </div>
    </div>
  </Spin>
}

export default DetailsList;
