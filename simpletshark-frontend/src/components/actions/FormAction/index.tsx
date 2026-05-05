import React, { useMemo, useState } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Message,
  Modal,
  Skeleton,
  Radio,
  Switch,
  Grid,
  Button,
  Checkbox,
  DatePicker,
} from '@arco-design/web-react';
import { apiGet, apiPost } from '@/services/api';
import DictSelectControl from '@/components/controls/DictSelectControl';
import TreeSelectControl from '@/components/controls/TreeSelectControl';
import SelectControl from '@/components/controls/SelectControl';
import ImageUploadControl from '@/components/controls/ImageUploadControl';
import CascaderSelectControl from '@/components/controls/CascaderSelectControl';
import { isEmpty } from 'lodash';
import { getFullFileUrl } from '@/utils/fileUrl';

function FormAction({
  children,
  action,
  extraParams = {},
  selectedRow = {},
  onSubmit = (res) => {
    return;
  },
  onCancel = () => {
    return;
  },
}) {
  const [visible, setVisible] = useState<boolean>(false);

  const [ready, setReady] = useState<boolean>(false);
  const [confirmLoading, setConfirmLoading] = useState<boolean>(false);

  const [form] = Form.useForm();

  const [initData, setInitData] = useState({});

  const [isContinue, setIsContinue] = useState(false);

  const controls = useMemo(() => {
    return action.config.controls.map((control) => {
      const config = { ...control.config };
      if (control.type === 'select') {
        if (control.config.initOptionKey) {
          const initOptionData = initData[control.config.initOptionKey];

          if (!initOptionData) {
            config.options = [];
          } else {
            const formatItem = (item) => ({
              label: config.fieldNames
                ? item[config.fieldNames.label]
                : item.label,
              value: config.fieldNames
                ? item[config.fieldNames.value]
                : item.value,
            });

            config.options = Array.isArray(initOptionData)
              ? initOptionData.map(formatItem)
              : [formatItem(initOptionData)];
          }
        }
      } else if (control.type === 'imageUpload') {
        const files = initData[config.initFilesKey];
        config.initFiles = isEmpty(files)
          ? []
          : files.map((file) => ({
              name: file.fileName,
              uid: file.fileId,
              status: 'done',
              url: getFullFileUrl(file.fileUrl),
            }));
      }
      if(control.required) {
        config.placeholder = action.config.placeholder
        ? config.placeholder
        : [
            'date',
            'datetime',
            'radio',
            'select',
            'dict',
            'cascader',
            'checkbox',
          ].includes(control.type)
        ? '选择' + control.label
        : ['upload'].includes(control.type)
        ? `上传${control.label}`
        : '输入' + control.label;
      } else {
        config.placeholder = ''
      }
      return {
        ...control,
        config,
      };
    });
  }, [action.config.controls, initData]);

  const renderControlItem = (control) => {
    switch (control.type) {
      case 'text':
        return (
          control.value ? <span>{control.value}</span> :
          <Input placeholder={control.required && `请${control.config.placeholder}`} disabled={control.disabled} allowClear />
        );
      case 'number':
        return (
          <InputNumber
            min={control.config?.min}
            max={control.config?.max}
            placeholder={control.required && `请${control.config.placeholder}`}
            hideControl
          />
        );
      case 'textarea':
        return (
          <Input.TextArea
            className={'resize-disabled'}
            placeholder={control.required && `请${control.config.placeholder}`}
            maxLength={{ length: control.config.maxLength }}
            showWordLimit
            autoSize={{ minRows: 2 }}
            allowClear
          />
        );
      case 'datetime':
        return (
          <DatePicker
            style={{ width: control.config?.width || '100%' }}
            showTime
            format="YYYY-MM-DD HH:mm:ss"
            placeholder={control.required && `请${control.config.placeholder || '选择日期'}`}
          />
        );
      case 'tree':
        return ({ value, onChange }) => (
          <TreeSelectControl
            value={value}
            onChange={onChange}
            config={control.config}
          />
        );
      case 'select':
        return ({ value, onChange }) => (
          <SelectControl
            value={value}
            onChange={onChange}
            config={control.config}
          />
        );
      case 'radio':
        return ({ value }) => (
          <Radio.Group
            value={value}
            onChange={(value, event) => {
              if (typeof control.onChange === 'function') {
                control.onChange(value, form, selectedRow);
              }
            }}
            type="button"
          >
            {control.config.options.map((option) => (
              <Radio key={option.value} value={option.value}>
                {option.label}
              </Radio>
            ))}
          </Radio.Group>
        );
      case 'dict':
        return ({ value, onChange }) => (
          <DictSelectControl
            value={value}
            onChange={onChange}
            config={control.config}
          />
        );
      case 'switch':
        return (
          <Switch
            defaultChecked={control.config.defaultChecked(form) || false}
          />
        );
      case 'imageUpload':
        return ({ onChange }) => (
          <ImageUploadControl
            defaultFileList={control.config.initFiles}
            config={control.config}
            onChange={onChange}
          />
        );
      case 'cascader':
        return ({ value, onChange }) => (
          <CascaderSelectControl
            value={value}
            onChange={onChange}
            config={control.config}
          />
        );
      case 'component':
        return ({ value, onChange }) => (
          <control.config.component
            value={value}
            selectedRow={selectedRow}
            onChange={onChange}
            initData={initData}
          />
        );
    }
  };

  const getControlRules = (control) => {
    const controlRules = [];
    if (control.required) {
      controlRules.push({
        required: true,
        message: `请${control.config.placeholder}`,
      });
    }
    if (control.config?.validator) {
      controlRules.push({
        validator: (value, callback) =>
          control.config.validator(value, callback, form),
      });
    }
    return controlRules;
  };

  const openModal = async () => {
    setVisible(true);
    await init();
  };

  // 初始化表单数据
  const init = async () => {
    if (!action.config.initUrl && !action.config?.selectedRow) {
      for (const control of controls ?? []) {
        if (control.config?.initialValue) {
          form.setFieldValue(control.key, control.config.initialValue);
        }
      }
      setReady(true);
      return;
    }
    setReady(false);
    let source = null;

    if (!action.config?.selectedRow) {
      source = await apiGet(action.config.initUrl, {
        [action.config.primaryKey]: selectedRow[action.config.primaryKey],
        ...action.config.initExtraParams,
      });
    } else {
      source = { ...selectedRow };
    }
    setInitData(source);
    if (source) {
      for (const control of controls ?? []) {
        let value = null;
        if (typeof control.config?.initialValue === 'function') {
          value = control.config.initialValue(source);
        } else if (control.type === 'imageUpload') {
          value = source[control.key]
            ? source[control.key].map((file) => file.fileId)
            : [];
        } else {
          value =
            source[control.key] === '' || source[control.key] === null
              ? undefined
              : source[control.key];
        }
        form.setFieldValue(control.key, value);
      }
      setReady(true);
    }
  };

  // 表单提交
  const handleSubmit = async () => {
    const values = await form.validate();
    setConfirmLoading(true);
    try {
      const params = {
        [action.config.primaryKey]: selectedRow[action.config.primaryKey],
        ...values,
        ...(typeof action.extraParams === 'function'
          ? action.extraParams({
              source: values,
              selectedRow,
            })
          : action.extraParams),
        ...extraParams,
      };
      const res = await apiPost(action.config.submitUrl, params);
      Message.success(action.config.submitSuccessMessage);
      if (isContinue) {
        // const needResetKeys = controls?.filter(
        //   (control: any) => control.config?.initialValue
        // );
        const needResetKeys = controls?.map((control: any) => control.key)
        form.resetFields(needResetKeys);
      } else {
        handleCancel();
      }
      onSubmit(res);
    } catch {}
    setConfirmLoading(false);
  };

  const handleCancel = () => {
    setVisible(false);
    setReady(false);
    setTimeout(() => {
      form.resetFields();
    }, 300);
    onCancel();
  };

  return (
    <>
      {React.cloneElement(children, { onClick: openModal })}

      <div
        className="hidden"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <Modal
          className="custom-arco-modal"
          title={action.config.title}
          style={action.config?.style}
          visible={visible}
          footer={
            <div className="w-full flex items-center">
              {action.config.showContinue && (
                <Checkbox
                  className="mr-auto"
                  value={isContinue}
                  onChange={setIsContinue}
                >
                  继续新建下一个
                </Checkbox>
              )}
              <div className="inline-block ml-auto">
                <Button onClick={handleCancel}>取消</Button>
                <Button
                  className="ml-3"
                  loading={confirmLoading}
                  onClick={handleSubmit}
                  type="primary"
                >
                  确定
                </Button>
              </div>
            </div>
          }
          onCancel={handleCancel}
          focusLock={false}
        >
          {action.config.intro}
          {ready ? (
            <Form
              autoComplete="off"
              form={form}
              validateTrigger="onBlur"
              labelCol={action.config.labelCol}
              wrapperCol={action.config.wrapperCol}
            >
              {controls.map((control) => (
                <Grid.Row key={control.key}>
                  <Form.Item
                    label={control.label}
                    field={control.key}
                    rules={getControlRules(control)}
                    extra={control.extra}
                    initialValue={control.initialValue}
                    triggerPropName={control.triggerPropName}
                    normalize={control.normalize}
                  >
                    {renderControlItem(control)}
                  </Form.Item>
                </Grid.Row>
              ))}
            </Form>
          ) : (
            <Skeleton animation />
          )}
        </Modal>
      </div>
    </>
  );
}

export default FormAction;
