
#ifdef _WIN32

#include <string>
#include <set>
#include <thread>
#include <mutex>
#include <unordered_map>

#include "process_network_monitor.h"
#include "misc_util.hpp"
#include "tshark_datatype.h"
#include "process_util.hpp"

#include "third_library/krabs/krabs.hpp"
#include "third_library/loguru/loguru.hpp"

#include <ws2tcpip.h>


#define EVENT_TRACE_TYPE_SEND_IPV6 26
#define EVENT_TRACE_TYPE_RECEIVE_IPV6 27
#define EVENT_TRACE_TYPE_CONNECT_IPV6 28
#define EVENT_TRACE_TYPE_ACCEPT_IPV6 31

// 端口网络字节序（大端）转为主机字节序（小端）
#define PORT_TRANSFORM(port) port = port >> 8 | port << 8;


//
// 监控进程的网络活动
// 用于把连接和进程ID进行关联
//
class ProcessNetworkMonitorWindows : public ProcessNetworkMonitor {

public:
    ProcessNetworkMonitorWindows() {
        WSADATA wsaData;
        if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
            LOG_F(ERROR, "WSAStartup failed");
            throw std::exception("WSAStartup failed");
        }
    }

    virtual ~ProcessNetworkMonitorWindows() {
        WSACleanup();
    }


    virtual void startMonitor() {

        reset();

        monitorThread = std::make_shared<std::thread>(([&]() {

            // 创建 kernel trace 会话
            trace = std::make_shared<krabs::kernel_trace>(L"network_trace_simpletshark");

            // 绑定网络事件 provider
            krabs::kernel::network_tcpip_provider tcpProvider;
            krabs::kernel::network_udpip_provider udpProvider;

            // 设置事件回调
            tcpProvider.add_on_event_callback([this](const EVENT_RECORD& record, const krabs::trace_context& trace_context) {
                krabs::schema schema(record, trace_context.schema_locator);
                krabs::parser parser(schema);
                this->parseTcpEvent(record, schema, parser);
                });

            udpProvider.add_on_event_callback([this](const EVENT_RECORD& record, const krabs::trace_context& trace_context) {
                krabs::schema schema(record, trace_context.schema_locator);
                krabs::parser parser(schema);
                this->parseUdpEvent(record, schema, parser);
                });

            // 启用 provider
            trace->enable(tcpProvider);
            trace->enable(udpProvider);

            LOG_F(INFO, "开始正在监听进程的 TCP/UDP 网络连接事件...");
            trace->start();
            }));
    }


    virtual void stopMonitor() {

        // 无需显式调用，析构函数会调用
        //trace->stop();
        trace.reset();
        monitorThread->join();
        monitorThread.reset();
        LOG_F(INFO, "已停止监听进程的 TCP/UDP 网络连接事件···");
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
            printf("[%s][%s-%d]%s:%d -> %s:%d (%s)(%s)\n",
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

    virtual void reset() {
        std::lock_guard<std::mutex> lock(sessionMapLock);

        // 如果监控器存在，重置，析构函数会调用stop
        if (trace) {
            // 无需显式调用
            //trace->stop();
            trace.reset();
        }

        if (monitorThread) {
            monitorThread->join();
            monitorThread.reset();
        }

        sessionMap.clear();
        processInfoCache.clear();
    }

private:

    // 打印网络事件信息
    void parseTcpEvent(const EVENT_RECORD& record, krabs::schema& schema, krabs::parser& parser) {

        // 只处理特定事件
        std::set<uint8_t> ipv4EventList = { EVENT_TRACE_TYPE_CONNECT, EVENT_TRACE_TYPE_ACCEPT };
        std::set<uint8_t> ipv6EventList = { EVENT_TRACE_TYPE_CONNECT_IPV6, EVENT_TRACE_TYPE_ACCEPT_IPV6 };
        uint16_t opcode = schema.event_opcode();

        // 处理IPv4数据
        if (ipv4EventList.find(opcode) != ipv4EventList.end()) {
            try {
                std::string src_ip = MiscUtil::getIPv4(parser.parse<uint32_t>(L"saddr"));
                std::string dst_ip = MiscUtil::getIPv4(parser.parse<uint32_t>(L"daddr"));
                uint16_t src_port = parser.parse<uint16_t>(L"sport");
                uint16_t dst_port = parser.parse<uint16_t>(L"dport");
                PORT_TRANSFORM(src_port);
                PORT_TRANSFORM(dst_port);
                uint32_t pid = parser.parse<uint32_t>(L"PID");

                FiveTuple fiveTuple{ src_ip, dst_ip, src_port, dst_port, IPPROTO_TCP };
                insertSession(fiveTuple, pid);
            }
            catch (const std::exception& e) {
                std::cerr << "解析事件失败: " << e.what() << std::endl;
            }
        }
        else if (ipv6EventList.find(opcode) != ipv6EventList.end()) {
            // 处理IPv6数据
            try {
                std::string src_ip = MiscUtil::getIPv6(parser.parse<IN6_ADDR>(L"saddr"));
                std::string dst_ip = MiscUtil::getIPv6(parser.parse<IN6_ADDR>(L"daddr"));
                uint16_t src_port = parser.parse<uint16_t>(L"sport");
                uint16_t dst_port = parser.parse<uint16_t>(L"dport");
                PORT_TRANSFORM(src_port);
                PORT_TRANSFORM(dst_port);
                uint32_t pid = parser.parse<uint32_t>(L"PID");

                FiveTuple fiveTuple{ src_ip, dst_ip, src_port, dst_port, IPPROTO_TCP };
                insertSession(fiveTuple, pid);
            }
            catch (const std::exception& e) {
                std::cerr << "解析事件失败: " << e.what() << std::endl;
            }
        }
    }


    // 打印网络事件信息
    void parseUdpEvent(const EVENT_RECORD& record, krabs::schema& schema, krabs::parser& parser) {

        // 只处理特定事件
        std::set<uint8_t> ipv4EventList = { EVENT_TRACE_TYPE_SEND, EVENT_TRACE_TYPE_RECEIVE };
        std::set<uint8_t> ipv6EventList = { EVENT_TRACE_TYPE_SEND_IPV6, EVENT_TRACE_TYPE_RECEIVE_IPV6 };
        uint16_t opcode = schema.event_opcode();

        // 处理IPv4数据
        if (ipv4EventList.find(opcode) != ipv4EventList.end()) {
            try {
                std::string src_ip = MiscUtil::getIPv4(parser.parse<uint32_t>(L"saddr"));
                std::string dst_ip = MiscUtil::getIPv4(parser.parse<uint32_t>(L"daddr"));
                uint16_t src_port = parser.parse<uint16_t>(L"sport");
                uint16_t dst_port = parser.parse<uint16_t>(L"dport");
                PORT_TRANSFORM(src_port);
                PORT_TRANSFORM(dst_port);
                uint32_t pid = parser.parse<uint32_t>(L"PID");

                FiveTuple fiveTuple{ src_ip, dst_ip, src_port, dst_port, IPPROTO_UDP };
                insertSession(fiveTuple, pid);
            }
            catch (const std::exception& e) {
                std::cerr << "解析事件失败: " << e.what() << std::endl;
            }
        }
        else if (ipv6EventList.find(opcode) != ipv6EventList.end()) {
            // 处理IPv6数据
            try {
                std::string src_ip = MiscUtil::getIPv6(parser.parse<IN6_ADDR>(L"saddr"));
                std::string dst_ip = MiscUtil::getIPv6(parser.parse<IN6_ADDR>(L"daddr"));
                uint16_t src_port = parser.parse<uint16_t>(L"sport");
                uint16_t dst_port = parser.parse<uint16_t>(L"dport");
                PORT_TRANSFORM(src_port);
                PORT_TRANSFORM(dst_port);
                uint32_t pid = parser.parse<uint32_t>(L"PID");

                FiveTuple fiveTuple{ src_ip, dst_ip, src_port, dst_port, IPPROTO_UDP };
                insertSession(fiveTuple, pid);
            }
            catch (const std::exception& e) {
                std::cerr << "解析事件失败: " << e.what() << std::endl;
            }
        }
    }

    void insertSession(FiveTuple& fiveTuple, uint32_t pid) {
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
            processInfo->parentProcessId = ProcessUtil::GetParentProcessId(pid);
            ProcessUtil::GetProcessNameByPid(pid, processInfo->processName, processInfo->processFullPath);
            processInfo->processIcoDataBase64 = ProcessUtil::GetExeIconAsBase64(processInfo->processFullPath);
            sessionMap.insert(std::make_pair<>(fiveTuple, processInfo));
            processInfoCache.insert(std::make_pair<>(pid, processInfo));
        }
    }

private:
    std::shared_ptr<std::thread> monitorThread;
    std::shared_ptr<krabs::kernel_trace> trace;
    std::unordered_map<FiveTuple, std::shared_ptr<ProcessInfo>, FiveTupleHash> sessionMap;
    std::mutex sessionMapLock;

    // 进程信息缓存
    std::map<uint32_t, std::shared_ptr<ProcessInfo>> processInfoCache;
};

#endif     // _WIN32