#ifdef __linux__

#include <iostream>
#include <thread>
#include <mutex>
#include <atomic>
#include <chrono>
#include <regex>
#include <sstream>
#include <vector>
#include <fstream>
#include <cstdio>
#include <dirent.h>
#include <unistd.h>
#include <arpa/inet.h>
#include <algorithm>

#include "process_util.hpp"
#include "process_network_monitor.h"
#include "third_library/loguru/loguru.hpp"

std::string getProcessIconBase64(pid_t pid);

class ProcessNetworkMonitorLinux : public ProcessNetworkMonitor {
public:
    virtual void startMonitor() {
        if (monitoring) return;
        monitoring = true;
        monitorThread = std::thread(&ProcessNetworkMonitorLinux::monitorLoop, this);
    }

    virtual void stopMonitor() {
        monitoring = false;
        if (monitorThread.joinable()) {
            monitorThread.join();
        }
    }

    virtual ~ProcessNetworkMonitorLinux() {
        stopMonitor();
    }

    virtual void reset() {
        // 先停止监控线程，不要在持有锁的情况下join
        monitoring = false;
        if (monitorThread.joinable()) {
            monitorThread.join();
        }

        // 然后清理数据
        {
            std::lock_guard<std::mutex> lock(sessionMapLock);
            sessionMap.clear();
            processInfoCache.clear();
        }

        {
            std::lock_guard<std::mutex> inodeLock(inodeCacheLock);
            inodeToProcessCache.clear();
        }
    }

    // 根据五元组查找进程信息
    virtual std::shared_ptr<ProcessInfo> findProcessInfoByFiveTuple(FiveTuple &fiveTuple) {
        std::lock_guard<std::mutex> lock(sessionMapLock);
        if (sessionMap.find(fiveTuple) != sessionMap.end()) {
            return sessionMap[fiveTuple];
        }
        else {
            return nullptr;
        }
    }

    void printAllSession() {
        std::lock_guard<std::mutex> lock(sessionMapLock);
        for (auto& pair : sessionMap) {
            printf("[%s][%s-%d]%s:%d -> %s:%d (%s)\n",
                   pair.first.transProtoNumber == 6 ? "TCP" : "UDP",
                   pair.second->processName.c_str(),
                   pair.second->processId,
                   pair.first.srcIP.c_str(),
                   pair.first.srcPort,
                   pair.first.dstIP.c_str(),
                   pair.first.dstPort,
                   pair.second->processFullPath.c_str());
        }
    }

private:
    void monitorLoop() {
        LOG_F(INFO, "Linux进程网络监控线程启动");
        while (monitoring) {
            try {
                // 先构建inode到进程的映射（提高效率）
                buildInodeToProcessMap();

                // 扫描TCP连接
                scanTcpConnections();
                // 扫描UDP连接
                scanUdpConnections();
            } catch (const std::exception& e) {
                LOG_F(ERROR, "监控循环异常: %s", e.what());
            }

            std::this_thread::sleep_for(std::chrono::seconds(1));
        }
        LOG_F(INFO, "Linux进程网络监控线程退出");
    }

    // 构建inode到进程ID的映射（批量处理，提高效率）
    void buildInodeToProcessMap() {
        std::unordered_map<unsigned long, pid_t> newCache;

        DIR* procDir = opendir("/proc");
        if (!procDir) {
            LOG_F(ERROR, "无法打开/proc目录");
            return;
        }

        struct dirent* entry;
        while ((entry = readdir(procDir)) != nullptr) {
            // 只处理数字目录（进程ID）
            if (entry->d_type != DT_DIR) {
                continue;
            }

            // 检查是否为数字
            std::string pidStr = entry->d_name;
            if (pidStr.empty() || !std::all_of(pidStr.begin(), pidStr.end(), ::isdigit)) {
                continue;
            }

            pid_t pid = std::stoi(pidStr);
            std::string fdPath = "/proc/" + pidStr + "/fd";

            DIR* fdDir = opendir(fdPath.c_str());
            if (!fdDir) {
                continue;
            }

            struct dirent* fdEntry;
            while ((fdEntry = readdir(fdDir)) != nullptr) {
                std::string linkPath = fdPath + "/" + fdEntry->d_name;
                char linkTarget[256];
                ssize_t len = readlink(linkPath.c_str(), linkTarget, sizeof(linkTarget) - 1);
                if (len > 0) {
                    linkTarget[len] = '\0';
                    std::string target(linkTarget);

                    // 检查是否为socket链接，格式: socket:[inode]
                    if (target.find("socket:[") == 0) {
                        size_t start = target.find('[');
                        size_t end = target.find(']');
                        if (start != std::string::npos && end != std::string::npos) {
                            std::string inodeStr = target.substr(start + 1, end - start - 1);
                            try {
                                unsigned long inode = std::stoul(inodeStr);
                                newCache[inode] = pid;
                            } catch (...) {
                                // 忽略解析错误
                            }
                        }
                    }
                }
            }
            closedir(fdDir);
        }
        closedir(procDir);

        // 更新缓存
        {
            std::lock_guard<std::mutex> lock(inodeCacheLock);
            inodeToProcessCache = std::move(newCache);
        }
    }

