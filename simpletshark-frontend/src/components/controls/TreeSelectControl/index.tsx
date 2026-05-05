import React, { useEffect, useState } from 'react';
import { TreeSelect } from '@arco-design/web-react';
import { apiGet } from '@/services/api';

function TreeSelectControl({ value, onChange, config }) {
  const [treeData, setTreeData] = useState([])

  const loadData = async () => {
    const data = await apiGet(config.initUrl);
    setTreeData(data);
  };

  useEffect(() => {
    loadData();
  }, [config.initUrl]);

  return (
    <TreeSelect
      treeData={treeData}
      value={value}
      onChange={onChange}
      fieldNames={config.fieldNames}
      placeholder={`请${config.placeholder}`}
      allowClear
    ></TreeSelect>
  );
}

export default TreeSelectControl;
