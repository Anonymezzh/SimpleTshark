import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './style/index.module.less';
import cs from 'classnames';
import {
  Button,
  Form,
  Input,
  Grid,
  DatePicker,
  Typography,
  Divider,
  Tooltip,
  Badge,
  Tag,
  Tabs,
} from '@arco-design/web-react';
import { IconFilter, IconSearch } from '@arco-design/web-react/icon';
import SelectControl from '@/components/controls/SelectControl';
import DictSelectControl from '@/components/controls/DictSelectControl';
import CascaderSelectControl from '@/components/controls/CascaderSelectControl';
import LinkSelectControl from '@/components/controls/LinkSelectControl';
import dayjs from 'dayjs';
import PageAction from '@/components/PageAction';
import { isEmpty } from 'lodash';

function PageFilter({ config, onSearch, onChange, changeTableScrollHeight }) {
  const [groupSearchValue, setGroupSearchValue] = useState(
    config.filter.group?.groups[0].key ?? null
  );
  const [keywordInputVisible, setKeywordInputVisible] = useState(false);
  const [keywordInputValue, setKeywordInputValue] = useState('');
  const keywordInputRef = useRef(null);
  const [searchFormVisible, setSearchFormVisible] = useState(false);
  const [searchFields, setSearchFields] = useState([]);
  const [searchOptionMap, setSearchOptionMap] = useState({});
  const [searchLinkMap, setSearchLinkMap] = useState({});
  const [form] = Form.useForm();

  const renderFormItem = (control: any) => {
    switch (control.type) {
      case 'text':
        const placeholder = control?.config?.placeholder
          ? control.config.placeholder
          : `请输入${control.label}`;
        return (
          <Input
            addBefore={
              <Tooltip content={control.label}>
                <span className="text-[var(--color-text-2)]">
                  {control.label}
                </span>
              </Tooltip>
            }
            placeholder={placeholder}
            allowClear
          />
        );
      case 'select':
        return (
          <SelectControl
            addBefore={
              <Tooltip content={control.label}>
                <span className="text-[var(--color-text-2)]">
                  {control.label}
                </span>
              </Tooltip>
            }
            value={undefined}
            onChange={(value: any, option: { children: any }) => {
              searchOptionMap[control.key] = option.children;
              setSearchOptionMap(searchOptionMap);
            }}
            config={control.config}
          />
        );
      case 'datePicker':
        return (
          <DatePicker
            className="w-full"
            prefix={
              <Tooltip content={control.label}>
                <div className="text-[var(--color-text-2)] w-full truncate">
                  {control.label}
                </div>
              </Tooltip>
            }
            format="YYYY-MM-DD"
          />
        );
      case 'rangePicker':
        return (
          <DatePicker.RangePicker
            className="w-full"
            prefix={
              <Tooltip content={control.label}>
                <div className="text-[var(--color-text-2)] w-full truncate">
                  {control.label}
                </div>
              </Tooltip>
            }
            showTime={{
              defaultValue: ['00:00', '23:59'],
              format: 'HH:mm',
            }}
            format="YYYY-MM-DD HH:mm"
          />
        );
      case 'cascader':
        return (
          <CascaderSelectControl
            addBefore={
              <Tooltip content={control.label}>
                <span className="text-[var(--color-text-2)]">
                  {control.label}
                </span>
              </Tooltip>
            }
            value={undefined}
            onChange={(value: any, selectedOptions: any[]) => {
              searchOptionMap[control.key] = selectedOptions
                .map((item) => item.label)
                .join('/');
            }}
            config={control.config}
          />
        );
      case 'dict':
        return (
          <DictSelectControl
            addBefore={
              <Tooltip content={control.label}>
                <span className="text-[var(--color-text-2)]">
                  {control.label}
                </span>
              </Tooltip>
            }
            value={undefined}
            onChange={(value: any, option: { children: any }) => {
              searchOptionMap[control.key] = option.children;
              setSearchOptionMap(searchOptionMap);
            }}
            config={control.config}
          />
        );
      case 'linkSelect':
        return (
          <LinkSelectControl
            key={control.key}
            addBeforeVisible
            value={undefined}
            config={control.config}
            formRef={form}
            onChange={(value, field, option) => {
              searchOptionMap[field.key] = option.children;
              setSearchOptionMap(searchOptionMap);
              searchLinkMap[field.key] = {
                label: option.label,
                value: option.children,
              };
              setSearchLinkMap(searchLinkMap);
            }}
          />
        );
    }
  };

  const handleSubmit = (resetPage = true) => {
    const values = form.getFieldsValue();
    const fields = Object.entries(values)
      .filter(([key, value]) => !isEmpty(value))
      .map(([key, value]) => {
        const control = config.filter.controls.find(
          (control: { key: string }) => control.key === key
        );

        if (!control) {
          // 搜索不到即为linkSelect
          const linkField = searchLinkMap[key];
          return {
            key,
            label: linkField.label,
            value: linkField.value,
          };
        }

        switch (control.type) {
          case 'select': {
            value = searchOptionMap[control.key];
            break;
          }
          case 'dict': {
            value = searchOptionMap[control.key];
            break;
          }
          case 'linkSelect': {
            value = searchOptionMap[control.key];
            break;
          }
          case 'cascader': {
            value = searchOptionMap[control.key];
            break;
          }
          case 'rangePicker': {
            value = `${value[0]} ~ ${value[1]}`;
          }
        }

        return {
          key,
          label: control.label,
          value,
        };
      });
    setSearchFields(fields);
    const params = handleFormatParams(values);
    const groupParams = config.filter.group
      ? { [config.filter.group.key]: groupSearchValue }
      : {};

    onSearch({ ...params, ...groupParams }, resetPage);
  };

  // 查询参数处理
  const handleFormatParams = (values: { [x: string]: any[] }) => {
    let params: { [key: string]: any } = {};
    params = config.filter.controls.reduce(
      (
        acc: { [x: string]: any },
        cur: {
          key: string | number;
          type: string;
          config: { notTree: any; fields: any[] };
        }
      ) => {
        if (cur.type === 'linkSelect') {
          cur.config.fields.forEach((field: any) => {
            acc[field.key] = values[field.key];
          });
        } else if (!values[cur.key]) {
          return acc;
        }
        if (cur.type === 'cascader') {
          if (cur.config?.notTree) {
            acc[cur.key] = values[cur.key][values[cur.key].length - 1];
          } else {
            acc[cur.key] = values[cur.key].join(',');
          }
        } else if (cur.type === 'rangePicker') {
          acc[`${cur.key}StDt`] = dayjs(values[cur.key][0]).format(
            'YYYY-MM-DDTHH:mm:ss'
          );
          acc[`${cur.key}EdDt`] = dayjs(values[cur.key][1]).format(
            'YYYY-MM-DDTHH:mm:ss'
          );
        } else {
          acc[cur.key] = values[cur.key];
        }
        return acc;
      },
      {}
    );
    return params;
  };

  const getControlPlaceholder = (controls: any) => {
    if (
      config.filter.keyword &&
      !controls.some((control) => control.key === 'keyword')
    ) {
      controls.unshift({
        key: 'keyword',
        label: config.filter.keyword.label ?? '关键字',
        type: 'text',
      });
    }
    return controls.map((control: any) => {
      const placeholder = control?.config?.placeholder
        ? control.config.placeholder
        : [
            'date',
            'datetime',
            'radio',
            'select',
            'dict',
            'cascader',
            'checkbox',
          ].includes(control.type)
        ? `选择${control.label}`
        : ['upload'].includes(control.type)
        ? `上传${control.label}`
        : `输入${control.label}`;
      return { ...control, config: { ...control.config, placeholder } };
    });
  };

  const controls = useMemo(() => {
    return getControlPlaceholder(config.filter.controls);
  }, [config.filter.controls]);

  useEffect(() => {
    if (keywordInputVisible && keywordInputRef.current) {
      keywordInputRef.current.focus();
    }
  }, [keywordInputVisible, keywordInputRef.current]);

  return (
    <>
      {config.filter ? (
        <div className="mb-5 flex justify-between items-center">
          {config.filter.group ? (
            <Tabs
              className={styles['no-line-tabs']}
              activeTab={groupSearchValue}
              onChange={(value) => {
                setGroupSearchValue(value);
                const values = form.getFieldsValue();
                const params = handleFormatParams(values);

                onSearch({ ...params, [config.filter.group.key]: value }, true);
              }}
            >
              {config.filter.group.groups.map((group) => (
                <Tabs.TabPane key={group.key} title={group.title} />
              ))}
            </Tabs>
          ) : (
            <Typography.Title
              className="!mb-0"
              heading={5}
              style={{ fontSize: `${config.filter?.size || 13}px` }}
            >
              {config.filter.title}
            </Typography.Title>
          )}
          <div className={styles['page-control-wrapper']}>
            {config.filter.keyword &&
              (keywordInputVisible ? (
                <Input
                  ref={keywordInputRef}
                  value={keywordInputValue}
                  style={{ width: config.filter.keyword.width ?? '100%' }}
                  className="mr-4"
                  placeholder={`请输入${
                    config.filter.keyword.label ?? '关键字'
                  }`}
                  allowClear
                  onChange={(value) => {
                    setKeywordInputValue(value);
                  }}
                  onPressEnter={() => {
                    form.setFieldValue('keyword', keywordInputValue);
                    setKeywordInputVisible(false);
                    handleSubmit();
                  }}
                  onBlur={() => {
                    if (isEmpty(keywordInputValue)) {
                      setKeywordInputVisible(false);
                    }
                  }}
                />
              ) : (
                <Button
                  className={styles['page-filter-button']}
                  type="text"
                  icon={<IconSearch />}
                  onClick={() => setKeywordInputVisible(true)}
                />
              ))}
            {config.filter.controls?.length > 0 ? (
              <Badge
                count={searchFields.length}
                dotStyle={{
                  height: '16px',
                  minWidth: '16px',
                  lineHeight: '16px',
                }}
              >
                <Button
                  className={cs(styles['page-filter-button'], {
                    [styles.active]: searchFormVisible,
                  })}
                  type="text"
                  icon={<IconFilter />}
                  onClick={() => {
                    setSearchFormVisible(!searchFormVisible);
                    changeTableScrollHeight(new Date());
                  }}
                />
              </Badge>
            ) : null}

            {config.actions?.length > 0 && (
              <>
                {!config.filter.hiddenDivider ? (
                  <Divider type="vertical" />
                ) : null}
                <PageAction config={config} onChange={onChange} />
              </>
            )}
          </div>
        </div>
      ) : null}
      <div
        id="searchForm"
        className={cs(styles['search-form-wrapper'], {
          '!block': searchFormVisible,
        })}
      >
        <Form
          form={form}
          className={styles['search-form']}
          labelAlign="left"
          labelCol={{ span: 0 }}
          wrapperCol={{ span: 24 }}
          autoComplete="off"
        >
          <Grid.Row gutter={32}>
            {controls.map((control) =>
              control.type === 'linkSelect' ? (
                renderFormItem(control)
              ) : (
                <Grid.Col key={control.key} span={12}>
                  <Form.Item
                    field={control.key}
                    wrapperCol={control.config?.wrapperCol}
                  >
                    {renderFormItem(control)}
                  </Form.Item>
                </Grid.Col>
              )
            )}
          </Grid.Row>
        </Form>
        <div className="flex justify-end">
          <Button
            type="primary"
            onClick={() => {
              handleSubmit();
              setSearchFormVisible(false);
              changeTableScrollHeight(new Date());
            }}
          >
            过滤
          </Button>
        </div>
      </div>
      {searchFields.length > 0 && (
        <div
          id="filterValue"
          className="filter-list mb-2 flex items-center flex-wrap gap-2"
        >
          {searchFields.map((field) => (
            <Tag
              className="mb-2"
              key={field.key}
              bordered
              closable
              size="medium"
              color="gray"
              onClose={() => {
                form.setFieldValue(field.key, undefined);
                handleSubmit();
              }}
            >
              {field.label} 包含“{field.value}”
            </Tag>
          ))}

          {searchFields.length > 0 && (
            <Button
              className="!h-[28px] mb-2"
              type="text"
              onClick={() => {
                form.resetFields();
                handleSubmit();
                changeTableScrollHeight(new Date());
              }}
            >
              清空
            </Button>
          )}
        </div>
      )}
    </>
  );
}

export default PageFilter;
