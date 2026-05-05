import React, { useEffect, useState } from 'react';
import DetailAction from '@/components/actions/DetailAction';
import {
  Button,
  Dropdown,
  Menu,
  Message,
  Space,
  Typography,
} from '@arco-design/web-react';
import {
  IconDelete,
  IconEdit,
  IconMoreVertical,
  IconZoomIn,
} from '@arco-design/web-react/icon';
import ConfirmAction from '@/components/actions/ConfirmAction';
import FormAction from '@/components/actions/FormAction';
import DrawerAction from '@/components/actions/DrawerAction';
import useAuth from '@/hooks/useAuth';
import { apiGet, apiPost } from '@/services/api';

function RowAction({
  children = null,
  getPopupContainer = null,
  config = null,
  actions,
  row,
  onChange,
}) {
  const { hasPermission } = useAuth();
  const [validActions, setValidActions] = useState(actions);
  const renderRowActionItem = (action, record) => {
    switch (action.type) {
      case 'detail':
        return (
          <DetailAction
            action={action}
            selectedRow={record}
            onChange={onChange}
          >
            <Space>
              <IconZoomIn />
              {action.text}
            </Space>
          </DetailAction>
        );

      case 'confirm':
        return (
          <ConfirmAction
            action={action}
            onChange={() => onChange(action)}
            selectedRow={record}
          >
            <Space>
              {action.config.icon || <IconDelete />}
              {action.text}
            </Space>
          </ConfirmAction>
        );

      case 'form':
        return (
          <FormAction
            action={action}
            onSubmit={() => onChange(action)}
            selectedRow={record}
          >
            <Space>
              {action.config.icon || <IconEdit />}
              {action.text}
            </Space>
          </FormAction>
        );

      case 'drawer':
        return (
          <DrawerAction
            action={action}
            onSubmit={() => onChange(action)}
            selectedRow={record}
          >
            {action.config.component({ action, selectedRow: record })}
          </DrawerAction>
        );

      case 'component':
        return typeof action.config.component === 'function' ? (
          <action.config.component
            selectedRow={record}
            onSubmit={() => onChange(action)}
          />
        ) : (
          action.config.component
        );

      default:
        return null;
    }
  };
  // 显示二级菜单
  const renderMenuSubMenu = (action) => {
    const options = action.config.subMenu?.options || [];
    return (
      <Menu.SubMenu
        key={action.key}
        title={
          <div>
            <span className="mr-2">{action.config.icon}</span>
            {action.text}
          </div>
        }
      >
        {options.map((item) => {
          const value = item[action.config.subMenu?.fieldNames?.value];
          return (
            <Menu.Item
              onClick={() => onSubClick(action.config, value)}
              key={value}
            >
              {item[action.config.subMenu?.fieldNames?.label]}
            </Menu.Item>
          );
        })}
      </Menu.SubMenu>
    );
  };
  // 点击二级菜单回调
  const onSubClick = async (config, value) => {
    await apiPost(config.submitUrl, {
      [config?.primaryKey]: row[config.primaryKey],
      [config?.subMenu?.key]: value,
    });
    Message.success(config.submitSuccessMessage);
    onChange();
  };
  useEffect(() => {
    setValidActions(
      actions.filter((action) => {
        if (!hasPermission(action.permission)) {
          return false;
        }
        if (action.hasOwnProperty('disabled')) {
          return typeof action.disabled === 'function'
            ? !action.disabled(row)
            : !action.disabled;
        }
        return true;
      })
    );
  }, [row]);
  return (
    validActions.length > 0 && (
      <Dropdown
        defaultPopupVisible={false}
        getPopupContainer={getPopupContainer}
        unmountOnExit={false}
        droplist={
        <Menu>
            {validActions.map((action) => (
              <div key={action.key}>
                {action.config.subMenu ? (
                  renderMenuSubMenu(action)
                ) : (
                  <Menu.Item key={action.key}>
                    {renderRowActionItem(action, row)}
                  </Menu.Item>
                )}
              </div>
            ))}
          </Menu>
        }
        position={config?.btnPosition || 'br'}
      >
        {children ?? (
          <Button
            className="!text-[var(--color-text-1)]"
            type="text"
            style={config?.style}
            icon={<IconMoreVertical />}
          ></Button>
        )}
      </Dropdown>
    )
  );
}

export default RowAction;
