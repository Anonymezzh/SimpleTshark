import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useContext,
  useLayoutEffect
} from 'react';
import {
  Divider,
  Empty,
  Grid,
  Pagination,
  PaginationProps,
  Result,
  Spin,
  Table,
  Link,
} from '@arco-design/web-react';
import { Resizable } from 'react-resizable';
import 'react-resizable/css/styles.css';
import { FlowIcon } from '@/utils/icons'
import { apiGet, apiPost } from '@/services/api';
import PageFilter from '@/components/PageFilter';
import DetailAction from '@/components/actions/DetailAction';
import RowAction from '@/components/RowAction';
import { DataPageConfig } from '@/types';
import useAuth from '@/hooks/useAuth';
import { LayoutContext } from '@/layoutContext';
import { debounce } from 'lodash';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

// 定义自定义调整大小手柄的属性类型
interface CustomResizeHandleProps {
  handleAxis?: 'x' | 'y';
  [key: string]: any; // 其他属性
}
// 自定义调整大小手柄
const CustomResizeHandle = forwardRef<HTMLElement, CustomResizeHandleProps>(({ handleAxis, ...restProps }: { handleAxis?: 'x' }, ref) => {
  return (
    <span
      ref={ref}
      className={`react-resizable-handle react-resizable-handle-${handleAxis}`}
      {...restProps}
      onClick={(e) => {
        e.stopPropagation();
      }}
    />
  );
});

