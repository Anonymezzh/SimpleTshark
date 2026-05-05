import React, { useEffect, useRef, useState } from 'react';
import {
  Form,
  Input,
  Button,
  Space,
  InputNumber,
} from '@arco-design/web-react';

function Filter({ type = '', hidePort = false, onSubmit = null }) {
  const [form] = Form.useForm();
  const formRef = useRef(null)
  const handleSubmit = () => {
    const values = formRef.current.getFieldsValue();
    debugger
    onSubmit(values)
  };
  const resetSubmit = () => {
    formRef.current.resetFields()
    onSubmit()
  }

  useEffect(() => {
    const queryParams = window.location.hash.includes('?ip') && window.location.hash.split('=');
    form.setFieldsValue({ ip: queryParams[queryParams.length - 1] });
  }, [])

  return (
    <Form ref={formRef} id='searchForm' layout='inline' form={form}>
      <Space className='flex items-center'>
        <Form.Item label='IP' field='ip' style={{marginBottom: 0}}>
          <Input allowClear style={{width: 150}} />
        </Form.Item>
        {!hidePort && (
          <Form.Item label='端口' field='port' style={{marginBottom: 0}}>
            <InputNumber style={{width: 150}} />
          </Form.Item>
        )}
        {type ? <Form.Item label='域名' field='domain' style={{marginBottom: 0}}>
          <Input allowClear style={{width: 150}} />
        </Form.Item> :
          <Form.Item label='应用层协议' field='proto' style={{marginBottom: 0}}>
            <Input allowClear style={{width: 150}} />
          </Form.Item>}
        <Form.Item style={{marginBottom: 0}}>
          <Button type='primary' onClick={handleSubmit}>
            查找
          </Button>
          <Button onClick={resetSubmit} className='ml-4'>
            重置
          </Button>
        </Form.Item>

      </Space>
    </Form>
  );
}

export default Filter;
