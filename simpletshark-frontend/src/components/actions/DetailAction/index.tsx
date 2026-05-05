import React, { useImperativeHandle, useState, forwardRef } from 'react';
import {
  Drawer,
  Descriptions,
  Divider,
  Skeleton,
  Tag,
  Button,
} from '@arco-design/web-react';
import { apiGet } from '@/services/api';
import RowAction from '@/components/RowAction';
import {
  IconDown,
  IconSchedule,
  IconUp,
  IconUser,
  IconExport,
  IconClose,
} from '@arco-design/web-react/icon';

const defaultLabelStyle = {
  width: 120,
  verticalAlign: 'baseline',
  // 'overflow': 'hidden',
  // 'text-overflow': 'ellipsis',
  whiteSpace: 'normal',
};

const DetailDrawer = forwardRef(
  (
    {
      children = null,
      action,
      selectedRow = null,
      onChange,
    }: {
      children?: any;
      action: any;
      selectedRow?: any;
      onChange?: () => void;
    },
    ref
  ) => {
    const [visible, setVisible] = useState<boolean>(false);
    const [ready, setReady] = useState<boolean>(false);
    const [groups, setGroups] = useState([]);
    const [source, setSource] = useState<Record<string, any>>([]);
    const [currentRow, setCurrentRow] = useState({});

    const [updateHistoryVisible, setUpdateHistoryVisible] =
      useState<boolean>(false);

    const renderDescriptions = (group, rows) => {
      return (
        <Descriptions
          colon=""
          title={group.title}
          column={1}
          labelStyle={group.labelStyle || defaultLabelStyle}
          layout={group.type || 'horizontal'}
          data={rows.map((row: { label: any; value: any; type: string }) => {
            return {
              label: row.label,
              value:
                row.type === 'tag' ? (
                  <Tag bordered color="arcoblue">{row.value}</Tag>
                ) : (
                  row.value || '-'
                ),
            };
          })}
        />
      );
    };
    const renderChildItem = (group: any, index: number) => {
      const rows = group.rows.filter((row: any) => {
        if (row.hasOwnProperty('disabled')) {
          return !(typeof row.disabled === 'function'
            ? row.disabled(source)
            : row.disabled);
        }
        return true;
      });
      switch (group.type) {
        case 'component':
          return group.config.component({ source });
        default:
          return renderDescriptions(group, rows);
      }
    };

    const loadData = async (row) => {
      const source = await apiGet(action.config.initUrl, {
        [action.config.primaryKey]: row[action.config.primaryKey],
      });
      if (source) {
        const list = [];
        const groups = action.config?.groups.filter((group) => {
          if (group.hasOwnProperty('disabled')) {
            return !(typeof group.disabled === 'function'
              ? group.disabled(source)
              : group.disabled);
          }
          return true;
        });
        for (const group of groups ?? []) {
          list.push({
            ...group,
            rows: group.rows.map((row) => ({
              ...row,
              value: row.formatter ? row.formatter(source) : source[row.key],
            })),
          });
        }
        setGroups(list);
        setSource(source);
        setReady(true);
      }
    };

    const openDrawer = async (row) => {
      setVisible(true);
      const rowInfo = selectedRow || row;
      setCurrentRow(rowInfo);
      await loadData(rowInfo);
    };

    const closeDrawer = () => {
      setVisible(false);
      setGroups([]);
      setReady(false);
    };

    useImperativeHandle(ref, () => ({
      open: (record) => {
        openDrawer(record);
      },
    }));

    return (
      <>
        {children && React.cloneElement(children, { onClick: openDrawer })}
        <Drawer
          className="custom-arco-drawer"
          width={450}
          focusLock={false}
          autoFocus={false}
          closable={false}
          title={
            <div className="flex justify-between items-center w-full">
              <div>
                {typeof action.title === 'function'
                  ? action.title(currentRow)
                  : action.title}
              </div>
              <div>
                {action.config?.actions && (
                  <RowAction
                    getPopupContainer={(node: HTMLElement) => node.parentNode}
                    actions={action.config.actions}
                    row={currentRow}
                    onChange={async (action) => {
                      if (action.config.isRowDelete) {
                        closeDrawer();
                      }
                      onChange();
                      await loadData(currentRow);
                    }}
                  />
                )}
                {action.config?.actions && <Divider type="vertical" />}
                <Button
                  className="!text-[var(--color-text-1)]"
                  type="text"
                  onClick={closeDrawer}
                  icon={<IconClose />}
                ></Button>
              </div>
            </div>
          }
          visible={visible}
          onCancel={closeDrawer}
          footer={null}
        >
          {ready ? (
            <>
              {groups.map((group, index) => (
                <div
                  key={index}
                  className={`${index !== groups.length - 1 && 'mb-4'}`}
                >
                  {renderChildItem(group, index)}
                </div>
              ))}
              <div className="mt-10">
                <Button
                  type="text"
                  size="mini"
                  onClick={() => setUpdateHistoryVisible(!updateHistoryVisible)}
                  className="!pl-0 !text-[var(--color-neutral-6)]"
                >
                  {
                    <div>
                      <span className="mr-2">
                        {updateHistoryVisible ? '隐藏' : '显示'}修改信息
                      </span>
                      {updateHistoryVisible ? <IconUp /> : <IconDown />}
                    </div>
                  }
                </Button>
                {updateHistoryVisible && (
                  <div className="flex items-center gap-6 text-[var(--color-neutral-6)] text-xs">
                    <div className="flex items-center gap-2">
                      <IconUser />
                      <span>{source.updateByNm}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <IconSchedule />
                      <span>{source.updateTime}</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Skeleton animation />
          )}
        </Drawer>
      </>
    );
  }
);

export default DetailDrawer;
