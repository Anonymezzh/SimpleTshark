#include "tshark_manager.h"
#include "third_library/ip2region/ip2region_util.h"
#include "third_library/loguru/loguru.hpp"
#include "process_util.hpp"
#include "misc_util.hpp"
#include "tshark_util.hpp"
#include "network_stats_util.hpp"
#include <iostream>
#include <thread>
#include <mutex>
#include <iomanip>
#include <cmath>
#include <cstdio>
#include <vector>
#include <array>
#include <memory>
#include <stdexcept>
#include <sstream>
#include <set>
#include <ctime>
#include <time.h>


#ifdef _WIN32
#include <windows.h>
// 使用宏来处理Windows和Unix的不同popen实现
#define popen _popen
#define pclose _pclose
#include "process_network_monitor_windows.hpp"
#elif defined(__APPLE__)
#include "process_network_monitor_mac.hpp"
#include <unistd.h>
#include <signal.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <netinet/in.h>
#include <cstdio>
#elif defined(__linux__)
#include "process_network_monitor_linux.hpp"
#include <unistd.h>
#include <signal.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <netinet/in.h>
#include <cstdio>
#else
#include <unistd.h>
#include <signal.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <netinet/in.h>
#include <cstdio>
#endif

// tshark分析的字段列表
const char *tsharkFieldsList[] = {
        "-T", "fields",
        "-e", "frame.number",
        "-e", "frame.time_epoch",
        "-e", "eth.src",
        "-e", "eth.dst",
        "-e", "ip.src",
        "-e", "ipv6.src",
        "-e", "tcp.srcport",
        "-e", "udp.srcport",
        "-e", "ip.dst",
        "-e", "ipv6.dst",
        "-e", "tcp.dstport",
        "-e", "udp.dstport",
        "-e", "tcp.stream",
        "-e", "udp.stream",
        "-e", "frame.len",
        "-e", "frame.cap_len",
        "-e", "ip.proto",
        "-e", "ipv6.nxt",
        "-e", "_ws.col.Protocol",
        "-e", "_ws.col.Info",
        "-e", "http.host",
        "-e", "dns.qry.name",
        "-e", "tls.handshake.extensions_server_name",
        "-E", "separator=/t",
        "-E", "quote=d",
        "-E", "occurrence=f"
};


TSharkManager::TSharkManager(std::string tsharkPath) {

    if (tsharkPath.find(" ") != std::string::npos) {
        this->tsharkPath = "\"" + tsharkPath + "tshark" + "\"";
        this->capinfosPath = "\"" + tsharkPath + "capinfos" + "\"";
        this->editcapPath = "\"" + tsharkPath + "editcap" + "\"";
    } else {
        this->tsharkPath = tsharkPath + "tshark";
        this->capinfosPath = tsharkPath + "capinfos";
        this->editcapPath = tsharkPath + "editcap";
    }

    workStatus = STATUS_IDLE;

    TSharkUtil::init(tsharkPath);
    if (!IP2RegionUtil::init(MiscUtil::getDefaultDataDir() + "ip2region.xdb")) {
        throw std::runtime_error("ip2region init error");
    }

#ifdef _WIN32
    processNetworkMonitor = std::make_shared<ProcessNetworkMonitorWindows>();
#elif defined(__APPLE__)
    processNetworkMonitor = std::make_shared<ProcessNetworkMonitorMac>();

    // 暂时不用Linux进程监控，有点问题
    //#elif defined(__linux__)
    //    processNetworkMonitor = std::make_shared<ProcessNetworkMonitorLinux>();
#else
    processNetworkMonitor = std::make_shared<ProcessNetworkMonitor>();
#endif

    reset();
}

TSharkManager::~TSharkManager() {

    std::cout << "TSharkManager::~TSharkManager" << std::endl;
    //reset();
    if (captureWorkThread) {
        captureWorkThread->join();
        captureWorkThread.reset();
    }
    if (storageThread) {
        storageThread->join();
        storageThread.reset();
    }

    clearAnalysisFileQueue();
}

void TSharkManager::reset() {

    LOG_F(INFO, "reset called");

    // 如果还在抓包或者分析文件，将其停止
    if (workStatus == STATUS_CAPTURING) {
        stopCapture();
    } else if (workStatus == STATUS_ANALYSIS_FILE) {
        stopAnalysisFile();
    } else if (workStatus == STATUS_MONITORING) {
        stopMonitorAdaptersFlowTrend();
    }

    workStatus = STATUS_IDLE;
    captureTSharkPid = 0;
    stopFlag = true;

    clearAnalysisFileQueue();

    packetsMap.clear();
    packetSetTobeStore.clear();
    sessionMap.clear();
    sessionIdMap.clear();
    sessionSetTobeStore.clear();

    if (captureWorkThread) {
        captureWorkThread->join();
        captureWorkThread.reset();
    }
    if (storageThread) {
        storageThread->join();
        storageThread.reset();
    }

    // 进程网络监控器重置
    processNetworkMonitor->reset();
    processList.clear();

    // 删除之前的数据，重新开始
    remove(currentPcapFilePath.c_str());
    currentPcapFilePath = "";
    currentFilter = "";
    currentFilterPcapFilePath = "";

    // 重置数据库
    storage.reset();    // 析构旧的对象，关闭旧数据库文件的占用
    std::string dbFullPath = MiscUtil::getDefaultDataDir() + "simpletshark.db";
    remove(dbFullPath.c_str());
    storage = std::make_shared<Database>(dbFullPath);
}

WORK_STATUS TSharkManager::getWorkStatus() {
    std::unique_lock<std::recursive_mutex> lock(workStatusLock);
    return workStatus;
}

// 开始抓包分析
bool TSharkManager::startCapture(std::string adapterName) {

    std::unique_lock<std::recursive_mutex> lock(workStatusLock);

    // 检查网卡名是否有效
//    bool check = false;
//    std::list<AdapterInfo> adapterList = getNetworkAdapters();
//    for (auto& adapter : adapterList) {
//        if (adapter.name == adapterName) {
//            check = true;
//            break;
//        }
//    }
//    if (!check) {
//        LOG_F(ERROR, "网卡名无效：%s", adapterName.c_str());
//        return false;
//    }

    reset();

    // 启动进程网络活动监控
    processNetworkMonitor->startMonitor();

    // 启动线程读取 tshark 输出
    workStatus = STATUS_CAPTURING;
    stopFlag = false;
    captureWorkThread = std::make_shared<std::thread>(&TSharkManager::captureWorkThreadEntry, this, "\"" + adapterName + "\"");
    storageThread = std::make_shared<std::thread>(&TSharkManager::storageThreadEntry, this);
    return true;
}