    // 扫描TCP连接
    void scanTcpConnections() {
        scanConnections("/proc/net/tcp", IPPROTO_TCP, false);
        scanConnections("/proc/net/tcp6", IPPROTO_TCP, true);
    }

    // 扫描UDP连接
    void scanUdpConnections() {
        scanConnections("/proc/net/udp", IPPROTO_UDP, false);
        scanConnections("/proc/net/udp6", IPPROTO_UDP, true);
    }

    // 扫描连接（通用函数）
    void scanConnections(const std::string& procFile, int protocol, bool isIPv6) {
        std::ifstream file(procFile);
        if (!file.is_open()) {
            return;
        }

        std::string line;
        // 跳过标题行
        std::getline(file, line);

        while (std::getline(file, line)) {
            ConnectionEntry entry;
            if (parseProcNetLine(line, entry, isIPv6)) {
                // 查找使用该socket的进程
                pid_t pid = findProcessByInode(entry.inode);
                if (pid > 0) {
                    FiveTuple fiveTuple{
                        entry.localIP,
                        entry.remoteIP,
                        entry.localPort,
                        entry.remotePort,
                        protocol
                    };

                    // 只记录已建立连接或有远程地址的连接
                    if (entry.remoteIP != "0.0.0.0" && entry.remoteIP != "::" &&
                        entry.remotePort != 0) {
                        insertSession(fiveTuple, pid);
                    }
                }
            }
        }
        file.close();
    }

    // 连接条目结构
    struct ConnectionEntry {
        std::string localIP;
        uint16_t localPort;
        std::string remoteIP;
        uint16_t remotePort;
        unsigned long inode;
    };

    // 解析 /proc/net/tcp 或 /proc/net/udp 的一行
    bool parseProcNetLine(const std::string& line, ConnectionEntry& entry, bool isIPv6) {
        std::istringstream iss(line);
        std::string sl, local_address, rem_address, st;
        unsigned long inode;

        // 格式: sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
        if (!(iss >> sl >> local_address >> rem_address >> st)) {
            return false;
        }

        // 跳过中间几个字段，直接跳到inode
        std::string temp;
        for (int i = 0; i < 7; i++) {
            if (!(iss >> temp)) {
                return false;
            }
        }
        if (!(iss >> inode)) {
            return false;
        }

        entry.inode = inode;

        // 解析本地地址和端口
        if (!parseAddress(local_address, entry.localIP, entry.localPort, isIPv6)) {
            return false;
        }

        // 解析远程地址和端口
        if (!parseAddress(rem_address, entry.remoteIP, entry.remotePort, isIPv6)) {
            return false;
        }

        return true;
    }

    // 解析地址字符串 (格式: XXXXXXXX:XXXX 或 IPv6格式)
    bool parseAddress(const std::string& addr, std::string& ip, uint16_t& port, bool isIPv6) {
        size_t colonPos = addr.find(':');
        if (colonPos == std::string::npos) {
            return false;
        }

        std::string ipHex = addr.substr(0, colonPos);
        std::string portHex = addr.substr(colonPos + 1);

        // 解析端口
        try {
            port = static_cast<uint16_t>(std::stoul(portHex, nullptr, 16));
        } catch (...) {
            return false;
        }

        // 解析IP地址
        if (isIPv6) {
            ip = hexToIPv6(ipHex);
        } else {
            ip = hexToIPv4(ipHex);
        }

        return true;
    }

    // 将十六进制字符串转换为IPv4地址
    std::string hexToIPv4(const std::string& hexStr) {
        if (hexStr.length() != 8) {
            return "0.0.0.0";
        }

        try {
            unsigned long hexValue = std::stoul(hexStr, nullptr, 16);
            struct in_addr addr;
            addr.s_addr = hexValue;

            char ipStr[INET_ADDRSTRLEN];
            if (inet_ntop(AF_INET, &addr, ipStr, INET_ADDRSTRLEN)) {
                return std::string(ipStr);
            }
        } catch (...) {
            // 解析失败
        }

        return "0.0.0.0";
    }

