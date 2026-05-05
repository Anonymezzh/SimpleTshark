import React, { useCallback, useEffect, useState } from 'react';
import { Select, Spin } from '@arco-design/web-react';
import { apiGet } from '@/services/api';
import { debounce } from 'lodash';

function SelectControl({ addBefore = null, value = undefined, onChange = undefined, config }) {
  const [options, setOptions] = useState([]);
  const [searchLoading, setSearchLoading] = useState<boolean>(false);

  const loadData = async () => {
    const data = await apiGet(config.initUrl);
    setOptions(mapOptions(data));
  };

  const handleSearch = useCallback(
    debounce(async (inputValue) => {
      if (!config.searchUrl) return;
      if (inputValue.trim() === '' || inputValue.trim() === null) {
        setOptions([]);
        return;
      }
      setSearchLoading(true);
      try {
        const data = await apiGet(config.searchUrl, { keyword: inputValue });
        setOptions(mapOptions(data));
      } catch {
      }
      setSearchLoading(false);
    }, 500),
    []
  );

  const onSelectChange = (value: any, option) => {
    if (config.labelInValue && config.formatValue) {
      onChange(config.formatValue(value, option), option);
    } else {
      onChange(value, option);
    }
  };

  const mapOptions = (options) => {
    return options.map((item) => ({
      label:
        typeof config.formatLabel === 'function'
          ? config.formatLabel(item)
          : config.fieldNames
            ? item[config.fieldNames.label]
            : item.label,
      value: config.fieldNames ? item[config.fieldNames.value] : item.value,
      extra: item
    }));
  };

  useEffect(() => {
    if (config.initUrl) {
      loadData();
    } else {
      setOptions(config.options ? mapOptions(config.options) : []);
    }
  }, [config.initUrl, config.options]);
  return (
    <Select
      style={{ width: config.width || '100%' }}
      addBefore={addBefore}
      mode={config.mode}
      value={value}
      disabled={config.disabled}
      allowCreate={config.allowCreate}
      showSearch={config.showSearch}
      triggerProps={config.triggerProps}
      onChange={onSelectChange}
      filterOption={false}
      labelInValue={config.labelInValue}
      onSearch={handleSearch}
      notFoundContent={
        searchLoading ? (
          <div className="flex justify-center items-center">
            <Spin style={{ margin: 12 }} />
          </div>
        ) : null
      }
      options={options}
      placeholder={config.placeholder && `请${config.placeholder}`}
      allowClear
    />
  );
}

export default SelectControl;
