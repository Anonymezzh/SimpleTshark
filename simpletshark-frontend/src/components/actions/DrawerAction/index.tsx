import React, {
  forwardRef,
  ReactElement,
  useEffect,
  useImperativeHandle,
  useState
} from 'react';
import { Button, Drawer, Space, Divider } from '@arco-design/web-react';
import { IconCompass, IconExport, IconClose } from '@arco-design/web-react/icon';

const DrawerAction = forwardRef(
  (
    {
      action,
      onSubmit,
      selectedRow,
      children,
      showTriggerElement = true
    }: {
      action: any;
      onSubmit?: () => void;
      selectedRow?: any;
      children?: ReactElement;
      showTriggerElement?: boolean;
    },
    ref
  ) => {
    const [visible, setVisible] = useState(false);

    // 打开抽屉
    const openDrawer = () => {
      setVisible(true);
    };

    // 提交
    const handleSubmit = () => {
      onCancel();
    };

    // 关闭
    const onCancel = () => {
      setVisible(false);
    };

    useImperativeHandle(ref, () => ({
      open: openDrawer
    }));

    return (
      <>
        {showTriggerElement && (
          action.config.triggerType === 'button'
            ? (<Button type="secondary" onClick={openDrawer}>{action.text}</Button>)
            : (<Space>
              <div onClick={openDrawer}>
              <span className="mr-[8px]">
                {action.config.icon || <IconCompass />}
              </span>
                <span>{action.text}</span>
              </div>
            </Space>)

        )}
        <Drawer
          className="custom-arco-drawer"
          visible={visible}
          focusLock={false}
          autoFocus={false}
          width={action.config.width || 350}
          headerStyle={{}}
          title={
            <div className="flex justify-between">
              <span className="flex items-center">{action.config.title}</span>
              <div>
                {action.config.titleExtraElement}
                {action.config.titleExtraElement && <Divider type="vertical" />}
                <Button
                  className="!text-[var(--color-text-1)]"
                  type="text"
                  onClick={onCancel}
                  icon={<IconClose />}
                ></Button>
              </div>
            </div>
          }
          closeIcon={null}
          footer={action.config.footer ?? null}
          onOk={handleSubmit}
          onCancel={onCancel}
        >
          {visible && children}
        </Drawer>
      </>
    );
  }
);

export default React.memo(DrawerAction);