// 停止抓包分析
void TSharkManager::stopCapture() {

    std::unique_lock<std::recursive_mutex> lock(workStatusLock);
    if (workStatus == STATUS_CAPTURING) {

        // 设置停止标记，抓包处理线程和存储线程先行退出
        stopFlag = true;

        // 然后停止tshark进程
        ProcessUtil::Kill(captureTSharkPid);
        ProcessUtil::WaitPid(captureTSharkPid, nullptr, 0);

        // 等待抓包处理线程退出
        captureWorkThread->join();
        captureWorkThread.reset();

        // 等待存储线程退出
        storageThread->join();
        storageThread.reset();

        // 停止监控进程网络活动
        processNetworkMonitor->stopMonitor();

        // 最后把状态重置
        workStatus = STATUS_IDLE;
    }
}


// 抓包工作线程，负责处理tshark输出的数据
void TSharkManager::captureWorkThreadEntry(std::string adapterName) {
    std::cout << "enter captureWorkThreadEntry..." << std::endl;

    currentPcapFilePath = MiscUtil::getPcapNameByCurrentTimestamp();

    std::vector<std::string> tsharkArgs = {
        tsharkPath,
        "-i", adapterName,
        "-w", "\"" + currentPcapFilePath + "\"",      // 默认将采集到的数据包写入到这个文件下
        "-F", "pcap"                                  // 采用旧的pcap文件格式存储
    };

    for (auto item : tsharkFieldsList) {
        tsharkArgs.push_back(item);
    }

    std::string tsharkCmd;
    for (auto arg : tsharkArgs) {
        tsharkCmd += arg;
        tsharkCmd += " ";
    }
    captureTSharkPid = 0;
    FILE *pipe = ProcessUtil::PopenEx(tsharkCmd, &captureTSharkPid);

    LOG_F(INFO, "Capture command: %s", tsharkCmd.c_str());

    // 读取进程输出函数
    // 下面循环退出有3种情况：1、主动停止抓包；2、tshark已退出；3、抓包超过上限
    char buffer[4096] = {0};
    long long packetOffset = 24;
    while (fgets(buffer, sizeof(buffer), pipe) != nullptr && !stopFlag && packetOffset < MAX_PACKET_PROCESS) {

        if (strlen(buffer) > 4090) {
            LOG_F(WARNING, "packet line too long: %s", buffer);
        }
        std::string line(buffer);
        std::shared_ptr<PacketInfo> packetInfo = parsePacket(line);
        if (packetInfo) {

            // 计算数据包在pcap文件中的偏移信息，注意修正数据包相关的位置和编号
            packetInfo->fileOffset = packetOffset;
            packetOffset = packetOffset + packetInfo->capLength + 16;

            processPacket(packetInfo);
        } else if (line.find("Capturing on") != std::string::npos) {
            // 忽略 tshark 抓包输出的第一行，例如：Capturing on 'Wi-Fi: en0'
            continue;
        } else {
            LOG_F(ERROR, "packet parse error: %s", line.c_str());
            break;
        }
        memset(buffer, 0, sizeof(buffer));
    }
    fclose(pipe);

    if (packetOffset >= MAX_PACKET_PROCESS) {
        LOG_F(INFO, "抓包已超过 %ld MB，已停止抓包", MAX_PACKET_PROCESS / 1024 / 1024);
    }

    // 如果不是主动停止的，则需要做一些清理工作
    if (!stopFlag) {
        std::unique_lock<std::recursive_mutex> lock(workStatusLock);
        stopFlag = true;

        // 停止tshark
        ProcessUtil::Kill(captureTSharkPid);
        ProcessUtil::WaitPid(captureTSharkPid, nullptr, 0);

        // 停止存储线程
        storageThread->join();
        storageThread.reset();

        // 停止监控进程网络活动
        processNetworkMonitor->stopMonitor();

        // 最后把状态重置
        workStatus = STATUS_IDLE;
    }

    std::cout << "leave captureWorkThreadEntry..." << std::endl;
}


// 分析离线文件
bool TSharkManager::analysisFile(std::string filePath, std::string filter) {

    std::unique_lock<std::recursive_mutex> lock(workStatusLock);

    // 如果带有过滤器，并且分析的就是当前的文件，就不重置，只清空过滤数据包表格即可
    if (!filter.empty() && filePath == currentPcapFilePath) {
        storage->clearFilterPacketTable();
    } else {
        reset();
    }

    workStatus = STATUS_ANALYSIS_FILE;
    currentFilter = filter;

    // 1、统一转换为标准的pcap格式
    currentPcapFilePath = MiscUtil::getPcapNameByCurrentTimestamp();
    currentFilterPcapFilePath = MiscUtil::getPcapNameByCurrentTimestamp();
    std::string savePcapPath = currentFilter.empty() ? currentPcapFilePath : currentFilterPcapFilePath;
    if (!TSharkUtil::convertToPcap(filePath, savePcapPath)) {
        LOG_F(ERROR, "convert to pcap failed");
        workStatus = STATUS_IDLE;
        return false;
    }

    // 2、检查数据包总数
    int packetCount = TSharkUtil::getPcapPacketCount(savePcapPath);
    if (packetCount == 0) {
        LOG_F(ERROR, "invalid pcap file");
        workStatus = STATUS_IDLE;
        return false;
    }

    // 3、如果数据包数量过多，就需要进行拆分
    if (packetCount > 20000) {
        std::vector<std::string> splitResult;
        TSharkUtil::splitPcapFile(savePcapPath, packetCount, 10000, splitResult);
        for (std::string fileName : splitResult) {
            // 添加到任务队列
            analysisFileTaskQueue.push(fileName);
        }
    } else {
        analysisFileTaskQueue.push(savePcapPath);
    }

    // 4、率先启动存储线程
    storageThread = std::make_shared<std::thread>(&TSharkManager::storageThreadEntry, this);

    // 5、启动多个分析线程，从任务队列中开始取任务分析
    stopFlag = false;
    int threadCount = 4;
    for (int i = 1; i <= threadCount; ++i) {
        
        analysisFileWorkThreads.emplace_back(
            std::make_shared<std::thread>(&TSharkManager::analysisFileWorkThreadEntry, this, i)
        );
    }

    // 6、等待分析线程退出
    for (auto& worker : analysisFileWorkThreads) {
        worker->join();
    }
    analysisFileWorkThreads.clear();

    stopFlag = true;
    workStatus = STATUS_IDLE;
    storageThread->join();
    storageThread = nullptr;

    // 清空任务队列
    clearAnalysisFileQueue();

    // 将本次分析文件加入历史记录
    if (filter.empty()) {
        std::string historyFile = MiscUtil::getDefaultDataDir() + "history.dat";
        std::ofstream ofs(historyFile, std::ios::app);
        if (ofs) {
            ofs << filePath << std::endl;
            ofs.close();
        }
    }

    std::cout << "total packet count: " << packetsMap.size() << std::endl;
    std::cout << "total session count: " << sessionIdMap.size() << std::endl;

    return true;
}


