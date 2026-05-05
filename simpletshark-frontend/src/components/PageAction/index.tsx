import React, { useMemo } from 'react';
import FormAction from '@/components/actions/FormAction';
import { Button, Dropdown, Menu, Space } from '@arco-design/web-react';
import useAuth from '@/hooks/useAuth';
import { IconDown, IconZoomIn } from '@arco-design/web-react/icon';

function PageAction({ config, className = '', onChange }) {
  const { hasPermission } = useAuth();

  const actions = useMemo(() => {
    return (config.actions ?? []).filter((action) =>
      hasPermission(action.permission)
    );
  }, [config.actions]);

  const renderActionItem = (action, isMenuItem = false) => {
    switch (action.type) {
      case 'form':
        return (
          <FormAction key={action.key} action={action} onSubmit={onChange}>
            <Space>
              {isMenuItem ? (
                <>
                  {action.icon}
                  {action.text}
                </>
              ) : (
                <Button type="primary" icon={action.icon}>
                  {action.text}
                </Button>
              )}
            </Space>
          </FormAction>
        );
      case 'component':
        return <action.config.component action={action} onChange={onChange} />;
    }
  };
  return actions.length > 1 ? (
    <Dropdown.Button
      type="primary"
      unmountOnExit={false}
      droplist={
        <Menu>
          {actions.slice(1).map((action) => (
            <Menu.Item key={action.key}>
              {renderActionItem(action, true)}
            </Menu.Item>
          ))}
        </Menu>
      }
      icon={<IconDown />}
    >
      {actions[0].text}
    </Dropdown.Button>
  ) : (
    renderActionItem(actions[0])
  );
}

export default PageAction;