    // 将十六进制字符串转换为IPv6地址
    // /proc/net/tcp6 格式: 每4个字节为一组，小端序存储
    std::string hexToIPv6(const std::string& hexStr) {
        if (hexStr.length() != 32) {
            return "::";
        }

        try {
            struct in6_addr addr;
            // /proc/net/tcp6中的格式是4字节为单位的小端序
            for (int i = 0; i < 4; i++) {
                // 每组4字节（8个十六进制字符）
                std::string group = hexStr.substr(i * 8, 8);
                unsigned long value = std::stoul(group, nullptr, 16);

                // 转换为网络字节序
                addr.s6_addr[i * 4 + 0] = (value >> 0) & 0xFF;
                addr.s6_addr[i * 4 + 1] = (value >> 8) & 0xFF;
                addr.s6_addr[i * 4 + 2] = (value >> 16) & 0xFF;
                addr.s6_addr[i * 4 + 3] = (value >> 24) & 0xFF;
            }

            char ipStr[INET6_ADDRSTRLEN];
            if (inet_ntop(AF_INET6, &addr, ipStr, INET6_ADDRSTRLEN)) {
                return std::string(ipStr);
            }
        } catch (...) {
            // 解析失败
        }

        return "::";
    }

    // 根据inode查找对应的进程ID（使用缓存）
    pid_t findProcessByInode(unsigned long inode) {
        std::lock_guard<std::mutex> lock(inodeCacheLock);
        auto it = inodeToProcessCache.find(inode);
        if (it != inodeToProcessCache.end()) {
            return it->second;
        }
        return -1;
    }

    void insertSession(FiveTuple& fiveTuple, uint32_t pid) {
        std::lock_guard<std::mutex> lock(sessionMapLock);

        // 如果已经存在，并且pid没有变化，则无需更新
        if (sessionMap.find(fiveTuple) != sessionMap.end() && sessionMap[fiveTuple]->processId == pid) {
            return;
        }

        // 对进程信息做缓存处理
        if (processInfoCache.find(pid) != processInfoCache.end()) {
            sessionMap[fiveTuple] = processInfoCache[pid];
        }
        else {
            std::shared_ptr<ProcessInfo> processInfo = std::make_shared<ProcessInfo>();
            processInfo->processId = pid;

            // 获取父进程ID
            processInfo->parentProcessId = getParentPid(pid);

            // 获取进程名称和路径
            processInfo->processFullPath = ProcessUtil::GetProcessPath(pid);
            if (!processInfo->processFullPath.empty() && processInfo->processFullPath != "Unknown") {
                size_t pos = processInfo->processFullPath.find_last_of('/');
                if (pos != std::string::npos) {
                    processInfo->processName = processInfo->processFullPath.substr(pos + 1);
                } else {
                    processInfo->processName = processInfo->processFullPath;
                }
            } else {
                // 尝试从/proc/[pid]/comm读取进程名
                std::ifstream commFile("/proc/" + std::to_string(pid) + "/comm");
                if (commFile.is_open()) {
                    std::getline(commFile, processInfo->processName);
                    // 移除尾部的换行符
                    if (!processInfo->processName.empty() && processInfo->processName.back() == '\n') {
                        processInfo->processName.pop_back();
                    }
                    commFile.close();
                }
            }

            processInfo->processIcoDataBase64 = getProcessIconBase64((PID_T)pid);
            sessionMap[fiveTuple] = processInfo;
            processInfoCache[pid] = processInfo;
        }
    }

    // 获取父进程ID
    pid_t getParentPid(pid_t pid) {
        std::ifstream statFile("/proc/" + std::to_string(pid) + "/stat");
        if (!statFile.is_open()) {
            return -1;
        }

        std::string line;
        std::getline(statFile, line);
        statFile.close();

        // /proc/[pid]/stat 格式: pid (comm) state ppid ...
        // 需要找到第二个括号后的第一个数字
        size_t lastParen = line.rfind(')');
        if (lastParen == std::string::npos) {
            return -1;
        }

        std::istringstream iss(line.substr(lastParen + 1));
        std::string state;
        pid_t ppid;
        if (iss >> state >> ppid) {
            return ppid;
        }

        return -1;
    }

private:
    std::thread monitorThread;
    std::atomic<bool> monitoring{false};

    // 存储五元组与进程信息关联的映射表
    std::unordered_map<FiveTuple, std::shared_ptr<ProcessInfo>, FiveTupleHash> sessionMap;
    std::mutex sessionMapLock;

    // 进程信息缓存
    std::map<uint32_t, std::shared_ptr<ProcessInfo>> processInfoCache;

    // inode到进程ID的缓存（提高查找性能）
    std::unordered_map<unsigned long, pid_t> inodeToProcessCache;
    std::mutex inodeCacheLock;
};

#endif // __linux__