void TSharkManager::analysisFileWorkThreadEntry(int threadNumber) {
    LOG_F(INFO, "[%d]enter TSharkManager::analysisFileWorkThreadEntry", threadNumber);

    while (!stopFlag) {

        // 1、从队列中取出一个文件任务
        std::string filename;
        {
            std::unique_lock<std::mutex> lock(analysisFileTaskQueueLock);
            if (analysisFileTaskQueue.empty()) {
                break;  // 如果队列为空，退出循环并结束线程
            }

            // 获取并处理队列中的任务
            filename = analysisFileTaskQueue.front();
            analysisFileTaskQueue.pop();
        }

        LOG_F(INFO, "[%d]start process: %s", threadNumber, filename.c_str());

        // 2、从文件名中获取相关偏移信息，用于修正数据包信息
        uint32_t frameNumberBase = 0;
        uint32_t frameOffsetBase = 24;
        bool isSplitFile = false;
        if (filename.find("simpletshark_split_") != std::string::npos) {
            if (!TSharkUtil::extractFrameOffsetFromFileName(filename, frameNumberBase, frameOffsetBase)) {
                LOG_F(ERROR, "Failed to extractFrameOffsetFromFileName");
                continue;
            }
            isSplitFile = true;
        }

        // 3、调用tshark 命令，分析文件
        std::vector<std::string> tsharkArgs = {
            tsharkPath,
            "-r", 
            "\"" + filename + "\""
        };

        if (!currentFilter.empty()) {
            tsharkArgs.push_back("-Y");

            // 使用Lambda表达式在过滤器中出现的引号前添加反斜杠
            auto addBackslashBeforeQuotes = [](std::string& s) {
                std::string result;
                for (char c : s) {
                    if (c == '"') {
                        result += '\\';
                    }
                    result += c;
                }
                return result;
            };

            std::string escapedFilter = addBackslashBeforeQuotes(currentFilter);
            tsharkArgs.push_back("\"" + escapedFilter + "\"");

        }

        for (auto item : tsharkFieldsList) {
            tsharkArgs.push_back(item);
        }
        std::string tsharkCmd;
        for (auto arg : tsharkArgs) {
            tsharkCmd += arg;
            tsharkCmd += " ";
        }

        PID_T pidTshark = 0;
        FILE* tsharkPipe = ProcessUtil::PopenEx(tsharkCmd.c_str(), &pidTshark);
        if (!tsharkPipe) {
            LOG_F(ERROR, "Failed to open tshark process");
            continue;
        }

        // 4、读取并处理 tshark 输出
        uint32_t packetOffset = 0;
        char buffer[4096];
        while (fgets(buffer, sizeof(buffer), tsharkPipe) != nullptr && !stopFlag) {
            std::string line(buffer);

            std::shared_ptr<PacketInfo> packetInfo = parsePacket(line);
            if (packetInfo) {
                // 计算数据包在pcap文件中的偏移信息，注意修正数据包相关的位置和编号
                packetInfo->fileOffset = frameOffsetBase + packetOffset;
                packetOffset = packetOffset + packetInfo->capLength + 16;
                packetInfo->frameNumber += frameNumberBase;

                processPacket(packetInfo);
            }
        }
        pclose(tsharkPipe);

        LOG_F(INFO, "[%d]finish process: %s", threadNumber, filename.c_str());
        // 如果是拆分的子文件，分析完成后就删除掉
        if (isSplitFile) {
            remove(filename.c_str());
        }
    }

    LOG_F(INFO, "[%d]leave TSharkManager::analysisFileWorkThreadEntry", threadNumber);
}


void TSharkManager::stopAnalysisFile() {
    std::unique_lock<std::recursive_mutex> lock(workStatusLock);
    if (workStatus == STATUS_ANALYSIS_FILE) {
        stopFlag = true;
    }
}

void TSharkManager::getAnalysisFileHistory(std::vector<std::string>& historyList) {
    std::string historyFile = MiscUtil::getDefaultDataDir() + "history.dat";
    std::ifstream infile(historyFile);
    if (infile) {
        std::string line;
        std::vector<std::string> tempList;
        while (std::getline(infile, line)) {
            historyList.push_back(line);
            tempList.push_back(line);
        }
        infile.close();

        // 只取最近的20个
        if (tempList.size() > 20) {
            historyList.clear();
            historyList.assign(tempList.end() - 20, tempList.end());
        }

        // 最后把顺序调换一下，让最近的在最前面
        std::reverse(historyList.begin(), historyList.end());
    } 
}

// 清空离线分析任务队列
void TSharkManager::clearAnalysisFileQueue() {
    std::unique_lock<std::mutex> lock(analysisFileTaskQueueLock);
    std::queue<std::string> emptyQueue;
    analysisFileTaskQueue.swap(emptyQueue);
}

std::string removeQuotes(const std::string& str) {
    if (str.front() == '"' && str.back() == '"') {
        return str.substr(1, str.size() - 2);
    }
    return str;
}


