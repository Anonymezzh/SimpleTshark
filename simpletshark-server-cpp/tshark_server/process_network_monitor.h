#ifndef __PROCESS_NETWORK_MONITOR_H__
#define __PROCESS_NETWORK_MONITOR_H__

#include "third_library/loguru/loguru.hpp"
#include "tshark_datatype.h"

//
// 监控进程的网络活动
// 用于把连接和进程ID进行关联
//
class ProcessNetworkMonitor {
public:
    virtual void startMonitor() {
        LOG_F(INFO, "未实现的进程网络活动监控类-startMonitor");
    }

    virtual void stopMonitor() {
        LOG_F(INFO, "未实现的进程网络活动监控类-stopMonitor");
    }

    // 根据五元组查找进程信息
    virtual std::shared_ptr<ProcessInfo> findProcessInfoByFiveTuple(FiveTuple &fiveTuple) {
        //LOG_F(INFO, "未实现的进程网络活动监控类-findProcessInfoByFiveTuple");
        return nullptr;
    }

    virtual void reset() {
        LOG_F(INFO, "未实现的进程网络活动监控类-reset");
    }
};

#endif