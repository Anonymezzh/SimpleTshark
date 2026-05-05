import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';
import {
  Button,
  Divider,
  Modal,
  Select,
  Skeleton,
  Space,
  Tree,
} from '@arco-design/web-react';
import { apiGet } from '@/services/api';
import {
  IconDelete,
  IconHome,
  IconPlus,
  IconSettings,
} from '@arco-design/web-react/icon';
import FormAction from '@/components/actions/FormAction';
import styles from './style/index.module.less';
import ConfirmAction from '@/components/actions/ConfirmAction';

const PermSpaceSelectControl = forwardRef(
  (
    {
      children,
      defaultPermSpaceKeys = [],
      onSubmit,
    }: {
      children: any;
      defaultPermSpaceKeys?: Array<string>[];
      onSubmit: (spaces, keys) => void;
    },
    ref
  ) => {
    const [visible, setVisible] = useState<boolean>(false);
    const [ready, setReady] = useState<boolean>(false);

    const [treeData, setTreeData] = useState([]);

    // 树选中项数据
    const [checkedKeys, setCheckedKeys] = useState([]);
    const [checkedPermSpaces, setCheckedPermSpaces] = useState([]);

    // 用于提交的数据
    const [submitPermSpaces, setSubmitPermSpaces] = useState([]);
    const [submitPermSpaceKeys, setSubmitPermSpaceKeys] = useState([]);

    // 预定义对象组数据
    const [permSpaceGroups, setPermSpaceGroups] = useState([]);
    const [permSpaceGroupModalVisible, setPermSpaceGroupModalVisible] =
      useState<boolean>(false);

    const addPermSpaceGroupAction = {
      key: 'addPermSpaceGroup',
      text: '将当前选择添加为门禁对象组',
      type: 'form',
      icon: <IconPlus />,
      config: {
        title: '新增预定义门禁对象组',
        labelCol: { span: 6 },
        wrapperCol: { span: 18 },
        submitUrl: '/inside/perm-space-group/add',
        submitSuccessMessage: '新增预定义门禁对象组成功',
        controls: [
          {
            key: 'groupName',
            label: '对象组名称',
            type: 'text',
            required: true,
          },
        ],
      },
      extraParams: {
        permSpace: submitPermSpaceKeys.join(','),
      },
    };

    const deletePermSpaceGroupAction = {
      key: 'deletePermSpaceGroup',
      type: 'confirm',
      text: '删除',
      config: {
        content: (row) =>
          `您确定要删除门禁对象组【${row.groupName}】吗？若确认，请点击“确定”按钮继续操作`,
        submitUrl: '/inside/perm-space-group/delById',
        submitKey: 'groupId',
        successText: '删除门禁对象组成功',
      },
    };

    useEffect(() => {
      setCheckedKeys(
        checkedPermSpaces.map((checkedPermSpace) => checkedPermSpace.id)
      );
      const permSpaces = [];
      const permSpaceKeys = [];
      for (const checkedPermSpace of checkedPermSpaces) {
        const { isAll, checkedGateList, isArea, id, belongToName } =
          checkedPermSpace;

        if (isAll === 0 && checkedGateList.length > 0) {
          // 对空间具体出入口授权
          permSpaces.push(...checkedGateList);
          permSpaceKeys.push(
            ...checkedGateList.map(
              (gate) => `gate|${gate.gateId}|${gate.belongToName}|1`
            )
          );
        } else {
          // 不选择具体出入口则对整个空间授权，或直接对空间内所有门禁授权
          permSpaces.push(checkedPermSpace);
          permSpaceKeys.push(
            `${isArea ? 'area' : 'room'}|${id}|${belongToName}|${isAll}`
          );
        }
      }

      setSubmitPermSpaces(permSpaces);
      setSubmitPermSpaceKeys(permSpaceKeys);
    }, [JSON.stringify(checkedPermSpaces)]);

    const openModal = () => {
      if (defaultPermSpaceKeys.length > 0) {
        setCheckedPermSpacesByKeys(defaultPermSpaceKeys);
      }
      loadData();
      loadPermSpaceGroup();
      setVisible(true);
    };

    // 组合数据
    const getCombineList = (areas) => {
      const processArea = (area) => {
        const processSpace = (space, isArea) => ({
          id: isArea ? space.areaId : space.roomId,
          name: isArea ? space.areaName : space.roomName,
          belongToName: `${area.belongToName}/${
            isArea ? space.areaName : space.roomName
          }`,
          isArea,
          isRoom: !isArea,
          isAll: 0,
          checkedGateList: [],
          disabled: area.isAll === 1,
          ...space,
        });

        area.childList = [
          ...(area.childList || []),
          ...(area.roomList || []),
        ].map((space) => processSpace(space, !space.roomId));
      };

      areas.forEach((area) => {
        const { areaId, areaName } = area;

        Object.assign(area, {
          id: areaId,
          name: areaName,
          belongToName: areaName,
          isArea: true,
          isAll: 0,
          checkedGateList: [],
          disabled: false,
        });

        processArea(area);
      });

      console.log(areas);
      return areas;
    };

    const loadData = async () => {
      setReady(false);
      const data = await apiGet('/inside/area/queryAreaTree', { range: 3 });
      setTreeData(getCombineList(data));
      setReady(true);
    };

    // 查询预定义门禁对象组信息
    const loadPermSpaceGroup = async () => {
      const groups = await apiGet('/inside/perm-space-group/listAll');
      setPermSpaceGroups(groups);
    };

    // 通过key回显选中数据
    const setCheckedPermSpacesByKeys = (keys) => {
      // 遍历树结构，找到需要禁用的空间
      const preprocessSpaces = (spaces, keys) => {
        const keyMap = new Map(
          keys.map((key) => {
            const [type, id, , , isAll] = key.split('|');
            return [id, { type, isAll: Number(isAll) }];
          })
        );

        const disableChildSpaces = (space) => {
          if (space.childList) {
            space.childList.forEach((child) => {
              child.disabled = true; // 禁用子空间
              disableChildSpaces(child); // 递归禁用其下的所有子空间
            });
          }
        };

        const processSpaces = (spaces) => {
          spaces.forEach((space) => {
            if (keyMap.has(space.id)) {
              const keyInfo = keyMap.get(space.id) as any;
              if (keyInfo.type === 'area' && keyInfo.isAll === 1) {
                // 仅禁用子空间
                disableChildSpaces(space);
              }
            }

            // 递归处理子空间
            if (space.childList) {
              processSpaces(space.childList);
            }
          });
        };

        processSpaces(spaces);
      };

      // 先处理树结构，禁用需要禁用的空间
      preprocessSpaces(treeData, keys);
      setTreeData([...treeData]);

      const extractedPermSpaces = [];

      const updateCheckedGateList = (tree, targetGate) => {
        function checkAndUpdateNode(node) {
          if (
            Array.isArray(node.gateList) &&
            node.gateList.some((gate) => gate.gateId === targetGate.gateId)
          ) {
            const extractedPermSpace = extractedPermSpaces.find(
              (space) => space.id === node.id
            );
            if (extractedPermSpace) {
              extractedPermSpace.checkedGateList.push(targetGate);
            } else {
              extractedPermSpaces.push({
                ...node,
                checkedGateList: [targetGate],
              });
            }
          }

          if (node.childList && node.childList.length > 0) {
            node.childList.forEach((childNode) =>
              checkAndUpdateNode(childNode)
            );
          }
        }

        tree.forEach((rootNode) => checkAndUpdateNode(rootNode));
      };

      keys.forEach((key) => {
        const [type, id, belongToName, isAll] = key.split('|');

        if (type === 'area' || type === 'room') {
          const area = {
            id,
            name: belongToName.split('/').pop(),
            belongToName,
            isArea: type === 'area',
            isRoom: type === 'room',
            isAll: Number(isAll),
            checkedGateList: [],
            disabled: Number(isAll) === 1,
          };

          extractedPermSpaces.push(area);
        }

        if (type === 'gate') {
          updateCheckedGateList(treeData, { gateId: id, belongToName });
        }
      });
      setCheckedPermSpaces(extractedPermSpaces);
    };

    // 选择的预定义门禁对象组回调
    const onPermSpaceGroupSelectChange = (value, option) => {
      if (!option) {
        setCheckedPermSpaces([]);
        return;
      }

      const keys = (option as any).extra.permSpace.split(',');
      setCheckedPermSpacesByKeys(keys);
    };

    // 联动更新树
    const updateTree = (
      items,
      disabled,
      currentCheckedPermSpaces = null,
      record = null
    ) => {
      let updatedCheckedPermSpaces = currentCheckedPermSpaces || [
        ...checkedPermSpaces,
      ];

      if (record) {
        const currentCheckedPermSpace = updatedCheckedPermSpaces.find(
          (checkedPermSpace) => checkedPermSpace.id === record.id
        );
        currentCheckedPermSpace.isAll = disabled ? 1 : 0;

        if (disabled) {
          currentCheckedPermSpace.checkedGateList = [];
        }
      }

      items.forEach((item) => {
        item.disabled = disabled;

        if (disabled) {
          updatedCheckedPermSpaces = updatedCheckedPermSpaces.filter(
            (checkedPermSpace) => checkedPermSpace.id !== item.id
          );
          item.checkedGateList = [];
        }

        if (item.childList && item.childList.length) {
          updateTree(item.childList, disabled);
        }
      });
      setCheckedPermSpaces(updatedCheckedPermSpaces);
      setTreeData([...treeData]);
    };

    // 选择项
    const onTreeCheck = async (value, extra) => {
      const checkedPermSpace = findTreeNodeByKey(treeData, extra.node.key);
      if (extra.checked) {
        checkedPermSpace.isAll = 0;
        setCheckedPermSpaces([...checkedPermSpaces, checkedPermSpace]);
      } else {
        setCheckedPermSpaces(
          checkedPermSpaces.filter(
            (checkedPermSpace) => checkedPermSpace.id !== extra.node.key
          )
        );
        if (checkedPermSpace.isArea) {
          updateTree(
            checkedPermSpace.childList,
            false,
            checkedPermSpaces.filter(
              (checkedPermSpace) => checkedPermSpace.id !== extra.node.key
            )
          );
        }
      }
      setTreeData([...treeData]);
    };

    // 切换全选区域状态
    const onIsAllSelectChange = (value, record) => {
      record.isAll = value;

      if (value === 1) {
        record.checkedGateList = [];
        updateTree(record.isArea ? record.childList : [], true, null, record);
      } else if (value === 0) {
        updateTree(record.isArea ? record.childList : [], false, null, record);
      }
    };

    // 循环渲染树
    const loopTreeNode = (data) => {
      return data.map((record) => {
        const checkedPermSpace = checkedPermSpaces.find(
          (space) => space.id === record.id
        );

        const title = (
          <div className="flex items-center leading-7">
            <div className="right-align-node-text flex items-center cursor-pointer">
              {record.isRoom && <IconHome className="mr-1.5" />}
              <div>{record.name}</div>
            </div>
            {!record.disabled && checkedPermSpace && (
              <div
                className="absolute right-8 flex gap-4 cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                {record.isArea && (
                  <Select
                    style={{ width: '130px' }}
                    defaultValue={checkedPermSpace.isAll}
                    size="small"
                    options={[
                      { label: '本区域', value: 0 },
                      { label: '本区域与内部', value: 1 },
                    ]}
                    onChange={(value) => onIsAllSelectChange(value, record)}
                  />
                )}
                {checkedPermSpace.isAll === 0 && (
                  <Select
                    style={{ width: '170px' }}
                    allowClear
                    defaultValue={checkedPermSpace.checkedGateList.map(
                      (gate) => gate.gateId
                    )}
                    defaultActiveFirstOption={false}
                    placeholder="请选择出入口"
                    mode="multiple"
                    renderTag={(
                      { label, value, closable, onClose },
                      index,
                      valueList
                    ) =>
                      index === 0 ? (
                        <span className="ml-2">
                          已选择{valueList.length}个出入口
                        </span>
                      ) : null
                    }
                    size="small"
                    options={
                      Array.isArray(record.gateList)
                        ? record.gateList.map((gate) => ({
                            label: gate.gateName,
                            value: gate.gateId,
                            extra: {
                              ...gate,
                              belongToName: `${record.belongToName}/${gate.gateName}`,
                            },
                          }))
                        : []
                    }
                    onChange={(value, options) => {
                      checkedPermSpace.checkedGateList = (options as any).map(
                        (option) => option.extra
                      );
                      setCheckedPermSpaces([...checkedPermSpaces]);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        );
        return (
          <Tree.Node
            className={`${styles['right-align-tree-node']} !items-center !cursor-default`}
            key={record.id}
            title={title}
            checkable
            disableCheckbox={record.disabled}
          >
            {record.childList ? loopTreeNode(record.childList) : null}
          </Tree.Node>
        );
      });
    };

    const findTreeNodeByKey = (data, key) => {
      for (const node of data) {
        if (node.id === key) {
          return node;
        }
        if (node.childList) {
          const found = findTreeNodeByKey(node.childList, key);
          if (found) {
            return found;
          }
        }
      }
      return null;
    };

    // 确认
    const handleOk = () => {
      onSubmit(submitPermSpaces, submitPermSpaceKeys);
      setCheckedPermSpaces([]);
      setVisible(false);
    };

    // 取消
    const handleCancel = () => {
      setCheckedPermSpaces([]);
      setVisible(false);
    };

    useImperativeHandle(ref, () => ({
      openModal,
    }));

    return (
      <>
        {React.cloneElement(children, { onClick: openModal })}

        <Modal
          className="custom-arco-modal"
          title="选择门禁"
          visible={visible}
          onOk={handleOk}
          onCancel={handleCancel}
          autoFocus={false}
          focusLock={true}
          style={{ width: '750px' }}
        >
          {ready ? (
            <>
              <div className="flex justify-between items-center">
                <div>
                  已选择 <span>{checkedPermSpaces.length}</span> 项
                </div>
                <Select
                  style={{ width: 240 }}
                  placeholder="选择预定义门禁对象组"
                  allowClear
                  onChange={onPermSpaceGroupSelectChange}
                  options={permSpaceGroups.map((group) => ({
                    label: group.groupName,
                    value: group.spaceGroupId,
                    extra: group,
                  }))}
                  bordered={false}
                  dropdownRender={(menu) => (
                    <div>
                      {menu}
                      <Divider style={{ margin: 0 }} />
                      <ul>
                        {submitPermSpaceKeys.length > 0 && (
                          <li className="h-9 leading-9 px-3 cursor-pointer hover:bg-[var(--color-fill-2)] hover:text-[var(--color-text-1)]">
                            <FormAction
                              key={addPermSpaceGroupAction.key}
                              action={addPermSpaceGroupAction}
                              onSubmit={loadPermSpaceGroup}
                            >
                              <Space>
                                {addPermSpaceGroupAction.icon}
                                {addPermSpaceGroupAction.text}
                              </Space>
                            </FormAction>
                          </li>
                        )}
                        <li className="h-9 leading-9 px-3 cursor-pointer hover:bg-[var(--color-fill-2)] hover:text-[var(--color-text-1)]">
                          <div
                            onClick={() => setPermSpaceGroupModalVisible(true)}
                          >
                            <Space>
                              <IconSettings />
                              管理门禁对象组
                            </Space>
                          </div>
                        </li>
                      </ul>
                    </div>
                  )}
                />
              </div>

              <Tree
                className="mt-4"
                actionOnClick="check"
                checkStrictly
                checkable
                checkedKeys={checkedKeys}
                onCheck={onTreeCheck}
                fieldNames={{
                  key: 'id',
                  title: 'name',
                  children: 'childList',
                }}
              >
                {loopTreeNode(treeData)}
              </Tree>
            </>
          ) : (
            <Skeleton text={{ rows: 3 }} animation />
          )}
        </Modal>

        <Modal
          className="custom-arco-modal"
          title="管理预定义门禁对象组"
          visible={permSpaceGroupModalVisible}
          footer={null}
          autoFocus={false}
          focusLock={true}
          onCancel={() => setPermSpaceGroupModalVisible(false)}
          style={{ width: '500px' }}
        >
          <ul className="h-72 overflow-auto">
            {permSpaceGroups.map((group) => (
              <li
                key={group.spaceGroupId}
                className="mb-4 flex items-center justify-between w-full"
              >
                <span>{group.groupName}</span>
                <ConfirmAction
                  action={deletePermSpaceGroupAction}
                  onChange={loadPermSpaceGroup}
                  selectedRow={{ ...group, groupId: group.spaceGroupId }}
                >
                  <Button
                    icon={<IconDelete />}
                    shape="circle"
                    status="danger"
                  ></Button>
                </ConfirmAction>
              </li>
            ))}
          </ul>
        </Modal>
      </>
    );
  }
);

export default PermSpaceSelectControl;
