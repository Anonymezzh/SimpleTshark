//
// Created for simpletshark network statistics monitoring
// Cross-platform network interface statistics utility
//

#ifndef NETWORK_STATS_UTIL_HPP
#define NETWORK_STATS_UTIL_HPP

#include <string>
#include <map>
#include <cstring>
#include <atomic>
#include <thread>

#ifdef _WIN32
#define _WIN32_DCOM

#include <winsock2.h>
#include <windows.h>
#include <comdef.h>
#include <Wbemidl.h>
#include <netioapi.h>
#include <iphlpapi.h>

#include <pcap.h>
#include <string>
#pragma comment(lib, "wpcap.lib")
#pragma comment(lib, "Packet.lib")
#pragma comment(lib, "ws2_32.lib")
#pragma comment(lib, "wbemuuid.lib")
#pragma comment(lib, "iphlpapi.lib")
#elif defined(__APPLE__)
#include <ifaddrs.h>
#include <net/if.h>
#include <sys/types.h>
#else  // Linux
#include <ifaddrs.h>
#include <net/if.h>
#include <sys/types.h>
#include <linux/if_link.h>
#endif

#include "misc_util.hpp"
#include "third_library/loguru/loguru.hpp"

// 网卡流量计数器结构
struct NetworkCounters {
    unsigned long long ibytes = 0;  // 接收字节数
    unsigned long long obytes = 0;  // 发送字节数
};

class NetworkStatsUtil {
public:
#ifdef _WIN32
    static std::string GuidToStringA(const GUID& guid) {
        LPOLESTR guidString = NULL;
        std::string result;

        if (SUCCEEDED(StringFromCLSID(guid, &guidString)) && guidString != NULL) {
            char narrowGuid[64];
            WideCharToMultiByte(CP_UTF8, 0, guidString, -1, narrowGuid, sizeof(narrowGuid), NULL, NULL);
            result = narrowGuid;
            CoTaskMemFree(guidString);
        }

        return result;
    }

    static std::wstring GuidToStringW(const GUID& guid) {
        LPOLESTR guidString = NULL;
        std::wstring result;

        if (SUCCEEDED(StringFromCLSID(guid, &guidString)) && guidString != NULL) {
            result = guidString;
            CoTaskMemFree(guidString);
        }

        return result;
    }

    static std::set<std::string> GetOpenableAdapters()
    {
        std::set<std::string> result;
        pcap_if_t* alldevs = nullptr;
        char errbuf[PCAP_ERRBUF_SIZE];

        if (pcap_findalldevs(&alldevs, errbuf) == -1) {
            std::cerr << "pcap_findalldevs failed: " << errbuf << std::endl;
            return result;
        }

        for (pcap_if_t* d = alldevs; d; d = d->next) {
            if (!d->name) continue;

            char open_errbuf[PCAP_ERRBUF_SIZE];
            pcap_t* handle = pcap_open_live(
                d->name,
                1,
                PCAP_OPENFLAG_PROMISCUOUS,
                1,
                open_errbuf
            );

            if (handle) {
                pcap_close(handle);
                result.insert(std::string(d->name));
            }
        }

        pcap_freealldevs(alldevs);
        return result;
    }

#endif



    // 获取所有网卡的流量快照
    // Windows: 返回的key是网卡的友好名称（对应tshark -D输出括号中的描述）
    // macOS/Linux: 返回的key是接口名称（如en0, eth0等）
    static std::map<std::string, NetworkCounters> getSnapshot() {
        std::map<std::string, NetworkCounters> result;

#ifdef _WIN32
        // Windows平台：使用npcap获取可显示网卡+GetIfTable2获取流量统计
        // 第一步：使用GetIfTable2获取所有网卡的流量统计（LUID -> 流量）
        PMIB_IF_TABLE2 pIfTable = NULL;
        DWORD dwRetVal = GetIfTable2(&pIfTable);

        if (dwRetVal != NO_ERROR) {
            return result;
        }

        // 通过npcap获取可见网卡，用于过滤和wireshark展示的网卡列表对齐
        std::set<std::string> showAdapterList = GetOpenableAdapters();
        for (ULONG i = 0; i < pIfTable->NumEntries; i++) {
            MIB_IF_ROW2& row = pIfTable->Table[i];

            std::string adapterName = MiscUtil::UnicoeToANSIString(row.Alias);
            std::string adapterGuid = GuidToStringA(row.InterfaceGuid);
            std::string adapterDeviceName = "\\Device\\NPF_" + adapterGuid;

            // 对本地回环网卡做特殊处理
            if (adapterName.find("Loopback") != std::string::npos) {
                adapterName = "Adapter for loopback traffic capture";
                adapterDeviceName = "\\Device\\NPF_Loopback";
            }

            if (showAdapterList.find(adapterDeviceName) == showAdapterList.end()) {
                continue;
            }

            NetworkCounters counters;
            counters.ibytes = row.InOctets;
            counters.obytes = row.OutOctets;

            result[adapterName] = counters;
        }

        FreeMibTable(pIfTable);

#elif defined(__APPLE__)
        // macOS平台实现
        struct ifaddrs* ifap = nullptr;
        if (getifaddrs(&ifap) != 0) {
            return result;
        }

        for (struct ifaddrs* ifa = ifap; ifa; ifa = ifa->ifa_next) {
            if (!ifa->ifa_name) continue;

            // ifa_data包含struct if_data (AF_LINK类型时)
            if (ifa->ifa_data) {
                struct if_data* ifd = (struct if_data*)ifa->ifa_data;

                unsigned long long iby = (unsigned long long)ifd->ifi_ibytes;
                unsigned long long oby = (unsigned long long)ifd->ifi_obytes;

                // 累加（因为同一个接口可能有多个地址族的条目）
                NetworkCounters& counters = result[ifa->ifa_name];
                counters.ibytes += iby;
                counters.obytes += oby;
            }
        }

        freeifaddrs(ifap);

#else  // Linux
        // Linux平台实现
        struct ifaddrs* ifap = nullptr;
        if (getifaddrs(&ifap) != 0) {
            return result;
        }

        for (struct ifaddrs* ifa = ifap; ifa; ifa = ifa->ifa_next) {
            if (!ifa->ifa_name) continue;

            // Linux上通过AF_PACKET族获取统计信息
            if (ifa->ifa_addr && ifa->ifa_addr->sa_family == AF_PACKET && ifa->ifa_data) {
                struct rtnl_link_stats* stats = (struct rtnl_link_stats*)ifa->ifa_data;

                NetworkCounters& counters = result[ifa->ifa_name];
                counters.ibytes += stats->rx_bytes;
                counters.obytes += stats->tx_bytes;
            }
        }

        freeifaddrs(ifap);
#endif

        return result;
    }

