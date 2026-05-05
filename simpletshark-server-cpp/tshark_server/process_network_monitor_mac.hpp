#ifdef __APPLE__

#include <iostream>
#include <thread>
#include <mutex>
#include <atomic>
#include <chrono>
#include <regex>
#include <sstream>
#include <vector>
#include <cstdio>

#include "process_util.hpp"
#include "process_network_monitor.h"

std::string getProcessIconBase64(pid_t pid);

class ProcessNetworkMonitorMac : public ProcessNetworkMonitor {
public:
    virtual void startMonitor() {
        if (monitoring) return;
        monitoring = true;
        monitorThread = std::thread(&ProcessNetworkMonitorMac::monitorLoop, this);
    }

    virtual void stopMonitor() {
        monitoring = false;
        if (monitorThread.joinable()) {
            monitorThread.join();
        }
    }

    virtual ~ProcessNetworkMonitorMac() {
        stopMonitor();
    }

    virtual void reset() {
        std::lock_guard<std::mutex> lock(sessionMapLock);

        monitoring = false;
        if (monitorThread.joinable()) {
            monitorThread.join();
        }

        sessionMap.clear();
        processInfoCache.clear();
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
        while (monitoring) {
            PID_T lsofPid = 0;
            FILE* pipe = ProcessUtil::PopenEx("lsof -i -n -P", &lsofPid);
            if (!pipe) {
                std::cerr << "Failed to run lsof command" << std::endl;
                return;
            }

            char buffer[1024];
            bool firstLine = true;
            while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
                std::string line(buffer);
                if (firstLine) {
                    firstLine = false;
                    continue;
                }

                std::istringstream iss(line);
                std::string command, pid, user, fd, type, device, size_off, node, name;

                if (!(iss >> command >> pid >> user >> fd >> type >> device >> size_off >> node)) {
                    continue;
                }

                std::getline(iss, name);
                name = trim(name);

                std::string proto = node;
                std::string local_ip, local_port, remote_ip, remote_port;
                if (parseConnection(name, local_ip, local_port, remote_ip, remote_port)) {
                    int protoNumber = proto == "TCP" ? IPPROTO_TCP : IPPROTO_UDP;
                    FiveTuple fiveTuple{ local_ip, remote_ip, static_cast<uint16_t>(std::stoi(local_port)), static_cast<uint16_t>(std::stoi(remote_port)), protoNumber };
                    insertSession(fiveTuple, std::stoi(pid), command);
                }
            }

            // 正确关闭管道和回收子进程
            fclose(pipe);
            if (lsofPid > 0) {
                int status;
                ProcessUtil::WaitPid(lsofPid, &status, 0);
            }

            std::this_thread::sleep_for(std::chrono::seconds(1));
        }
    }

    static bool parseConnection(const std::string& nameField,
                                std::string& local_ip,
                                std::string& local_port,
                                std::string& remote_ip,
                                std::string& remote_port) {
        // Example: 192.168.1.5:52344->93.184.216.34:80
        std::regex connRegex(R"(([\d\.]+):(\d+)->([\d\.]+):(\d+))");
        std::smatch match;
        if (std::regex_search(nameField, match, connRegex) && match.size() == 5) {
            local_ip = match[1];
            local_port = match[2];
            remote_ip = match[3];
            remote_port = match[4];
            return true;
        } else {
            return false;
        }
    }

    static std::string trim(const std::string& s) {
        auto start = s.find_first_not_of(" \t\n\r");
        auto end = s.find_last_not_of(" \t\n\r");
        return (start == std::string::npos) ? "" : s.substr(start, end - start + 1);
    }

    void insertSession(FiveTuple& fiveTuple, uint32_t pid, std::string &processName) {
        std::lock_guard<std::mutex> lock(sessionMapLock);

        // 如果已经存在，并且pid没有变化，则无需更新
        if (sessionMap.find(fiveTuple) != sessionMap.end() && sessionMap[fiveTuple]->processId == pid) {
            return;
        }

        // 对进程信息做缓存处理
        if (processInfoCache.find(pid) != processInfoCache.end()) {
            sessionMap.insert(std::make_pair<>(fiveTuple, processInfoCache[pid]));
        }
        else {
            std::shared_ptr<ProcessInfo> processInfo = std::make_shared<ProcessInfo>();
            processInfo->processId = pid;
            processInfo->parentProcessId = ProcessUtil::GetParentPid((PID_T)pid);
            ProcessUtil::GetProcessNameByPid((PID_T)pid, processInfo->processName, processInfo->processFullPath);
            processInfo->processIcoDataBase64 = getProcessIconBase64((PID_T)pid);
            sessionMap.insert(std::make_pair<>(fiveTuple, processInfo));
            processInfoCache.insert(std::make_pair<>(pid, processInfo));
        }
    }

private:
    std::thread monitorThread;
    std::atomic<bool> monitoring{false};

    // 存储五元组与进程信息关联的映射表
    std::unordered_map<FiveTuple, std::shared_ptr<ProcessInfo>, FiveTupleHash> sessionMap;
    std::mutex sessionMapLock;

    // 进程信息缓存
    std::map<uint32_t, std::shared_ptr<ProcessInfo>> processInfoCache;
};

#endif // __APPLE__