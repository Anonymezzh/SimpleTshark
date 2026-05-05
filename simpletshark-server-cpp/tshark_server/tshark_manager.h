#ifndef TSHARKMANAGER_H
#define TSHARKMANAGER_H
#include <list>
#ifdef __APPLE__
    #include <sys/_types/_pid_t.h>
#else
    #include <sys/types.h>
#endif
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <thread>
#include <mutex>
#include <memory>
#include <map>
#include <queue>
#include <condition_variable>

#include "tshark_datatype.h"
#include "database.hpp"
#include "process_network_monitor.h"
#include <third_library/rapidjson/document.h>
#include <third_library/rapidjson/writer.h>
#include <third_library/rapidjson/prettywriter.h>
#include <third_library/rapidjson/stringbuffer.h>

#include "process_util.hpp"

#ifdef _WIN32
// Windows 平台需要前置声明 LoopbackMonitor
class LoopbackMonitor;
#endif

// 最大处理的数据包大小：2GB
#define MAX_PACKET_PROCESS  2*1024*1024*1024UL

//#define MAX_PACKET_PROCESS  100*1024*1024

enum WORK_STATUS {
    STATUS_IDLE             = 0,               // 空闲状态
    STATUS_ANALYSIS_FILE    = 1,               // 离线分析文件中
    STATUS_CAPTURING        = 2,               // 在线采集抓包中
    STATUS_MONITORING       = 3                // 监控网卡流量中
};

class TSharkManager {

public:
    TSharkManager(std::string tsharkPath);
    ~TSharkManager();

    WORK_STATUS getWorkStatus();

    // 开始抓包
    bool startCapture(std::string adapterName);

    // 停止抓包
    void stopCapture();

    // 分析离线文件
    bool analysisFile(std::string filePath, std::string filter="");

    // 停止离线分析
    void stopAnalysisFile();

    // 获取离线分析历史记录
    void getAnalysisFileHistory(std::vector<std::string> &historyList);

    // 重置数据
    void reset();

    // 打印会话信息
    void printAllSessions();

    // 查询数据包总数和列表数据
    CountInfo getPacketCountInfo(QueryCondition &condition);
    bool getPacketList(QueryCondition &condition, std::vector<PacketInfo>& packetList, int &total);

    // 查询会话总数和列表数据
    bool getSessionList(QueryCondition &condition, std::vector<SessionInfo>& sessionList, int &total);

    // 获取指定数据包的详情内容
    bool getPacketDetailInfo(uint32_t frameNumber, rapidjson::Document &detailJson);

    // 获取会话数据流
    DataStreamCountInfo getSessionDataStream(uint32_t sessionId, std::vector<DataStreamItem>& dataStreamList);

    // 查询IP通信统计列表数据
    bool getIPStatsList(QueryCondition &condition, std::vector<IPStatsInfo> &ipStatsList, int &total);

    // 查询协议统计列表数据
    bool getProtoStatsList(QueryCondition &condition, std::vector<ProtoStatsInfo> &protoStatsList, int &total);

    // 查询国家统计列表数据
    bool getCountryStatsList(QueryCondition& condition, std::vector<CountryStatsInfo>& countryStatsList, int& total);

    // 保存当前数据包
    bool savePacket(std::string savePath);

    // 另存筛选结果数据包
    bool saveFilterPacket(std::string savePath, std::string filter);

    // -----------------------------以下与网卡流量趋势监控有关-----------------------------------
    // 开始监控所有网卡流量统计数据
    void startMonitorAdaptersFlowTrend();

    // 停止监控所有网卡流量统计数据
    void stopMonitorAdaptersFlowTrend();

    // 获取所有网卡流量统计数据
    void getAdaptersFlowTrendData(std::map<std::string, std::map<long, long>>& flowTrendData);

    // 清空流量监控数据
    void clearFlowTrendData();

