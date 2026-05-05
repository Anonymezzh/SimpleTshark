import React, { useEffect, useMemo, useState, useContext, useRef } from 'react';
import { Tree, Layout, Tooltip, Spin, Card } from '@arco-design/web-react';
import { apiGet } from '../../../services/api';
import defaultExeIcon from '@/assets/images/exe.png'
import { LayoutContext } from '@/layoutContext';
import { deviceTableConfig } from '../config';
import DataPage from '@/components/DataPage';

const Sider = Layout.Sider;
const Header = Layout.Header;
const Footer = Layout.Footer;
const Content = Layout.Content;

interface ProcessNode {
  processId: number;
  parentProcessId: number;
  processName: string;
  processFullPath: string;
  processIcoDataBase64: string;
  children?: ProcessNode[];
}

interface Props {
  data?: ProcessNode[];
}

function ProcessTree({ data }: Props) {

  const buildTree = (nodes: ProcessNode[]) => {
    return nodes.map((node) => ({
      key: node.processId.toString(),
      title: (
        <Tooltip content={node.processFullPath}>
          {
            <img
              src={node.processIcoDataBase64 != "" ? node.processIcoDataBase64 : defaultExeIcon}
              alt="icon"
              style={{ width: 16, height: 16, marginRight: 6, verticalAlign: 'middle' }}
            />
          }
          {node.processName || '(unknown)'} (PID:{node.processId})
        </Tooltip>
      ),
      children: buildTree(node.children || []),
    }));
  };

  const DataPageRef = useRef(null)
  const [filterProcessId, setFilterProcessId] = useState(-1)
  const [processTreeData, setProcessTreeData] = useState([])
  const { refreshLoading, workStatus } = useContext(LayoutContext);

  const clearData = () => {
    setProcessTreeData([])
    setFilterProcessId(-1)
  }

  // 检查进程ID是否存在于进程树中
  const isProcessIdExists = (treeData, targetProcessId) => {
    for (const node of treeData) {
      if (parseInt(node.key) === targetProcessId) {
        return true;
      }
      if (node.children && node.children.length > 0) {
        if (isProcessIdExists(node.children, targetProcessId)) {
          return true;
        }
      }
    }
    return false;
  };

  const loadProcessTreeDataRef = useRef(null)

  loadProcessTreeDataRef.current = async () => {
      const res = await apiGet('/api/getProcessList')
      if (res.data?.processTree != undefined) {
        const processTree = buildTree(res.data.processTree)
        setProcessTreeData(processTree)

        // 只在初始加载时设置第一个进程（当前没有选中任何进程时）
        if (filterProcessId === -1 && processTree.length > 0) {
          setFilterProcessId(parseInt(processTree[0].key));
          DataPageRef.current?.loadData()
        } else if (filterProcessId !== -1 && !isProcessIdExists(processTree, filterProcessId)) {
          // 如果当前选中的进程不存在于新的进程树中，则选中第一个进程
          if (processTree.length > 0) {
            setFilterProcessId(parseInt(processTree[0].key));
            DataPageRef.current?.loadData()
          } else {
            setFilterProcessId(-1);
          }
        }
        // 如果进程存在，不做任何操作，保持当前选中状态
      }
    }

  const loadProcessTreeData = () => {
    loadProcessTreeDataRef.current()
  }

  useEffect(() => {
    loadProcessTreeData()
  }, [])

  const onSelectProcess = (keys, extra) => {
    setFilterProcessId(parseInt(keys[0]))
  }

  // const loadData = () => {
  //   loadProcessTreeData()
  //   //DataPageRef.current.loadData()
  // }
  useEffect(() => {
    if (workStatus === 2) {
      // 抓包开始时清空所有数据，并开始定时更新
      clearData()
      DataPageRef.current?.clearData()
      const intervalId = setInterval(loadProcessTreeData, 1000);
      return () => {
        clearInterval(intervalId)
      };
    }
  }, [workStatus])

  useEffect(() => {
    clearData()
    if (refreshLoading === 1) {
      loadProcessTreeData()
    }
  }, [refreshLoading])


  return (
    <Card className='full-content' bodyStyle={{ padding: 0, overflow: 'hidden' }}>
      <Layout style={{height: 'calc(100vh - 120px)', background: 'transparent', overflow: 'hidden'}}>
        <Sider style={{minWidth: 300, background: 'transparent', boxShadow: 'none', height: '100%', overflow: 'auto'}}>
          <Tree
            treeData={processTreeData}
            autoExpandParent={false}
            showLine
            onSelect={onSelectProcess}
            selectedKeys={filterProcessId !== -1 ? [filterProcessId.toString()] : []}
          />
        </Sider>
        <Content style={{background: 'transparent', padding: '0 10px', height: '100%', overflow: 'hidden'}}>
        <DataPage ref={DataPageRef} config={deviceTableConfig('process')} extraParams={{
            processId: filterProcessId
            }} />
        </Content>
      </Layout>
    </Card>
  )
  
}

export default ProcessTree;