// 用于解析从tshark输出的每一行并保存到PacketInfo
std::shared_ptr<PacketInfo> TSharkManager::parsePacket(std::string& line) {

    //LOG_F(INFO, "parsePacket: %s", line.c_str());

    if (line.back() == '\n') {
        line.pop_back();
    }
    int tabCount = std::count(line.begin(), line.end(), '\t');
    if (tabCount < 20) {
        return nullptr;
    }

    std::shared_ptr<PacketInfo> packet = std::make_shared<PacketInfo>();
    std::stringstream ss(line);
    std::string field;

    // 解析数据包编号 (frame.number)，并去除引号
    std::getline(ss, field, '\t');
    packet->frameNumber = std::stoi(removeQuotes(field));

    // 解析时间戳 (frame.time_epoch)，并去除引号
    std::getline(ss, field, '\t');
    packet->timestamp = std::stod(removeQuotes(field));

    // 解析源Mac (eth.src)，并去除引号
    std::getline(ss, field, '\t');
    if (!field.empty()) {
        packet->srcMac = removeQuotes(field);
    }
    // 解析目的Mac (eth.dst)，并去除引号
    std::getline(ss, field, '\t');
    if (!field.empty()) {
        packet->dstMac = removeQuotes(field);
    }

    // 解析源IP (ip.src)，并去除引号
    std::getline(ss, field, '\t');
    if (!field.empty()) {
        packet->srcIP = removeQuotes(field);
        packet->srcLocation = IP2RegionUtil::getIpLocation(packet->srcIP);
    }
    // 解析源IP (ipv6.src)，并去除引号
    std::getline(ss, field, '\t');
    if (!field.empty()) {
        packet->srcIP = removeQuotes(field);
        packet->srcLocation = IP2RegionUtil::getIpLocation(packet->srcIP);
    }

    // 解析源端口，并去除引号，可能是TCP，也可能是UDP，哪个不为空就是哪个
    std::string tcpSrcPort, udpSrcPort;
    std::getline(ss, tcpSrcPort, '\t');
    std::getline(ss, udpSrcPort, '\t');
    if (!tcpSrcPort.empty()) {
        std::string srcPort = removeQuotes(tcpSrcPort);
        packet->srcPort = std::stoi(srcPort);
    }
    else if (!udpSrcPort.empty()) {
        std::string srcPort = removeQuotes(udpSrcPort);
        packet->srcPort = std::stoi(srcPort);
    }
    else {
        packet->srcPort = 0;  // 如果都为空
    }

    // 解析目的IP (ip.dst)，并去除引号
    std::getline(ss, field, '\t');
    if (!field.empty()) {
        packet->dstIP = removeQuotes(field);
        packet->dstLocation = IP2RegionUtil::getIpLocation(packet->dstIP);
    }
    // 解析目的IP (ipv6.dst)，并去除引号
    std::getline(ss, field, '\t');
    if (!field.empty()) {
        packet->dstIP = removeQuotes(field);
        packet->dstLocation = IP2RegionUtil::getIpLocation(packet->dstIP);
    }

    // 解析目的端口，并去除引号，可能是TCP，也可能是UDP，哪个不为空就是哪个
    std::string tcpDstPort, udpDstPort;
    std::getline(ss, tcpDstPort, '\t');
    std::getline(ss, udpDstPort, '\t');
    if (!tcpDstPort.empty()) {
        std::string dstPort = removeQuotes(tcpDstPort);
        packet->dstPort = std::stoi(dstPort);
    }
    else if (!udpDstPort.empty()) {
        std::string dstPort = removeQuotes(udpDstPort);
        packet->dstPort = std::stoi(dstPort);
    }
    else {
        packet->dstPort = 0;  // 如果都为空
    }

    // 解析数据流ID，并去除引号，可能是TCP，也可能是UDP，哪个不为空就是哪个
    std::string tcpStreamId, udpStreamId;
    std::getline(ss, tcpStreamId, '\t');
    std::getline(ss, udpStreamId, '\t');
    if (!tcpStreamId.empty()) {
        std::string streamId = removeQuotes(tcpStreamId);
        packet->streamId = std::stoi(streamId);
    }
    else if (!udpStreamId.empty()) {
        std::string streamId = removeQuotes(udpStreamId);
        packet->streamId = std::stoi(streamId);
    }
    else {
        packet->streamId = 0;  // 如果都为空
    }

    // 解析数据包长度 (frame.len)，并去除引号
    std::getline(ss, field, '\t');
    packet->frameLength = std::stoi(removeQuotes(field));

    // 解析数据包实际捕获长度 (frame.cap_len)，并去除引号
    std::getline(ss, field, '\t');
    packet->capLength = std::stoi(removeQuotes(field));

    // 解析传输层协议 (ip.proto)，并去除引号
    std::getline(ss, field, '\t');
    if (!field.empty()) {
        packet->transProtoNumber = std::stoi(removeQuotes(field));
    }

    // 解析传输层协议 (ipv6.nxt)，并去除引号
    std::getline(ss, field, '\t');
    if (!field.empty()) {
        packet->transProtoNumber = std::stoi(removeQuotes(field));
    }

    // 解析协议 (_ws.col.Protocol)，并去除引号
    std::getline(ss, field, '\t');
    packet->protocol = removeQuotes(field);

    // 解析信息 (_ws.col.Info)，并去除引号
    std::getline(ss, field, '\t');
    packet->info = removeQuotes(field);

    // 解析http.host，并去除引号
    std::getline(ss, field, '\t');
    if (!field.empty() && field != "\r") {
        packet->remark = removeQuotes(field);
    }

    // 解析dns.qry.name，并去除引号
    std::getline(ss, field, '\t');
    if (!field.empty() && field != "\r") {
        packet->remark = removeQuotes(field);
    }

    // 解析tls.handshake.extensions_server_name，并去除引号
    std::getline(ss, field, '\t');
    if (!field.empty() && field != "\r") {
        packet->remark = removeQuotes(field);
    }

    return packet;
}