    // 计算两个快照之间的流量差值（字节/秒）
    static std::map<std::string, NetworkCounters> calculateDelta(
        const std::map<std::string, NetworkCounters>& before,
        const std::map<std::string, NetworkCounters>& after,
        int intervalSeconds = 1) {

        std::map<std::string, NetworkCounters> delta;

        for (const auto& pair : before) {
            const std::string& ifName = pair.first;
            const NetworkCounters& beforeCounters = pair.second;

            auto it = after.find(ifName);
            if (it != after.end()) {
                const NetworkCounters& afterCounters = it->second;

                NetworkCounters& deltaCounters = delta[ifName];

                // 计算差值，防止计数器回绕（虽然64位回绕概率极低）
                long long ibyteDiff = (long long)afterCounters.ibytes - (long long)beforeCounters.ibytes;
                long long obyteDiff = (long long)afterCounters.obytes - (long long)beforeCounters.obytes;

                deltaCounters.ibytes = (ibyteDiff < 0) ? 0 : (ibyteDiff / intervalSeconds);
                deltaCounters.obytes = (obyteDiff < 0) ? 0 : (obyteDiff / intervalSeconds);
            }
        }

        // 处理新出现的接口
        for (const auto& pair : after) {
            if (before.find(pair.first) == before.end()) {
                delta[pair.first] = pair.second;
            }
        }

        return delta;
    }

    // 获取单个网卡的总流量（接收+发送）
    static unsigned long long getTotalBytes(const NetworkCounters& counters) {
        return counters.ibytes + counters.obytes;
    }
};

#ifdef _WIN32
// Windows 平台专用：回环网卡流量监控器
// 由于 Loopback 不走 NDIS 层，GetIfTable2 无法获取流量，需要通过 npcap 实时抓包统计
class LoopbackMonitor {
private:
    pcap_t* m_handle = nullptr;
    std::atomic<unsigned long long> m_totalBytes{0};
    std::thread m_captureThread;
    std::atomic<bool> m_stopFlag{false};

    // 抓包线程函数
    void captureThreadEntry() {
        if (!m_handle) return;

        struct pcap_pkthdr* header;
        const u_char* pkt_data;
        int res;

        while (!m_stopFlag) {
            res = pcap_next_ex(m_handle, &header, &pkt_data);

            if (res == 1) {
                // 成功抓到包，累加长度
                m_totalBytes.fetch_add(header->len, std::memory_order_relaxed);
            } else if (res == 0) {
                // 超时，继续
                continue;
            } else if (res == -1) {
                // 错误
                break;
            } else if (res == -2) {
                // 文件结束（实时抓包不会出现）
                break;
            }
        }

        LOG_F(INFO, "LoopbackMonitor 监控线程退出");
    }

public:
    LoopbackMonitor() = default;
    ~LoopbackMonitor() {
        stop();
    }

    // 禁止拷贝
    LoopbackMonitor(const LoopbackMonitor&) = delete;
    LoopbackMonitor& operator=(const LoopbackMonitor&) = delete;

    // 启动监控
    bool start() {
        char errbuf[PCAP_ERRBUF_SIZE];

        // 打开 Loopback 网卡
        m_handle = pcap_open_live(
            "\\Device\\NPF_Loopback",
            65536,                      // 快照长度
            PCAP_OPENFLAG_PROMISCUOUS,  // 混杂模式
            10,                         // 读取超时（毫秒）
            errbuf
        );

        if (!m_handle) {
            return false;
        }

        // 重置计数器
        m_totalBytes.store(0, std::memory_order_relaxed);
        m_stopFlag.store(false, std::memory_order_relaxed);

        // 启动抓包线程
        m_captureThread = std::thread(&LoopbackMonitor::captureThreadEntry, this);

        return true;
    }

    // 停止监控
    void stop() {
        if (m_handle) {
            m_stopFlag.store(true, std::memory_order_relaxed);

            // 中断 pcap 循环
            pcap_breakloop(m_handle);

            // 等待线程退出
            if (m_captureThread.joinable()) {
                m_captureThread.join();
            }

            // 关闭句柄
            pcap_close(m_handle);
            m_handle = nullptr;
        }
    }

    // 获取当前累积流量（字节）
    unsigned long long getTotalBytes() const {
        return m_totalBytes.load(std::memory_order_relaxed);
    }

    // 重置计数器
    void reset() {
        m_totalBytes.store(0, std::memory_order_relaxed);
    }
};
#endif // _WIN32


#endif NETWORK_STATS_UTIL_HPP