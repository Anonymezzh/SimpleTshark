import React, { useContext, useEffect, useState } from 'react';
import { Cascader } from '@arco-design/web-react';
import { apiGet } from '@/services/api';
import { GlobalContext } from '@/context';

function CascaderSelectControl({ addBefore = null, value, onChange, config }) {
  const global = useContext(GlobalContext)
  const [options, setOptions] = useState([]);
  const [values, setValues] = useState([])

  const loadData = async () => {
    const data = await apiGet(config.initUrl, { ...config.extraParams });
    // 格式化树形数据
    const formatFunc = (obj: any) => {
      const result = {
        label: config.fieldNames ? obj[config.fieldNames.label] : obj.label,
        value: config.fieldNames ? obj[config.fieldNames.value] : obj.value,
        extra: obj,
        code: obj.areaCode,
        children: undefined,
      };
      // 子级
      const children = config.fieldNames
        ? obj[config.fieldNames.children]
        : obj.children;
      if (children) {
        result.children = children
          ? children.map((item: any) => formatFunc(item))
          : [];
      }
      // 额外的子级
      const extraChildren = config.fieldNames?.extraChildren
        ? obj[config.fieldNames.extraChildren]
        : undefined;
      if (extraChildren) {
        const formatExtraChildren = extraChildren.map((item: any) => ({
          label: item[config.fieldNames.extraLable],
          value: item[config.fieldNames.extraValue],
          extra: item,
        }));
        result.children = result.children.concat(formatExtraChildren);
      }
      return result;
    };
    const lastOptions = data.map((item: any) => formatFunc(item));
    setOptions(lastOptions);
    if(typeof value === 'string') {
      const ids = findParentIds(lastOptions, value)
      setValues([...ids, ...[value]])
    } else {
      setValues(value)
    }
  };
  // 递归找到所有父级ID
  const findParentIds = (tree, targetId, path = []) => {
    for (const node of tree) {
      if (node.value === targetId) {
        return path;
      }
      if (node.children && node.children.length > 0) {
        const result = findParentIds(node.children, targetId, [...path, node.value]);
        if (result) {
          return result;
        }
      }
    }
    return null;
  };
  useEffect(() => {
    if (config.initUrl) {
      loadData();
    } else {
      if (config.options) {
        setOptions(config.options);
      }
    }
  }, []);
  return (
    <Cascader
      addBefore={addBefore}
      mode={config.mode}
      // style={{ background: global.theme === 'light' ? '#fff' : '#2a2a2b' }}
      className='custom-cascader-box'
      value={values}
      onChange={(value, selectedOptions) => {
        setValues(value)
        onChange(value ?? null, selectedOptions);
      }}
      showSearch
      expandTrigger="hover"
      options={options}
      changeOnSelect={config.changeOnSelect}
      placeholder={`请${config.placeholder}`}
      allowClear
    />
  );
}

export default CascaderSelectControl;