    // 获取通信进程列表
    void getProcessList(std::set<std::shared_ptr<ProcessInfo>> &processList);


private:
    std::shared_ptr<PacketInfo> parsePacket(std::string& line);
    void processPacket(std::shared_ptr<PacketInfo> packet);
    void printPacketInfo(std::shared_ptr<PacketInfo> packet);

    // 抓包和分析数据包工作线程，负责处理tshark输出的数据
    void captureWorkThreadEntry(std::string adapterName);
    void analysisFileWorkThreadEntry(int threadNumber);

    // 清空离线分析任务队列
    void clearAnalysisFileQueue();

    // 负责存储数据包和会话信息的存储线程函数
    void storageThreadEntry();

    // 获取指定数据包内容，以十六进制形式
    bool getPacketHexData(uint32_t frameNumber, std::string& data);

    // 后台负责监控所有网卡流量数据的工作线程函数
    void adapterFlowTrendMonitorThreadEntry();


public:
    std::list<AdapterInfo> getNetworkAdapters();

private:

    // 工作状态
    WORK_STATUS workStatus = STATUS_IDLE;
    std::recursive_mutex workStatusLock;

    // 正在抓包的tshark进程PID
    PID_T captureTSharkPid = 0;
    bool stopFlag = false;

    // tshark、capinfos、editcap路径
    std::string tsharkPath, capinfosPath, editcapPath;

    // 捕获到的数据包列表，key是数据包ID，value是数据包信息指针
    std::map<uint32_t, std::shared_ptr<PacketInfo>> packetsMap;

    // 还未存储的增量数据包列表
    std::unordered_set<std::shared_ptr<PacketInfo>> packetSetTobeStore;

    // 捕获到的数据包分析后的会话表
    SessionMap sessionMap;
    std::map<uint32_t, std::shared_ptr<SessionInfo>> sessionIdMap;

    // 还未存储的增量会话列表，使用unordered_set，自动去重
    std::unordered_set<std::shared_ptr<SessionInfo>> sessionSetTobeStore;

    // 访问上面存储数据包和会话列表的锁
    std::mutex storeLock;

    // 当前数据包保存的默认文件
    std::string currentPcapFilePath;

    // 当前带过滤器的数据包保存的文件
    std::string currentFilterPcapFilePath;

    // 当前使用的过滤器
    std::string currentFilter;

    // 在线抓包工作线程
    std::shared_ptr<std::thread> captureWorkThread;

    // 离线分析的线程池
    std::vector<std::shared_ptr<std::thread>> analysisFileWorkThreads;

    // 存储线程，负责将获取到的数据包和会话信息存储入库
    std::shared_ptr<std::thread> storageThread;

    // 数据库存储
    std::shared_ptr<Database> storage;

    // 离线分析任务队列
    std::queue<std::string> analysisFileTaskQueue;
    std::mutex analysisFileTaskQueueLock;
    std::condition_variable analysisFileTaskQueueCondition;

    // 进程网络监控
    std::shared_ptr<ProcessNetworkMonitor> processNetworkMonitor;

    // 进程列表
    std::set<std::shared_ptr<ProcessInfo>> processList;

    // -----------------------------以下与网卡流量趋势监控有关-----------------------------------
    // 网卡流量趋势数据: <网卡名, <时间戳, 流量字节数>>
    std::map<std::string, std::map<long, long>> adapterFlowTrendDataMap;

    // 访问上面流量趋势数据的锁
    std::recursive_mutex adapterFlowTrendDataLock;

    // 网卡流量监控线程
    std::shared_ptr<std::thread> adapterFlowTrendMonitorThread;

    // 网卡流量监控停止标记
    bool adapterFlowTrendMonitorStopFlag = false;

    // 网卡流量监控的开始时间
    long adapterFlowTrendMonitorStartTime = 0;

#ifdef _WIN32
    // Windows 平台专用：回环网卡监控器
    std::unique_ptr<LoopbackMonitor> loopbackMonitor;
#endif
};


#endif //TSHARKMANAGER_H
