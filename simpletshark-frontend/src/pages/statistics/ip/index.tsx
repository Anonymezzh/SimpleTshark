import React, { useRef, useState, useContext, useEffect } from 'react';
import { Button, Card, Form, Input, Message, Space, Typography } from '@arco-design/web-react';
import { useHistory } from 'react-router-dom';
import DataPage from '@/components/DataPage';
import { DeviceTableConfig } from './config';
import Footer from '@/components/Footer'
import Filter from '@/pages/flow/components/Filter';
import { LayoutContext } from '@/layoutContext';

function List() {
  const history = useHistory();
  const DataPageRef = useRef(null)
  const [values, setValues] = useState(null)
  const { refreshLoading, workStatus } = useContext(LayoutContext);
  const onSubmit = (values) => {
    setValues(values)
  }
  const goHistory = (value) => {
    history.replace(value)
  }
  useEffect(() => {
    if (refreshLoading === 1) {
      DataPageRef.current.loadData()
    }
  }, [refreshLoading])
  useEffect(() => {
    if (workStatus === 2) {
      const intervalId = setInterval(DataPageRef.current.loadData(), 1000);
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
        <Filter onSubmit={onSubmit} hidePort={true} />
        <DataPage ref={DataPageRef} config={DeviceTableConfig(goHistory)} extraParams={{ ...values }} />
        <Footer config={{ data: [{ title: 'IP数量', num: '24', unit: '个' }] }} />
      </Card>
    </>
  );
}

export default List;