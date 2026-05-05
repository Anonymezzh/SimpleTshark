import React, { useState, useContext, useEffect, useRef } from 'react';
import { Button, Card, Grid, Input, Typography } from '@arco-design/web-react';
import DataPage from '@/components/DataPage';
import { deviceTableConfig } from '../config';
import Filter from './Filter';
import Footer from '@/components/Footer';
import { LayoutContext } from '@/layoutContext';
import { apiPost } from '@/services/api';

function List({ type, filterType = '' }) {
  const DataPageRef = useRef(null)
  const [obj, setObj] = useState(null)
  const { refreshLoading, workStatus } = useContext(LayoutContext);

  // 初始参数包含命令行的参数
  const queryParams = window.location.hash.includes('?ip') &&  window.location.hash.split('=');
  const [params, setParams] = useState({
    ip: queryParams[queryParams.length - 1]
  })

  const getPacketCountInfo = async () => {
    const res: any = await apiPost('/api/getPacketCountInfo', { type })
    setObj(res.data)
  }
  useEffect(() => {
    getPacketCountInfo()
  }, [])
  useEffect(() => {
    if (refreshLoading === 1) {
      DataPageRef.current.loadData()
      getPacketCountInfo()
    }
  }, [refreshLoading])
  const loadData = () => {
    DataPageRef.current.loadData()
    getPacketCountInfo()
  }
  useEffect(() => {
    if (workStatus === 2) {
      const intervalId = setInterval(loadData, 1000);
      return () => {
        clearInterval(intervalId)
      };
    }
  }, [workStatus])

  return (
    <>
      {/* <Typography.Title heading={6} className="page-title">
        全部数据包
      </Typography.Title> */}
      <Card className='full-content'>
        <div className='flex justify-between items-center'>
          <Filter type={filterType} onSubmit={setParams} />
        </div>
        <Footer config={{ data: [{ title: '数据包总数', num: obj?.totalPackets || 0, unit: '个' }, { title: '总字节数', num: obj?.totalBytes || 0 }] }} />
        <DataPage ref={DataPageRef} config={deviceTableConfig(type)} extraParams={{
           proto: type.toUpperCase(), 
           ...params
           }} />
      </Card>
    </>
  );
}

export default List;