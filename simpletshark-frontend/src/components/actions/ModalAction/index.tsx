import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Button, Message, Modal, Skeleton } from '@arco-design/web-react';
import { apiGet, apiPost } from '@/services/api';

const ModalAction = forwardRef(
  (
    {
      action,
      selectedRow,
      Component,
      onSubmit,
    }: {
      action: any;
      selectedRow?: any;
      Component: any;
      onSubmit?: (res: any) => void;
    },
    ref
  ) => {
    const [visible, setVisible] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [confirmLoading, setConfirmLoading] = useState<boolean>(false);

    const ComponentRef = useRef(null);

    const openModal = async (selectedRow: any) => {
      if (action.config?.initUrl) {
        await loadData(selectedRow);
      }
      setVisible(true);
    };

    const handleSubmit = async () => {
      try {
        // setConfirmLoading(true);
        const params = await ComponentRef.current?.getParams();
        if (action?.config?.submitUrl) {
          const res = await apiPost(action.config.submitUrl, params);
          Message.success('操作成功');
          onSubmit(res);
        } else {
          onSubmit(params);
        }
        handleCancel();
      } catch ({ message }) {
        Message.error(message);
      } finally {
        // setConfirmLoading(false);
      }
    };

    const handleCancel = () => {
      setVisible(false);
    };
    const loadData = async (selectedRow: any) => {
      try {
        setLoading(true);
        const source = await apiGet(action.config.initUrl, {
          [action.config.primaryKey]: selectedRow[action.config.primaryKey],
        });
      } catch ({ message }) {
        Message.error(message);
      } finally {
        setLoading(false);
      }
    };

    // 暴露给父组件的方法
    useImperativeHandle(ref, () => ({
      openModal,
    }));

    if (loading) return <Skeleton text={{ rows: 3 }} animation />;

    return (
      <>
        {action?.text ? (
          <Button
            type={action?.config?.btnType ?? 'primary'}
            className={action?.config?.className}
            icon={action.icon}
            onClick={openModal}
          >
            {action.text}
          </Button>
        ) : (
          <div
            style={{ fontSize: '16px', cursor: 'pointer' }}
            onClick={openModal}
          >
            {action.icon}
          </div>
        )}

        <Modal
          className={`${action.config?.className} custom-arco-modal`}
          unmountOnExit
          style={action.config?.style}
          title={action.title}
          visible={visible}
          onOk={handleSubmit}
          onCancel={handleCancel}
          autoFocus={false}
          focusLock={true}
          confirmLoading={confirmLoading}
        >
          <Component
            ref={ComponentRef}
            selectedRow={selectedRow}
            action={action}
          />
        </Modal>
      </>
    );
  }
);

export default React.memo(ModalAction);
