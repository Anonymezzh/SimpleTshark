import React, { useEffect, useState } from 'react';
import { Form, Grid, Select, Tooltip } from '@arco-design/web-react';
import { apiGet } from '@/services/api';

function LinkSelectControl(
  {
    addBeforeVisible,
    value,
    onChange,
    config,
    formRef
  }: any) {
  const [ready, setReady] = useState(true);
  const [fields, setFields] = useState(config.fields);
  const loadData = async () => {
    setReady(false);
    const promiseList = [];
    if (fields.length > 0) {
      for (const field of fields) {
        promiseList.push(
          await apiGet(config.initUrl, { dictCode: field.dictCode })
        );
      }
    }
    const optionsList = await Promise.all(promiseList);
    setFields(
      fields.map((item: any, index: number) => {
        return {
          ...item,
          options: optionsList[index],
          catchOptions: optionsList[index] // 保存原始数据
        };
      })
    );
    setReady(true);
  };

  useEffect(() => {
    loadData();
  }, [config.initUrl]);

  const onSelectChange = (value: string, field: any, option: any) => {
    field.value = value;
    if (field.parent) {
      setFields(
        fields.map((item: any) => {
          if (!item.parent) {
            formRef.setFieldValue(item.key, undefined);
            item.options = item.catchOptions.filter(
              (o: { itemValue: string }) => o.itemValue.startsWith(value)
            );
          }
          return item;
        })
      );
    }
    onChange(value, field, option);
  };

  return fields.map((field: any) => (
    <Grid.Col key={field.key} span={12}>
      <Form.Item field={field.key} label={field.label}>
        <Select
          key={field.key}
          addBefore={
            addBeforeVisible ? (
              <Tooltip content={field.label}>
                <span className="text-[var(--color-text-2)]">
                  {field.label}
                </span>
              </Tooltip>
            ) : null
          }
          value={field.value}
          placeholder={`请选择${field.label}`}
          onChange={(val, option) => onSelectChange(val, field, option)}
        >
          {ready
            ? (field.options ?? []).map((option: any) => (
              <Select.Option key={option.itemId} value={option.itemValue}>
                {option.itemDesc}
              </Select.Option>
            ))
            : null}
        </Select>
      </Form.Item>
    </Grid.Col>
  ));
}

export default LinkSelectControl;