// 将数据包分拣到各自会话中并进行统计
void TSharkManager::processPacket(std::shared_ptr<PacketInfo> packet) {
    if (packet == nullptr)
        return;

    std::unique_lock<std::mutex> lock(storeLock);

    packetsMap.insert(std::make_pair(packet->frameNumber, packet));

    // 加入待存储列表
    packetSetTobeStore.insert(packet);

    // 如果没有IP地址，跳过这个数据包，可能是ARP报文或者链路层其他包
    if (packet->srcIP.empty() || packet->dstIP.empty()) {
        packet->belongSessionId = 0;
        return;
    }

    // 如果IP之上不是TCP和UDP，也跳过这个数据包，不组会话
    if (packet->transProtoNumber != 6 && packet->transProtoNumber != 17) {
        packet->belongSessionId = 0;
        return;
    }

    // 创建五元组
    FiveTuple tuple{packet->srcIP, packet->dstIP, packet->srcPort, packet->dstPort, packet->transProtoNumber};

    // 将数据包加入到相应会话的列表中，并更新统计信息
    std::shared_ptr<SessionInfo> session;
    if (sessionMap.find(tuple) == sessionMap.end()) {
        // 新的会话，初始化会话信息
        session = std::make_shared<SessionInfo>();
        session->sessionId = sessionMap.size() + 1;        // 通过序号来分配ID
        session->streamId = packet->streamId;
        session->ip1 = packet->srcIP;
        session->ip2 = packet->dstIP;
        session->ip1Location = packet->srcLocation;
        session->ip2Location = packet->dstLocation;
        session->ip1Port = packet->srcPort;
        session->ip2Port = packet->dstPort;
        session->startTime = packet->timestamp;
        session->endTime = packet->timestamp;
        session->transProto = packet->transProtoNumber == IPPROTO_TCP ? "TCP" : "UDP";
        if (packet->protocol != "TCP" && packet->protocol != "UDP") {
            session->appProto = packet->protocol;
        }

        session->processInfo = processNetworkMonitor->findProcessInfoByFiveTuple(tuple);
        if (session->processInfo) {
            processList.insert(session->processInfo);
        }
        
        sessionMap.insert(std::make_pair(tuple, session));
        sessionIdMap.insert(std::make_pair(session->sessionId, session));
    } else {
        // 旧的会话，更新会话信息
        session = sessionMap[tuple];

        // 由于文件被拆分子文件分析，数据包的顺序可能被打乱，需要妥善处理会话的起始时间以及方向
        if (packet->timestamp < session->startTime) {
            // 会话的方向以时间最早的的第一个包为准
            session->startTime = packet->timestamp;
            session->ip1 = packet->srcIP;
            session->ip2 = packet->dstIP;
            session->ip1Location = packet->srcLocation;
            session->ip2Location = packet->dstLocation;
            session->ip1Port = packet->srcPort;
            session->ip2Port = packet->dstPort;
        }
        if (packet->timestamp > session->endTime) {
            session->endTime = packet->timestamp;
        }
        
        if (packet->protocol != "TCP" && packet->protocol != "UDP") {
            session->appProto = packet->protocol;
        }

        if (!session->processInfo) {
            session->processInfo = processNetworkMonitor->findProcessInfoByFiveTuple(tuple);
            if (session->processInfo) {
                processList.insert(session->processInfo);
            }
        }
    }

    // 共同的字段更新
    {
        if (!packet->remark.empty()) {
            session->remark = packet->remark;
        }
        session->packetCount++;
        session->totalBytes += packet->frameLength;
        packet->belongSessionId = session->sessionId;
    }

    // 统计双方的交互数据
    if (session->ip1 == packet->srcIP) {
        session->ip1SendPacketsCount++;
        session->ip1SendBytesCount += packet->frameLength;
    } else {
        session->ip2SendPacketsCount++;
        session->ip2SendBytesCount += packet->frameLength;
    }
    // 加入待存储列表
    sessionSetTobeStore.insert(session);
}


// 负责存储数据包和会话信息的存储线程函数
void TSharkManager::storageThreadEntry() {

    auto storageWork = [this]() {
        storeLock.lock();

        // 检查数据包列表是否有新的数据可供存储
        if (!packetSetTobeStore.empty()) {
            storage->storePackets(packetSetTobeStore, !currentFilter.empty());
            packetSetTobeStore.clear();
        }

        // 检查会话列表是否有新的数据可供存储
        if (!sessionSetTobeStore.empty()) {
            storage->storeAndUpdateSessions(sessionSetTobeStore);
            sessionSetTobeStore.clear();
        }
        storeLock.unlock();
    };

    // 只要停止标记没有点亮，存储线程就要一直存在
    while (!stopFlag) {
        storageWork();
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }

    // 稍等一下最后再执行一次，防止有遗漏的数据未入库
    std::this_thread::sleep_for(std::chrono::seconds(1));
    storageWork();
}

// 打印会话中的数据包信息和统计信息
void TSharkManager::printAllSessions() {
    for (const auto& sessionEntry : sessionMap) {
        const FiveTuple& tuple = sessionEntry.first;
        const std::shared_ptr<SessionInfo> session = sessionEntry.second;
        std::cout << "Session (" << tuple.srcIP << ":" << tuple.srcPort << " -> "
            << tuple.dstIP << ":" << tuple.dstPort << ")" << std::endl;
        std::cout << "  IP1: " << session->ip1 << std::endl;
        std::cout << "  IP2: " << session->ip2 << std::endl;
        std::cout << "  IP1Location: " << session->ip1Location << std::endl;
        std::cout << "  IP2Location: " << session->ip2Location << std::endl;
        std::cout << "  IP1Port: " << session->ip1Port << std::endl;
        std::cout << "  IP2PPort: " << session->ip2Port << std::endl;
        std::cout << "  StartTime: " << std::fixed << std::setprecision(6) << session->startTime << std::endl;
        std::cout << "  EndTime: " << std::fixed << std::setprecision(6) << session->endTime << std::endl;
        std::cout << "  Duration: " << std::fixed << std::setprecision(6) << session->endTime - session->startTime << std::endl;
        std::cout << "  TransProto: " << session->transProto << std::endl;
        std::cout << "  AppProto: " << session->appProto << std::endl;
        std::cout << "  Packet Count: " << session->packetCount << std::endl;
        std::cout << "  Total Bytes: " << session->totalBytes << std::endl;
        // for (auto& packet : session->packets) {
        //     printPacketInfo(packet);
        // }
        std::cout << std::endl;
    }
}

// 查询数据包总数和列表数据
CountInfo TSharkManager::getPacketCountInfo(QueryCondition &condition) {
    return storage->queryPacketCountInfo(condition);
}

// 查询数据包列表数据和总数
bool TSharkManager::getPacketList(QueryCondition &condition, std::vector<PacketInfo>& packetList, int &total) {

    std::unique_lock<std::recursive_mutex> lock(workStatusLock);
    
    // 如果发现有过滤表达式，则需要重新分析文件
    if (!condition.filter.empty()) {
        if (workStatus != STATUS_IDLE) {
            return false;
        } else {
            analysisFile(currentPcapFilePath, condition.filter);
            return storage->queryPackets(condition, packetList, total);
        }
    } else {
        return storage->queryPackets(condition, packetList, total);
    }
}

