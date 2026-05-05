import React, { useEffect, useState } from 'react';
import { debounce } from 'lodash';
import { Grid, Select, Spin, Typography } from '@arco-design/web-react';
import { IconSearch } from '@arco-design/web-react/icon';
import { apiGet } from '@/services/api';

function KeywordsSearchControl({ onChange, config, className = '' }) {
  const [inputValue, setInputValue] = useState<string>('');

  const [filterOptions, setFilterOptions] = useState([]);
  const [filterOptionsSearchLoading, setFilterOptionsSearchLoading] =
    useState(false);

  const [pagination, setPagination] = useState({
    pageNumber: 1,
    pageSize: 10,
  });

  const [finished, setFinished] = useState<boolean>(false);

  const fetchFilterList = debounce(async (value = null) => {
    const currentInputValue = value ?? inputValue;
    // if (currentInputValue.trim() === '' || currentInputValue.trim() === null) {
    //   setFilterOptions([]);
    //   return;
    // }
    setFilterOptionsSearchLoading(true);
    const { records, total } = await apiGet(config.searchUrl, {
      keyword: currentInputValue,
      ...pagination,
    });

    if (records.length + filterOptions.length === Number(total)) {
      setFinished(true);
    }

    if (config.disabledKeys) {
      for (const record of records) {
        record.disabled = config.disabledKeys.some(
          (disabledKey) => disabledKey === record[config.rowKey]
        );
      }
    }

    const highlightMatch = (text, keyword) => {
      const parts = text.split(new RegExp(`(${keyword})`, 'gi'));
      return parts.map((part, index) =>
        part === keyword ? (
          <span key={index} className="text-[rgb(var(--arcoblue-6))]">
            {part}
          </span>
        ) : (
          part
        )
      );
    };
    const options = records.map((record) => (
      <Select.Option
        key={record[config.rowKey]}
        value={record[config.rowKey]}
        extra={record}
        disabled={record.disabled}
      >
        <Grid.Row className={config.searchContentClassName} gutter={24}>
          {config.searchFields.map((fields) => (
            <Grid.Col key={fields.key} span={fields.span}>
              {record.disabled ? (
                <Typography.Ellipsis className="!text-[var(--color-neutral-4)]">
                  {typeof record[fields.key] === 'string'
                    ? highlightMatch(record[fields.key], currentInputValue)
                    : highlightMatch(
                        fields.format(record[fields.key]),
                        currentInputValue
                      )}
                </Typography.Ellipsis>
              ) : (
                <Typography.Ellipsis>
                  {typeof record[fields.key] === 'string'
                    ? highlightMatch(record[fields.key], currentInputValue)
                    : highlightMatch(
                        fields.format(record[fields.key]),
                        currentInputValue
                      )}
                </Typography.Ellipsis>
              )}
            </Grid.Col>
          ))}
        </Grid.Row>
      </Select.Option>
    ));
    if (value === null) {
      setFilterOptions([...filterOptions, ...options]);
    } else {
      setFilterOptions(options);
    }
    setFilterOptionsSearchLoading(false);
  }, 500);

  const popupScrollHandler = debounce((element) => {
    if (finished) {
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = element;
    const scrollBottom = scrollHeight - (scrollTop + clientHeight);

    if (scrollBottom < 10) {
      setPagination({
        ...pagination,
        pageNumber: pagination.pageNumber++,
      });
      fetchFilterList();
    }
  }, 500);
  return (
    <Select
      className={className}
      style={{ width: config.width ?? 340 }}
      showSearch
      placeholder={config.placeholder}
      filterOption={false}
      arrowIcon={<IconSearch />}
      onFocus={() => fetchFilterList()}
      onSearch={(value) => {
        setInputValue(value);
        fetchFilterList(value);
      }}
      onPopupScroll={popupScrollHandler}
      onVisibleChange={(visible) => {
        if (!visible) {
          setFilterOptions([]);
          setFilterOptionsSearchLoading(false);
          setPagination({
            pageNumber: 1,
            pageSize: 10,
          });
          setInputValue('');
          setFinished(false);
        }
      }}
      onChange={(value, option) => {
        onChange((option as any).extra);
      }}
      value={undefined}
      notFoundContent={
        filterOptionsSearchLoading ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Spin style={{ margin: 12 }} />
          </div>
        ) : null
      }
      triggerProps={{
        autoAlignPopupWidth: false,
        autoAlignPopupMinWidth: true,
        position: config.position ?? 'br',
      }}
    >
      {filterOptions}
    </Select>
  );
}

export default KeywordsSearchControl;
