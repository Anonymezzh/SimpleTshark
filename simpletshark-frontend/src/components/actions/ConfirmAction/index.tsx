import React from 'react';
import { Message, Modal } from '@arco-design/web-react';
import { apiPost } from '@/services/api';

function ConfirmAction({ children, action, selectedRow = {}, onChange }) {
  const openModal = async () => {
    if (action.config.beforeExecute) {
      try {
        await action.config.beforeExecute(selectedRow);
      } catch (message) {
        if (action.config.beforeExecuteConfirm) {
          Modal.warning({
            title: typeof action.config.title === 'function'
              ? action.config.title(selectedRow)
              : (action.config.title || '操作确认'),
            content:
              typeof action.config.beforeExecuteContent === 'function'
                ? action.config.beforeExecuteContent(selectedRow)
                : action.config.beforeExecuteContent
          });
        } else {
          Message.warning(message);
        }
        return;
      }
    }

    Modal.confirm({
      title:
        typeof action.config.title === 'function'
          ? action.config.title(selectedRow)
          : (action.config.title || '操作确认'),
      content:
        typeof action.config.content === 'function'
          ? action.config.content(selectedRow)
          : action.config.content,
      okButtonProps: action.config.okButtonProps || {
        status: 'danger'
      },
      onOk: async () => {
        return new Promise(async (resolve, reject) => {
          try {
            let extraParams: any;
            if (action.config?.extraParams) {
              extraParams = typeof action.config.extraParams === 'function' ? action.config.extraParams(selectedRow) : action.config.extraParams;
            }
            if (action.config?.paramType === 'data') {
              await apiPost(action.config.submitUrl, {
                  [action.config.submitKey]: selectedRow[action.config.submitKey],
                  ...extraParams
                }, null
              );
            } else {
              await apiPost(action.config.submitUrl, null, {
                params: {
                  [action.config.submitKey]: selectedRow[action.config.submitKey],
                  ...extraParams
                }
              });
            }
            Message.success(action.config.successText);
            onChange();
            resolve(null);
          } catch (e) {
            action?.config?.closeAfterSubmit ? resolve(null) : reject(e);
          }
        }).catch((e) => {
          throw e;
        });
      }
    });
  };

  return <>{React.cloneElement(children, { onClick: openModal })}</>;
}

export default ConfirmAction;