// 查询会话列表数据和总数
bool TSharkManager::getSessionList(QueryCondition &condition, std::vector<SessionInfo>& sessionList, int &total) {
    bool result = storage->querySessions(condition, sessionList, total);

    // 查找会话的进程信息
    for (auto& session : sessionList) {
        FiveTuple tuple = {session.ip1, session.ip2, session.ip1Port, session.ip2Port, session.transProto == "TCP" ? IPPROTO_TCP : IPPROTO_UDP};
        session.processInfo = processNetworkMonitor->findProcessInfoByFiveTuple(tuple);
    }

    return result;
}


// 获取指定数据包内容，以十六进制形式
bool TSharkManager::getPacketHexData(uint32_t frameNumber, std::string& data) {
    if (packetsMap.find(frameNumber) == packetsMap.end()) {
        return false;
    }
    std::shared_ptr<PacketInfo> packetInfo = packetsMap.at(frameNumber);
    std::string rawData;
    if (MiscUtil::readFile(currentPcapFilePath, packetInfo->fileOffset + 16, packetInfo->capLength, rawData)) {
        // 将原始数据转换为16进制格式
        std::ostringstream oss;
        oss << std::hex << std::setfill('0');
        for (unsigned char ch : rawData) {
            oss << std::setw(2) << static_cast<int>(ch);
        }
        data = oss.str();
        return true;
    }
    return false;
}


// 获取指定数据包的详情内容
bool TSharkManager::getPacketDetailInfo(uint32_t frameNumber, rapidjson::Document& detailJson) {

    // 先通过editcap将这一帧数据包从文件中摘出来，然后再获取详情，这样会快一些
    std::string tmpFilePath = MiscUtil::getDefaultDataDir() + MiscUtil::getRandomString(10) + ".pcap";
    std::string splitCmd = editcapPath + " -r \"" + currentPcapFilePath + "\" \"" + tmpFilePath + "\" " + std::to_string(frameNumber) + "-" + std::to_string(frameNumber);
    if (!ProcessUtil::Exec(splitCmd)) {
        LOG_F(ERROR, "Error in executing command: %s", splitCmd.c_str());
        remove(tmpFilePath.c_str());
        return false;
    }

    // 通过tshark获取指定数据包详细信息，输出格式为XML
    std::string result;

    // 启动'tshark -r currentPcapFilePath -Y "frame.number == frameNumber" -T pdml'命令，获取指定数据包的详情
    //std::string cmd = tsharkPath + " -r " + currentPcapFilePath + " -Y \"frame.number == " + std::to_string(frameNumber) + "\" -T pdml";
    std::string cmd = tsharkPath + " -r \"" + tmpFilePath + "\" -T pdml";
    std::unique_ptr<FILE, decltype(&fclose)> pipe(ProcessUtil::PopenEx(cmd.c_str()), fclose);
    if (!pipe) {
        LOG_F(ERROR, "Error in executing command: %s", cmd.c_str());
        remove(tmpFilePath.c_str());
        return false;
    }

    // 读取tshark输出
    char buffer[8192] = { 0 };
    setvbuf(pipe.get(), NULL, _IOFBF, sizeof(buffer));
    int count = 0;
    while (fgets(buffer, sizeof(buffer) - 1, pipe.get()) != nullptr) {
        result += buffer;
        memset(buffer, 0, sizeof(buffer));
    }

    remove(tmpFilePath.c_str());

    // 将xml内容转换为JSON
    bool bRet = MiscUtil::xml2JSON(result, detailJson);

    // 将原始十六进制数据插入进去
    if (bRet && detailJson.HasMember("pdml") && detailJson["pdml"].HasMember("packet")) {
        std::string packetHex;
        getPacketHexData(frameNumber, packetHex);

        detailJson["pdml"]["packet"][0].AddMember(
            "hexdata",
            rapidjson::Value().SetString(packetHex.c_str(), detailJson.GetAllocator()),
            detailJson.GetAllocator()
        );

        rapidjson::Value& array = detailJson["pdml"]["packet"][0]["proto"];
        if (!array.Empty()) {
            // 把基本信息和Frame信息两项去掉
            array.Erase(array.Begin());
            array.Erase(array.Begin());
        }

        // 去掉外层的键值
        rapidjson::Value temp;
        temp.CopyFrom(detailJson["pdml"]["packet"][0], detailJson.GetAllocator());
        detailJson.SetObject();
        detailJson.CopyFrom(temp, detailJson.GetAllocator());

        return true;
    }

    return false;
}


// 获取会话数据流
DataStreamCountInfo TSharkManager::getSessionDataStream(uint32_t sessionId, std::vector<DataStreamItem>& dataStreamList) {

    DataStreamCountInfo countInfo;
    if (sessionIdMap.find(sessionId) == sessionIdMap.end()) {
        LOG_F(ERROR, "session %d not found", sessionId);
        return countInfo;
    }

    std::shared_ptr<SessionInfo> session = sessionIdMap[sessionId];
    std::string transProto = session->transProto;
    std::transform(transProto.begin(), transProto.end(), transProto.begin(), ::tolower);

    // 四元组
    std::string fourTuple;
    if (session->ip1.find(":") != std::string::npos) {
        // IPv6的格式需要增加[]包起来
        fourTuple = "[" + session->ip1 + "]:" + std::to_string(session->ip1Port) + ",[" + session->ip2 + "]:" + std::to_string(session->ip2Port);
    }
    else {
        fourTuple = session->ip1 + ":" + std::to_string(session->ip1Port) + "," + session->ip2 + ":" + std::to_string(session->ip2Port);
    }

    // 准备tshark命令
    std::string tsharkCmd = tsharkPath + " -r \"" + currentPcapFilePath + "\" -q -z follow," + transProto + ",raw," + fourTuple;
    std::unique_ptr<FILE, decltype(&fclose)> pipe(ProcessUtil::PopenEx(tsharkCmd.c_str()), fclose);
    if (!pipe) {
        throw std::runtime_error("Failed to run tshark command.");
    }

    uint32_t maxItems = 500;
    // 逐行读取tshark输出
    std::vector<char> buffer(65535); // 应对巨型帧Jumbo Frame的情况
    bool dataStart = false;
    while (fgets(buffer.data(), buffer.size(), pipe.get()) != nullptr) {

        std::string line(buffer.data());
        DataStreamItem item;

        MiscUtil::trimEnd(line);
        if (line.find("Node 0: ") == 0) {
            countInfo.node0 = line.substr(strlen("Node 0: "));
            continue;
        }
        if (line.find("Node 1: ") == 0) {
            countInfo.node1 = line.substr(strlen("Node 1: "));
            dataStart = true;
            continue;
        }

        if (!dataStart || line.find("=====") != std::string::npos) {
            continue;
        }

        if (line[0] == '\t') {
            item.hexData = line.substr(1);
            item.srcNode = countInfo.node1;
            item.dstNode = countInfo.node0;
            countInfo.node1PacketCount++;
            countInfo.node1BytesCount += (item.hexData.length() / 2);
        }
        else {
            item.hexData = line;
            item.srcNode = countInfo.node0;
            item.dstNode = countInfo.node1;
            countInfo.node0PacketCount++;
            countInfo.node0BytesCount += (item.hexData.length() / 2);
        }

        countInfo.totalPacketCount++;
        if (dataStreamList.size() < maxItems) {
            dataStreamList.push_back(item);
        }
    }

    return countInfo;
}


