import React, { useEffect, useState } from 'react';
import { Cascader, Message, Tag } from '@arco-design/web-react';
import { apiGet } from '@/services/api';

const option = [
  {
    value: '01',
    label: '全部',
    children: []
  },
  {
    value: '02',
    label: '指定区域',
    disabled: false,
    children: []
  },
  {
    value: '03',
    label: '指定设备',
    disabled: false,
    children: []
  }
];

const SelectDeviceCascader = ({ selectRow, config, onChange }) => {
  const [options, setOptions] = useState(option);
  const [value, setValue] = useState(['01']);

  // 查询设备绑定区域列表、查询设备列表
  const fetchDataList = async () => {
    try {
      // 设备绑定区域列表
      const spaceList = await apiGet('/inside/device/queryDeviceSpaceLst', config.params);
      // 设备列表
      const deviceList = await apiGet('/inside/device/listDevices', config.extraParams);
      setOptions(
        option.map((item: any) => {
          if (item.value === '02') {
            return {
              ...item,
              children: spaceList.map((v: any) => ({
                label: v.relateSpaceNm,
                value: `${v.relateSpaceType}|${v.relateSpace}|${v.relateSpaceNm}`,
                spaceType: v.relateSpaceType
              })),
              disabled: spaceList.length === 0
            };
          } else if (item.value === '03') {
            return {
              ...item,
              children: deviceList.map((v: any) => ({
                label: v.deviceName,
                value: `${config.deviceType}|${v.deviceId}|${v.deviceName}`
              })),
              disabled: deviceList.length === 0
            };
          }
          return item;
        })
      );
    } catch ({ message }) {
      Message.error(message);
    }
  };

  // 数据回显逻辑
  useEffect(() => {
    if (selectRow?.space)
      setValue(
        (selectRow.space !== 'false')
          ? [selectRow.rangeType, selectRow.space]
          : [selectRow.rangeType]
      );
  }, [selectRow]);

  // 初始化数据
  useEffect(() => {
    fetchDataList();
  }, []);

  return (
    <Cascader
      value={value}
      options={options}
      dropdownMenuClassName="coustom-cascader"
      allowClear
      onChange={(value: any) => {
        setValue(value);
        onChange(value);
      }}
      renderOption={(node, level) => {
        return (level === 0 || node?.parent?.value === '03')
          ? node.label
          : (<div className="flex items-center">
            <Tag
              size="small"
              className="mr-2"
              bordered
              color={node.spaceType === 'area' ? 'arcoblue' : 'orangered'}
              style={{
                fontSize: 10,
                color: 'var(--color-text-3)',
                padding: '0 5px'
              }}
            >
              {node.spaceType === 'area' ? '区域' : '房间'}
            </Tag>
            <span>{node.label}</span>
          </div>);
      }}
    />
  );
};

export default React.memo(SelectDeviceCascader);