// 自定义表头单元格
const ResizableTitle = (props) => {
  const { onResize, width, ...restProps } = props;

  if (!width) {
    return <th {...restProps} />;
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={<CustomResizeHandle />}
      onResize={onResize}
      draggableOpts={{
        enableUserSelectHack: false,
      }}
    >
      <th {...restProps} />
    </Resizable>
  );
};
const DataPage = forwardRef(
  (
    {
      config,
      extraParams = {},
      loadDataList,
      onLoadFinish,
      onLoadOtherData,
      submitRowDetails,
      currentId,
      leftScroll,
      page
    }: {
      config: DataPageConfig;
      extraParams?: any;
      loadDataList?: any;
      onLoadFinish?: (params: any, id?: any, current?: any) => void;
      onLoadOtherData?: (id?: any) => void;
      submitRowDetails?: (record) => void;
      currentId?: any;
      leftScroll?: any;
      page?: any;
    },
    ref
  ) => {
    let pageNum = 1
    const { workStatus } = useContext(LayoutContext);
    config = { immediate: true, ...config };
    const { hasPermission } = useAuth();

    const [data, setData] = useState([]);
    const [timeStamp, setTimeStamp] = useState(new Date().getTime());

    const detailActionRef = useRef(null);
    const [currentRowId, setCurrentRowId] = useState(null)
    const [sorter, setSorter] = useState({ field: null, order: null });

    const [searchParams, setSearchParams] = useState(
      config.filter?.group
        ? { [config.filter.group.key]: config.filter.group.groups[0].key }
        : {}
    );
    const [pagination, setPagination] = useState<PaginationProps>({
      sizeCanChange: true,
      showTotal: true,
      pageSize: config?.page?.pageSize || 100,
      current: 1,
      pageSizeChangeResetCurrent: true,
    });
    const [loading, setLoading] = useState(false);
    const [height, setHeight] = useState(1);
    const [searchFormVisible, setSearchFormVisible] = useState(1);
    const [columns, setColumns] = useState([])
    const memoizedSearchParams = useMemo(
      () => JSON.stringify(searchParams),
      [searchParams]
    );
    const memoizedExtraParams = useMemo(
      () => JSON.stringify(extraParams),
      [extraParams]
    );
    const setSearchHeight = () => {
      const dom = document.getElementById('searchForm');
      const filterValueDom = document.getElementById('filterValue');
      if (!dom && !filterValueDom) return;
      const domHeight = dom?.offsetHeight ? dom?.offsetHeight + 20 : 0;
      const filterValueHeight = filterValueDom?.offsetHeight || 1;
      const height = domHeight + filterValueHeight;
      setHeight(height);
    };
    const changeTableScrollHeight = (value) => {
      setSearchFormVisible(value);
    };
    // 根据选中状态返回不同的类名
    const rowClassName = (record) => {
      return record[config.rowKey] === currentRowId ? 'selected-row' : '';
    };
    // 表格下拉滚动加载
    const handleScroll = () => {
      const dom: any = document.querySelector('.custom-arco-table .arco-table-body')
      if (!dom) {
        return
      }
      dom.addEventListener('scroll', function () {
        if (dom.scrollTop + dom.clientHeight >= dom.scrollHeight) {
          if (Math.ceil(pagination.total / pagination.pageSize) <= pageNum) return
          pageNum = page ? ++page : ++pageNum
          loadData('scroll')
        }
      })
    }
    // 滚动到特定的行
    const scrollToRow = (rowIndex) => {
      // 找到表格容器
      const tableBody: any = document.querySelector('.arco-table-body');
      if (!tableBody) {
        console.log('未找到表格容器');
        return;
      }

      const index = data.findIndex(v => v.frameNumber === rowIndex);
      if (index < 0) {
        console.log('未找到对应的数据行');
        return;
      }

      // 计算目标位置 - 使用表格容器的scrollTop而不是scrollIntoView
      const rowHeight = 30; // 根据你的实际行高调整
      const targetScrollTop = index * rowHeight;
      const containerHeight = tableBody.clientHeight;
      const centerOffset = (containerHeight / 2) - (rowHeight / 2);

      // 直接设置scrollTop，避免scrollIntoView导致页面滚动
      tableBody.scrollTo({
        top: Math.max(0, targetScrollTop - centerOffset),
        behavior: 'smooth'
      });
    };
    const handleTableChange = (pagination, filters, sorter) => {
      // 更新排序状态
      setSorter(filters?.direction ? {
        field: filters.field,
        order: filters.direction === 'ascend' ? 'asc' : 'desc',
      } : null);
    };
    useImperativeHandle(ref, () => ({
      clearData,
      loadData,
      onResetPage,
      scrollToRow
    }));
    useLayoutEffect(() => {
      if (config?.scrollLoad)
        handleScroll();
    }, [pagination.total])
    useEffect(() => {
      setSearchHeight();
    }, [searchFormVisible]);
    useEffect(() => {
      if (currentId) {
        setCurrentRowId(currentId)
      }
    }, [currentId])
    useEffect(() => {
      if (!config.immediate) {
        config.immediate = true;
        return;
      }
      if (config.scrollLoad && pagination.current > 1) return
      loadData();
    }, [
      pagination.current,
      pagination.pageSize,
      memoizedSearchParams,
      memoizedExtraParams,
      timeStamp,
      sorter,
      loadDataList,
    ]);
    useEffect(() => {
      if (leftScroll) {
        if (Math.ceil(pagination.total / pagination.pageSize) <= page) return
        pageNum = ++page
        loadData('scroll')
      }
    }, [leftScroll])

    // 清空表格数据
    const clearData = () => {
      setData([])
    }
  
    const loadData = async (type?: any) => {
      try {
        if (!hasPermission(config.permission)) {
          return;
        }
        const { current, pageSize } = pagination;
        if (workStatus !== 2)
          setLoading(true);
        const params = {
          pageNum: type === 'scroll' && config.scrollLoad ? pageNum : current,
          pageSize,
          ...searchParams,
          ...extraParams,
        };
        let res: any;
        if (config.paramType === 'data') {
          const query = sorter?.field && `&orderBy=${sorter.field}&descOrAsc=${sorter.order}`
          res = await apiPost(`${config.dataUrl}?pageNum=${params.pageNum}&pageSize=${pageSize}${query ? query : ''}`, params)
        } else {
          res = await apiGet(config.dataUrl, params);
        }
        res.data.map((item, index) => {
          item.orderNumber = item.frameNumber || ((params.pageNum - 1) * pagination.pageSize + parseInt(index) + 1)
        })

        // 如果是滚动加载，则追加数据，否则直接替换当前页数据
        if (config.scrollLoad && type)
          setData((prevData) => [...prevData, ...res.data]);
        else {
          setData(res.data || []);
        }

        setPagination((prevPagination) => ({
          ...prevPagination,
          current: params.pageNum,
          total: res.total,
        }));
        const rowId = res.data[0] ? res.data[0][config.rowKey] : null;
        if (config.rowDetailAction === 'change') {
          setCurrentRowId(rowId)
          submitRowDetails(res.data[0])
        }
        onLoadFinish && onLoadFinish(res, rowId, params.pageNum);
      } catch ({ message }) {
      } finally {
        setLoading(false);
      }
    };

    const onChangeTable = (current, pageSize) => {
      const table: any = document.querySelector('.custom-arco-table .arco-table-body')
      if (table) {
        table.scrollTop = 0;
      console.log('table', table)
      }
      setPagination({
        ...pagination,
        current,
        pageSize,
      });
    };

    // 重置页码到第1页
    const onResetPage = () => {
      setPagination({
        ...pagination,
        current: 1,
      });
    };
    useEffect(() => {
      let _columns = [{
        title: '序号', align: 'center', width: 70, dataIndex: 'orderNumber'
      }, ...config.columns];
      if (config.rowActions) {
        _columns = [
          ..._columns,
          {
            className: 'custom-arco-table-row-action',
            fixed: 'right',
            title: '操作',
            align: 'center' as const,
            width: 60,
            dataIndex: 'operations',
            render: (_, record) => (
              <div
                className="operation-cell-wrapper"
                onClick={async (e) => {
                  const params = new URLSearchParams({ ...record }).toString();
                  e.stopPropagation();
                  console.log('=== 点击查看会话详情按钮 ===');
                  console.log('sessionId:', record.sessionId);
                  console.log('record:', record);

                  localStorage.setItem(`row${record.sessionId}`, JSON.stringify(record))
                  console.log('已保存数据到 localStorage');

                  try {
                    // 使用 Tauri WebviewWindow API 创建新窗口
                    console.log('开始创建新窗口...');
                    const windowLabel = `details-${record.sessionId}`;
                    const windowIndex = record.sessionId;
                    const windowUrl = `/#/details?sessionId=${record.sessionId}&windowIndex=${windowIndex}`;
                    console.log('窗口标签:', windowLabel);
                    console.log('窗口 URL:', windowUrl);

                    const webview = new WebviewWindow(windowLabel, {
                      url: windowUrl,
                      title: '会话详情',
                      width: 1200,
                      height: 800,
                      center: true,
                      decorations: false,
                      shadow: true,
                    });

                    console.log('WebviewWindow 实例已创建:', webview);

                    // 监听窗口创建事件
                    webview.once('tauri://created', () => {
                      console.log('✓ 新窗口创建成功!');
                    });

                    webview.once('tauri://error', (e) => {
                      console.error('✗ 创建窗口失败:', e);
                    });
                  } catch (error) {
                    console.error('创建窗口时发生错误:', error);
                  }
                }}
              >
                <div title='查看会话详情' className="flow-icon"><FlowIcon /></div>
              </div>
            ),
          },
        ];
      }
      setColumns(_columns)
    }, [config.columns, config.rowActions])

    const renderDisplayItem = (Component) => {
      return data.map((dataItem, index) => {
        return (
          <Grid.GridItem key={index}>
            <Component data={dataItem} onChange={loadData} />
          </Grid.GridItem>
        );
      });
    };
    const formatHeight = (value: number | string) =>
      typeof value === 'number' ? `${value}px` : value;

    const computedTableHeight = formatHeight(
      config.maxHeight ?? `calc(100vh - ${config.scrollHeight || 325 + height}px)`
    );
    const tableWrapperStyle = config.virtualized === false ? {
      height: computedTableHeight,
      maxHeight: computedTableHeight,
      overflowY: 'auto' as const,
      overflowX: config.scrollX ? 'auto' as const : 'hidden' as const,
    } : undefined;
    const tableScrollConfig = config.virtualized === false
      ? {
        x: config.scrollX ? 'max-content' : undefined,
      }
      : {
        y: config.maxHeight ? config.maxHeight : `calc(100vh - ${config.scrollHeight || 325 + height}px)`,
        x: config.scrollX ? '100%' : undefined,
      };
    const columnsArr =
      columns.map((column, index) => {
        if (column.width) {
          return {
            ...column,
            onHeaderCell: (col) => ({
              width: col.width,
              onResize: handleResize(index),
            }),
          };
        }

        return column;
      })
    function handleResize(index) {
      return (e, { size }) => {
        setColumns((prevColumns) => {
          const nextColumns = [...prevColumns];
          nextColumns[index] = { ...nextColumns[index], width: size.width };
          return nextColumns;
        });
      };
    }
    // 自定义单元格组件
    const CustomTableCell = ({ children, rowData, columnIndex }) => {
      // 根据 rowData 中的数据动态设置样式或内容
      const cellStyle = {
        backgroundColor: rowData?.color ? `rgb(var(--${rowData.color}))` : '',
        height: 30,
        lineHeight: '30px',
        display: 'block'
      };

      return <div className='td-row' style={cellStyle}>{children}</div>;
    };
    const components = {
      header: {
        th: ResizableTitle,
      },
      body: {
        cell: (props) => <CustomTableCell {...props} />,
      },
    };


    return (
      <>
        {hasPermission(config.permission) ? (
          config.customDisplayComponent ? (
            <Spin loading={loading} className="w-full">
              {data.length > 0 ? (
                <Grid
                  cols={{ xs: 2, sm: 2, md: 2, lg: 2, xl: 2, xxl: 3 }}
                  colGap={12}
                  rowGap={16}
                >
                  {renderDisplayItem(config.customDisplayComponent)}
                </Grid>
              ) : (
                <Empty className="mt-10" />
              )}
            </Spin>
          ) : (
            <>
            <div className="data-page-table" style={tableWrapperStyle}>
            <Table
                className="custom-arco-table mt-[10px]"
                rowKey={config.rowKey}
                loading={loading}
                //onChange={onChangeTable}
                // pagination={
                //   pagination.total > pagination.pageSize ? pagination : false
                // }
                pagination={false}
                virtualized={config.virtualized !== false}
                scroll={tableScrollConfig}
                rowClassName={rowClassName}
                columns={columnsArr}
                components={components}
                data={data}
                onChange={handleTableChange} // 监听表格的变化，包括排序、筛选和分页
                onRow={(record) =>
                  config.rowDetailAction === 'change'
                    ? {
                      onClick: (e) => {
                        setCurrentRowId(record[config.rowKey])
                        submitRowDetails(record)
                      },
                      style: { cursor: 'pointer' },
                    } : {}
                  // : config.rowDetailAction === 'open' ? {
                  //   onClick: (e) => {
                  //     window.open('/#/details')
                  //   },
                  //   style: { cursor: 'pointer' },
                  // } : {}
                }
              />
            </div>
              {!config.hiddenPagination && data.length > 0 ? (
                <Pagination
                  sizeOptions={[50, 100, 200, 500, 1000]}
                  total={pagination.total}
                  size={config.size}
                  current={pagination.current}
                  pageSize={pagination.pageSize}
                  onChange={onChangeTable}
                  sizeCanChange
                  showTotal
                />

              ) : null}
            </>
          )
        ) : (
          <Result
            status="403"
            subTitle="对不起，您没有访问该资源的权限"
          ></Result>
        )}
        {config.rowDetailAction && (
          <DetailAction
            ref={detailActionRef}
            action={config.rowDetailAction}
            onChange={loadData}
          />
        )}
      </>
    );
  }
);

export default DataPage;