// 查询IP通信统计列表数据
bool TSharkManager::getIPStatsList(QueryCondition &condition, std::vector<IPStatsInfo> &ipStatsList, int &total) {
    return storage->queryIPStats(condition, ipStatsList, total);
}

// 查询协议统计列表数据
bool TSharkManager::getProtoStatsList(QueryCondition &condition, std::vector<ProtoStatsInfo> &protoStatsList, int &total) {
    return storage->queryProtoStats(condition, protoStatsList, total);
}

// 查询国家统计列表数据
bool TSharkManager::getCountryStatsList(QueryCondition& condition, std::vector<CountryStatsInfo>& countryStatsList, int& total) {
    return storage->queryCountryStats(condition, countryStatsList, total);
}

// 保存当前数据包
bool TSharkManager::savePacket(std::string savePath) {
    //std::string targetFile = savePath + "/" + MiscUtil::getPcapNameByCurrentTimestamp(false);
    return MiscUtil::copyFile(currentPcapFilePath, savePath);
}

// 另存筛选结果数据包
bool TSharkManager::saveFilterPacket(std::string savePath, std::string filter) {
    //std::string targetFile = savePath + "/" + MiscUtil::getPcapNameByCurrentTimestamp(false);
    std::string cmd = tsharkPath + " -r \"" + currentPcapFilePath + "\" -Y " + filter + " -w" + savePath;
    if (!ProcessUtil::Exec(cmd)) {
        LOG_F(ERROR, "Error in executing command: %s", cmd.c_str());
        return false;
    }
    return true;
}

void TSharkManager::printPacketInfo(std::shared_ptr<PacketInfo> packet) {
    std::time_t time = static_cast<std::time_t>(packet->timestamp);
    double fractional = packet->timestamp - std::floor(packet->timestamp);

    char buffer[26];

#ifdef WIN32
    // 使用localtime_s代替localtime
    std::tm tm_info;
    localtime_s(&tm_info, &time);
    std::strftime(buffer, 26, "%Y-%m-%d %H:%M:%S", &tm_info);
#else
    std::tm *tm_info = std::localtime(&time);
    std::strftime(buffer, 26, "%Y-%m-%d %H:%M:%S", tm_info);
#endif

    std::cout << std::setw(6) << std::setfill(' ') << packet->frameNumber
        << " | Time: " << buffer << "." << std::setw(6) << std::setfill('0') << int(fractional * 1e6)
        << " | BelongSessionId: " << packet->belongSessionId
        << " | Offset: " << packet->fileOffset
        << " | SrcMac: " << packet->srcMac
        << " | DstMac: " << packet->dstMac
        << " | SrcIP: " << packet->srcIP
        << " | SrcLocation: " << packet->srcLocation
        << " | DstIP: " << packet->dstIP
        << " | DstLocation: " << packet->dstLocation
        << " | SrcPort: " << packet->srcPort
        << " | DstPort: " << packet->dstPort
        << " | Frame Length: " << packet->frameLength
        << " | Capture Length: " << packet->capLength
        << " | Protocol: " << packet->protocol
        << " | Info: " << packet->info << "\n";
}

// 开始监控所有网卡流量统计数据
void TSharkManager::startMonitorAdaptersFlowTrend() {

    std::unique_lock<std::recursive_mutex> lock(adapterFlowTrendDataLock);

    clearFlowTrendData();
    adapterFlowTrendMonitorStartTime = time(nullptr);
    adapterFlowTrendMonitorStopFlag = false;

    // 启动单一的监控线程，负责所有网卡
    adapterFlowTrendMonitorThread = std::make_shared<std::thread>(&TSharkManager::adapterFlowTrendMonitorThreadEntry, this);
    if (adapterFlowTrendMonitorThread == nullptr) {
        LOG_F(ERROR, "网卡流量监控线程创建失败");
    } else {
        LOG_F(INFO, "网卡流量监控线程创建成功");
    }

    workStatus = STATUS_MONITORING;
}

// 停止监控所有网卡流量统计数据
void TSharkManager::stopMonitorAdaptersFlowTrend() {

    std::unique_lock<std::recursive_mutex> lock(adapterFlowTrendDataLock);

    // 设置停止标记
    adapterFlowTrendMonitorStopFlag = true;

    // 等待监控线程退出
    if (adapterFlowTrendMonitorThread && adapterFlowTrendMonitorThread->joinable()) {
        lock.unlock();  // 解锁以便线程可以退出
        adapterFlowTrendMonitorThread->join();
        lock.lock();
        adapterFlowTrendMonitorThread.reset();
        LOG_F(INFO, "网卡流量监控已停止");
    }

    workStatus = STATUS_IDLE;
}

void TSharkManager::clearFlowTrendData() {

    std::unique_lock<std::recursive_mutex> lock(adapterFlowTrendDataLock);
    adapterFlowTrendDataMap.clear();
}


