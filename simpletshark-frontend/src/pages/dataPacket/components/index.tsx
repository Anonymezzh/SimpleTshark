import React, { useState, useContext, useRef, useEffect, useMemo } from 'react';
import { Button, Card, Grid, Input, AutoComplete, Spin, Typography } from '@arco-design/web-react';
import debounce from 'lodash/debounce';
import DataPage from '@/components/DataPage';
import { deviceTableConfig } from '../config';
import Footer from '@/components/Footer'
import DetailsList from '../../../components/DetailsList';
import { Resizable } from 're-resizable';
import { LayoutContext } from '@/layoutContext';
import { apiGet, apiPost } from '@/services/api';
import SaveData from '@/components/SaveData';
import { IconSearch } from '@arco-design/web-react/icon';

function List({ proto = null }) {
    const DataPageRef = useRef(null)
    const inputRef = useRef(null)
    const autoCompleteRef = useRef(null)
    const queryParams = window.location.hash.includes('?protocol') && window.location.hash.split('=');
    const [row, setRow] = useState(null)
    const [height, setHieght] = useState(0)
    const [initFilter, setInitFilter] = useState(queryParams[queryParams.length - 1]?.toLocaleLowerCase())
    const [inputValue, setInputValue] = useState(queryParams[queryParams.length - 1]?.toLocaleLowerCase() || '');
    const [filter, setFilter] = useState(null)
    const [filterTotal, setFilterTotal] = useState(0)
    const [total, setTotal] = useState(0)
    const [options, setOptions] = useState([]);
    const [fetching, setFetching] = useState(false);
    const justSelectedRef = useRef(false);
    const { refreshLoading, workStatus } = useContext(LayoutContext);
    const [obj, setObj] = useState(null)
    const handleResize = (e = null) => {
        const tableDom: any = document.querySelector('.arco-table-body')
        const listDom: any = document.querySelector('.datapackage-info')
        listDom.style.height = `calc(100vh - ${(e.clientY + 48)}px)`
        tableDom.style.height = `calc(100vh - ${listDom.offsetHeight + 270}px)`
        tableDom.style.maxHeight = `calc(100vh - ${listDom.offsetHeight + 270}px)`
    }
    const getPacketCountInfo = async () => {
        const res: any = await apiPost('/api/getPacketCountInfo', { proto })
        setObj(res.data)
    }
    const onLoadFinish = (res) => {
        setTotal(res.total)
        if (inputRef.current.dom?.value)
            setFilterTotal(res.total)
        else
            setFilterTotal(0)
    }

    // const debouncedFetchUser = debounce(async (inputValue) => {
    //     if (!inputValue) return
    //     setFetching(true);
    //     setOptions([]);
    //     const res = await apiGet(`/api/getFilterFieldList?keyword=${inputValue}`)
    //     setFetching(false)
    //     setOptions(res.data)
    // }, 500)

    // 确保 debounce 只创建一次
    const debouncedFetchUser = useMemo(() => {
        return debounce(async (inputValue) => {
        if (!inputValue) return;
        setFetching(true);
        setOptions([]);
        
        try {
            const res = await apiGet(`/api/getFilterFieldList?keyword=${inputValue}`);
            setOptions(res.data);
        } finally {
            setFetching(false);
        }
        }, 50);
    }, []);



    useEffect(() => {
        getPacketCountInfo()
    }, [])
    useEffect(() => {
        if (refreshLoading === 1) {
            DataPageRef.current.loadData()
            getPacketCountInfo()
        }
    }, [refreshLoading])
    const loadData = () => {
        DataPageRef.current.loadData()
        getPacketCountInfo()
    }
    useEffect(() => {
        if (workStatus === 2) {
            DataPageRef.current.clearData()
            const intervalId = setInterval(loadData, 2000);
            return () => {
                clearInterval(intervalId)
            };
        }
    }, [workStatus])


    const onClickSearch = () => {
        const newFilter = inputValue || initFilter
        console.log("new filter: ", newFilter)
        setFilter(newFilter)
    }

    return (
        <>
            {/* <Typography.Title heading={6} className="page-title">
        全部数据包
      </Typography.Title> */}
            {filterTotal > 0 && <SaveData filter={filter} />}
            <Card className='full-content'>
                <div className='flex justify-between items-center'>
                    <div style={{ width: 'calc(100% - 100px)' }}>
                        <AutoComplete
                            ref={autoCompleteRef}
                            value={inputValue}
                            style={{ width: '100%' }}
                            data={options}
                            placeholder='请输入过滤表达式'
                            allowClear
                            disabled={workStatus === 2}
                            loading={fetching}
                            onChange={(value) => {
                                setInputValue(value);
                                if (!value) {
                                    // 清空时
                                    setInitFilter('');
                                }
                                // 重置选择标记
                                justSelectedRef.current = false;
                                debouncedFetchUser(value);
                            }}
                            onSelect={(value) => {
                                // 选择候选项时，只填充内容，不触发搜索
                                setInputValue(value);
                                justSelectedRef.current = true;
                                // 延迟重置标记，以便 onPressEnter 能读取到
                                setTimeout(() => {
                                    justSelectedRef.current = false;
                                }, 100);
                                // 保持焦点，让用户可以继续输入
                                setTimeout(() => {
                                    if (autoCompleteRef.current) {
                                        autoCompleteRef.current.focus();
                                    }
                                }, 0);
                            }}
                            onPressEnter={(e) => {
                                // 如果刚刚选择了候选项，不触发搜索
                                if (!justSelectedRef.current) {
                                    onClickSearch();
                                }
                            }}
                        />
                    </div>
                    <div style={{ width: '90px' }}>
                        <Button type="primary" onClick={onClickSearch} icon={<IconSearch />}>查找</Button>
                    </div>
                </div>
                <Resizable
                    style={{ paddingBottom: 10 }}
                    enable={{ left: false, right: false, bottom: true, top: false }}
                    onResize={(e: any) => handleResize(e)}
                >
                    <DataPage ref={DataPageRef} config={deviceTableConfig(proto)} submitRowDetails={(value) => { setRow(value) }}
                        extraParams={{ proto, filter: filter || initFilter?.toLocaleLowerCase() }} onLoadFinish={onLoadFinish} />
                </Resizable>
                {total > 0 && <DetailsList row={row} />}
                <Footer config={{ data: [{ title: '数据包总数', num: obj?.totalPackets || 0, unit: '个' }, { title: '总字节数', num: obj?.totalBytes || 0 }] }} />
            </Card>
        </>
    );
}

export default List;