import React, { useEffect, useState } from 'react';
import { Radio, Select } from '@arco-design/web-react';
import { apiGet } from '@/services/api';

function DictSelectControl(
  {
    addBefore = null,
    value,
    onChange,
    config,
    className = '',
    hideBeforeLoaded = false
  }) {
  const [finish, setFinish] = useState(false);
  const [options, setOptions] = useState([]);

  const loadData = async () => {
    const dictItems = await apiGet('/inside/dict/queryAvailItemList', {
      dictCode: config.dictCode
    });
    setFinish(true);
    dictItems &&
    setOptions(
      dictItems.map((dictItem: { itemDesc: any; itemValue: any; }) => ({
        label: dictItem.itemDesc,
        value: dictItem.itemValue
      }))
    );
  };
  useEffect(() => {
    loadData();
  }, [config.dictCode]);

  return finish || !hideBeforeLoaded ? (
    config.mode === 'radio' ? (
      <Radio.Group className={className} defaultValue={value} onChange={onChange}>
        {options.map((option) => (
          <Radio value={option.value} key={option.value}>
            {option.label}
          </Radio>
        ))}
      </Radio.Group>
    ) : (
      <Select
        addBefore={addBefore}
        className={className}
        value={value}
        disabled={config.disabled}
        allowCreate={config.allowCreate}
        onChange={onChange}
        options={options}
        placeholder={`请${config.placeholder}`}
        allowClear={!config.notAllowClear}
      />
    )
  ) : null;
}

export default DictSelectControl;