// 获取所有网卡流量统计数据
void TSharkManager::getAdaptersFlowTrendData(std::map<std::string, std::map<long, long>>& flowTrendData) {

    long timeNow = time(nullptr);

    // 数据从最左边冒出来
    // 一开始：以最开始监控时间为左起点，终点为未来300秒
    // 随着时间推移，数据逐渐填充完这300秒
    // 超过300秒之后，结束节点就是当前，开始节点就是当前-300
    long startWindow = timeNow - adapterFlowTrendMonitorStartTime > 300 ? timeNow - 300 : adapterFlowTrendMonitorStartTime;
    long endWindow = timeNow - adapterFlowTrendMonitorStartTime > 300 ? timeNow : adapterFlowTrendMonitorStartTime + 300;

    std::unique_lock<std::recursive_mutex> lock(adapterFlowTrendDataLock);

    for (const auto& adapterPair : adapterFlowTrendDataMap) {
        flowTrendData.insert(std::make_pair<>(adapterPair.first, std::map<long, long>()));

        // 从当前时间戳向前倒推300秒，构造map
        for (long t = startWindow; t <= endWindow; t++) {
            // 如果flowTrendData中存在该时间戳，则使用已有数据；否则填充为0
            if (adapterPair.second.find(t) != adapterPair.second.end()) {
                flowTrendData[adapterPair.first][t] = adapterPair.second.at(t);
            } else {
                flowTrendData[adapterPair.first][t] = 0;
            }
        }
    }
}

// 监控所有网卡流量趋势的线程入口函数
void TSharkManager::adapterFlowTrendMonitorThreadEntry() {
    ProcessUtil::SetCurrentThreadName("flow_trend_monitor_thread");

    LOG_F(INFO, "网卡流量监控线程启动");

#ifdef _WIN32
    // Windows 平台：启动回环网卡监控
    loopbackMonitor = std::make_unique<LoopbackMonitor>();
    if (!loopbackMonitor->start()) {
        LOG_F(WARNING, "回环网卡监控启动失败");
        loopbackMonitor.reset();
    } else {
        LOG_F(INFO, "回环网卡监控启动成功");
    }

    // 记录回环网卡的上一次累积流量
    unsigned long long loopbackLastTotal = 0;
#endif

    // 获取初始快照（不含回环网卡）
    std::map<std::string, NetworkCounters> beforeSnapshot = NetworkStatsUtil::getSnapshot();

    while (!adapterFlowTrendMonitorStopFlag) {
        // 获取当前快照（不含回环网卡）
        std::map<std::string, NetworkCounters> afterSnapshot = NetworkStatsUtil::getSnapshot();

        // 计算流量差值（字节/秒）
        std::map<std::string, NetworkCounters> delta = NetworkStatsUtil::calculateDelta(beforeSnapshot, afterSnapshot, 1);

#ifdef _WIN32
        // Windows 平台：单独处理回环网卡流量
        if (loopbackMonitor) {
            unsigned long long loopbackCurrentTotal = loopbackMonitor->getTotalBytes();
            unsigned long long loopbackDelta = loopbackCurrentTotal - loopbackLastTotal;

            // 将回环网卡流量添加到 delta 中
            NetworkCounters loopbackCounters;
            loopbackCounters.ibytes = loopbackDelta / 2;  // 简化处理：假设收发各占一半
            loopbackCounters.obytes = loopbackDelta / 2;
            delta["Adapter for loopback traffic capture"] = loopbackCounters;

            // 更新上一次的累积值
            loopbackLastTotal = loopbackCurrentTotal;
        }
#endif

        // 获取当前时间戳
        long currentTimestamp = time(nullptr);

        // 更新流量趋势数据
        {
            std::unique_lock<std::recursive_mutex> lock(adapterFlowTrendDataLock);

            for (const auto& pair : delta) {
                const std::string& adapterName = pair.first;
                const NetworkCounters& counters = pair.second;

                // 总流量 = 接收 + 发送
                long totalBytes = counters.ibytes + counters.obytes;

                // 保存到趋势数据中
                adapterFlowTrendDataMap[adapterName][currentTimestamp] = totalBytes;

                // 保持最近300秒的数据
                auto& adapterData = adapterFlowTrendDataMap[adapterName];
                while (adapterData.size() > 300) {
                    adapterData.erase(adapterData.begin());
                }
            }
        }

        // 更新快照用于下次计算
        beforeSnapshot = afterSnapshot;

        // 等待1秒后进行下一次采样
        std::this_thread::sleep_for(std::chrono::seconds(1));
    }

#ifdef _WIN32
    // 停止回环网卡监控
    if (loopbackMonitor) {
        loopbackMonitor->stop();
        loopbackMonitor.reset();
        LOG_F(INFO, "回环网卡监控已停止");
    }
#endif

    LOG_F(INFO, "网卡流量监控线程退出");
}

std::list<AdapterInfo> TSharkManager::getNetworkAdapters() {
    // 需要过滤掉的虚拟网卡
    std::set<std::string> specialInterfaces = {"sshdump", "ciscodump", "udpdump", "randpkt"};
    std::list<AdapterInfo> interfaces;
    std::array<char, 256> buffer;
    std::string result;

    // 启动tshark -D命令
    std::string cmd = tsharkPath + " -D";
    std::unique_ptr<FILE, decltype(&pclose)> pipe(ProcessUtil::PopenEx(cmd.c_str()), pclose);
    if (!pipe) {
        throw std::runtime_error("Failed to run tshark command.");
    }

    // 读取tshark输出
    while (fgets(buffer.data(), buffer.size(), pipe.get()) != nullptr) {
        result += buffer.data();
    }

    // 解析tshark的输出，输出格式为：
    // 1. \Device\NPF_{xxxxxx} (网卡描述)
    std::istringstream stream(result);
    std::string line;
    int index = 1;
    while (std::getline(stream, line)) {
        int startPos = line.find(' ');
        if (startPos != std::string::npos) {
            int endPos = line.find(' ', startPos + 1);
            std::string interfaceName;
            if (endPos != std::string::npos) {
                interfaceName = line.substr(startPos + 1, endPos - startPos - 1);
            } else {
                interfaceName = line.substr(startPos + 1);
            }

            // 滤掉特殊网卡
            if (specialInterfaces.find(interfaceName) != specialInterfaces.end()) {
                continue;
            }

            AdapterInfo adapterInfo;
            adapterInfo.name = interfaceName;
            adapterInfo.id = index++;
            if (line.find("(") != std::string::npos && line.find(")") != std::string::npos) {
                adapterInfo.remark = line.substr(line.find("(") + 1, line.find(")") - line.find("(") - 1);
            }

#ifdef _WIN32
            // 在Windows平台上，name是设备名，如果有备注名称，就使用备注名称
            if (!adapterInfo.remark.empty()) {
                adapterInfo.name = adapterInfo.remark;
            }
#endif
            interfaces.push_back(adapterInfo);
        }
    }

    return interfaces;
}


void TSharkManager::getProcessList(std::set<std::shared_ptr<ProcessInfo>>& processList) {
    processList = this->processList;
}