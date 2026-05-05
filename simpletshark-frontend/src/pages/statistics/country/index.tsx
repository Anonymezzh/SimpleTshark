import React, { useState, useContext, useEffect, useRef } from 'react';
import { Button, Card, Form, Input, Message, Space, Typography } from '@arco-design/web-react';
import DataPage from '@/components/DataPage';
import { deviceTableConfig } from './config';
import Footer from '@/components/Footer'
import { LayoutContext } from '@/layoutContext';
import { IconSearch } from '@arco-design/web-react/icon';


const { Item } = Form;

function List() {
  const DataPageRef = useRef(null)
  const [form] = Form.useForm();
  const [values, setValues] = useState(null)
  const [count, setCount] = useState(0)
  const { refreshLoading, workStatus } = useContext(LayoutContext);
  const handleSubmit = async () => {
    form.validate().then(async values => {
      setValues(values)

    }).catch(e => {
      Message.error('必填项填写有误');
    });
  };
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
        <Form autoComplete="off" labelCol={{ span: 8 }} validateTrigger="onBlur" layout="inline" form={form}
          wrapperCol={{ span: 10 }}>
          <Item label="国家" field="country">
            <Input allowClear />
          </Item>
          <Item>
            <Button type="primary" onClick={handleSubmit} icon={<IconSearch />}>查找</Button>
          </Item>
        </Form>
        <DataPage ref={DataPageRef} config={deviceTableConfig} extraParams={{ ...values }} onLoadFinish={(res) => setCount(res.total)} />
        <Footer config={{ data: [{ title: '国家数量', num: count, unit: '个' }] }} />
      </Card>
    </>
  );
}

export default List;