
#ifndef TSHARK_DATATYPE_H
#define TSHARK_DATATYPE_H
#include <unordered_map>
#include <set>
#include <regex>
#include <third_library/rapidjson/document.h>
#include <third_library/rapidjson/writer.h>
#include <third_library/rapidjson/prettywriter.h>
#include <third_library/rapidjson/stringbuffer.h>
#include "misc_util.hpp"


class BaseDataObject {
public:
    // 将对象转换为JSON Value，用于转换为JSON格式输出
    virtual void toJsonObj(rapidjson::Value &obj, rapidjson::Document::AllocatorType& allocator) const = 0;
};


//
// 进程信息
//
class ProcessInfo {
public:
    uint32_t processId;
    uint32_t parentProcessId;
    std::string processName;
    std::string processFullPath;
    std::string processCommandLine;
    std::string processIcoDataBase64;

    virtual void toJsonObj(rapidjson::Value& obj, rapidjson::Document::AllocatorType& allocator) const {
        obj.AddMember("processId", processId, allocator);
        obj.AddMember("parentProcessId", parentProcessId, allocator);
        obj.AddMember("processName", rapidjson::Value(processName.c_str(), allocator), allocator);
        obj.AddMember("processFullPath", rapidjson::Value(processFullPath.c_str(), allocator), allocator);
        obj.AddMember("processCommandLine", rapidjson::Value(processCommandLine.c_str(), allocator), allocator);
        obj.AddMember("processIcoDataBase64", rapidjson::Value(processIcoDataBase64.c_str(), allocator), allocator);
    }
};



// 用于存储每个数据包的所有字段信息
class PacketInfo : public BaseDataObject {
public:
    PacketInfo() {
        fileOffset = 0;
        belongSessionId = 0;
        streamId = 0;
    }
    uint32_t frameNumber;       // 数据包编号
    double timestamp;           // 时间戳 (frame.time_epoch)
    std::string srcMac;         // 源MAC地址
    std::string dstMac;         // 目的MAC地址
    std::string srcIP;          // 源IP
    uint16_t srcPort;           // 源端口 (TCP/UDP)
    std::string srcLocation;    // 源地理位置
    std::string dstIP;          // 目的IP
    uint16_t dstPort;           // 目的端口 (TCP/UDP)
    std::string dstLocation;    // 目的地理位置
    uint32_t frameLength;       // 数据包长度 (frame.len)
    uint32_t capLength;         // 实际捕获的数据包长度 (frame.cap_len)
    uint8_t transProtoNumber;   // 传输层协议编号 (ip.proto和ipv6.nxt)
    std::string protocol;       // 协议 (_ws.col.Protocol)
    std::string info;           // 信息 (_ws.col.Info)
    std::string remark;         // 备注信息，用于不同应用协议的数据包保存一些额外的信息，如HTTP的域名等
    uint32_t fileOffset;        // 在pcap文件中的偏移
    uint32_t belongSessionId;   // 所属的会话ID，为0表示不属于任何会话
    uint32_t streamId;          // 会话数据流ID

    bool operator()(const std::shared_ptr<PacketInfo>& lhs, const std::shared_ptr<PacketInfo>& rhs) const {
        return lhs->frameNumber < rhs->frameNumber;
    }

    virtual void toJsonObj(rapidjson::Value &obj, rapidjson::Document::AllocatorType& allocator) const {
        obj.AddMember("frameNumber", frameNumber, allocator);
        obj.AddMember("timestamp", timestamp, allocator);
        obj.AddMember("srcMac", rapidjson::Value(srcMac.c_str(), allocator), allocator);
        obj.AddMember("dstMac", rapidjson::Value(dstMac.c_str(), allocator), allocator);
        obj.AddMember("srcIP", rapidjson::Value(srcIP.c_str(), allocator), allocator);
        obj.AddMember("srcLocation", rapidjson::Value(srcLocation.c_str(), allocator), allocator);
        obj.AddMember("srcPort", srcPort, allocator);
        obj.AddMember("dstIP", rapidjson::Value(dstIP.c_str(), allocator), allocator);
        obj.AddMember("dstLocation", rapidjson::Value(dstLocation.c_str(), allocator), allocator);
        obj.AddMember("dstPort", dstPort, allocator);
        obj.AddMember("frameLength", frameLength, allocator);
        obj.AddMember("capLength", capLength, allocator);
        obj.AddMember("transProtoNumber", transProtoNumber, allocator);
        obj.AddMember("protocol", rapidjson::Value(protocol.c_str(), allocator), allocator);
        obj.AddMember("info", rapidjson::Value(info.c_str(), allocator), allocator);
        obj.AddMember("remark", rapidjson::Value(remark.c_str(), allocator), allocator);
        obj.AddMember("fileOffset", fileOffset, allocator);
        obj.AddMember("belongSessionId", belongSessionId, allocator);
        obj.AddMember("timeorderInfo", rapidjson::Value(getPacketTimeOrderInfo().c_str(), allocator), allocator);
        obj.AddMember("color", rapidjson::Value(getPacketColor().c_str(), allocator), allocator);
    }

private:
    // 增加一个显示数据包在时序图中简要信息的字段
    std::string getPacketTimeOrderInfo() const {
        if (info.find("[SYN]") != std::string::npos) {
            return "SYN";
        }
        if (info.find("[ACK]") != std::string::npos) {
            return "ACK";
        }
        if (info.find("[PSH]") != std::string::npos) {
            return "PSH";
        }
        if (info.find("[FIN]") != std::string::npos) {
            return "FIN";
        }
        if (info.find("[RST]") != std::string::npos) {
            return "RST";
        }
        if (info.find("[SYN, ACK]") != std::string::npos) {
            return "SYN ACK";
        }
        if (info.find("[PSH, ACK]") != std::string::npos) {
            return "PSH ACK";
        }
        if (info.find("[FIN, ACK]") != std::string::npos) {
            return "FIN ACK";
        }
        if (info.find("[RST, ACK]") != std::string::npos) {
            return "FIN ACK";
        }
        if (info.find("TCP Dup ACK") != std::string::npos) {
            return "重复ACK";
        }
        if (info.find("TCP Retransmission") != std::string::npos) {
            return "TCP重传";
        }
        if (info.find("TCP Spurious Retransmission") != std::string::npos) {
            return "TCP伪重传";
        }
        if (info.find("Application Data") != std::string::npos) {
            return "应用数据";
        }
        if (info.find("TCP Out-Of-Order") != std::string::npos) {
            return "TCP乱序数据";
        }
        if (info.find("TCP Previous segment not captured") != std::string::npos) {
            return "TCP Previous segment not captured";
        }
        if (info.find("Standard query response") != std::string::npos) {
            std::regex pattern("Standard query response");
            std::string replacement = "DNS查询响应";
            return std::regex_replace(info, pattern, replacement);
        }
        if (info.find("Standard query") != std::string::npos) {
            std::regex pattern("Standard query");
            std::string replacement = "DNS查询";
            return std::regex_replace(info, pattern, replacement);
        }

        return info;
    }

    // 获取数据包的颜色值
    std::string getPacketColor() const {
        if (info.find("[SYN]") != std::string::npos) {
            return "arcoblue-2";
        }
        if (info.find("FIN") != std::string::npos) {
            return "grey-4";
        }
        if (info.find("RST") != std::string::npos) {
            return "red-5";
        }
        if (info.find("TCP Dup ACK") != std::string::npos) {
            return "orange-3";
        }
        if (info.find("TCP Retransmission") != std::string::npos) {
            return "gray-6";
        }
        if (info.find("TCP Spurious Retransmission") != std::string::npos) {
            return "gray-6";
        }
        if (info.find("TCP Out-Of-Order") != std::string::npos) {
            return "orange-3";
        }
        if (info.find("TCP Previous segment not captured") != std::string::npos) {
            return "gray-6";
        }
        if (info.find("Standard query response") != std::string::npos) {
            return "blue-2";
        }
        if (protocol == "HTTP" || info.find("SNI=") != std::string::npos) {
            return "lime-2";
        }
        if (protocol == "ARP") {
            return "gold-1";
        }
        if (info.find("Destination unreachable") != std::string::npos) {
            return "gray-6";
        }

        return "";
    }
};


// 用于存储会话的统计信息
class SessionInfo : public BaseDataObject {
public:
    SessionInfo() {
        sessionId = 0;
        ip1Port = 0;
        ip2Port = 0;
        startTime = 0.0f;
        endTime = 0.0f;
        ip1SendPacketsCount = 0;
        ip1SendBytesCount = 0;
        ip2SendPacketsCount = 0;
        ip2SendBytesCount = 0;
        packetCount = 0;
        totalBytes = 0;
        streamId = 0;
    }
    uint32_t sessionId;
    std::string ip1;
    uint16_t ip1Port;
    std::string ip1Location;
    std::string ip2;
    uint16_t ip2Port;
    std::string ip2Location;
    std::string transProto;
    std::string appProto;
    double startTime;
    double endTime;
    uint32_t ip1SendPacketsCount;   // ip1发送的数据包数
    uint32_t ip1SendBytesCount;     // ip1发送的字节数
    uint32_t ip2SendPacketsCount;   // ip2发送的数据包数
    uint32_t ip2SendBytesCount;     // ip2发送的字节数
    uint32_t packetCount;           // 数据包数量
    uint32_t totalBytes;            // 总字节数
    std::string remark;             // 会话的备注信息，用于不同应用协议的会话保存一些额外的信息，如HTTP的域名等
    uint32_t streamId;              // 会话数据流ID

    std::shared_ptr<ProcessInfo> processInfo;   // 会话所属的进程信息

    bool operator()(const std::shared_ptr<SessionInfo>& lhs, const std::shared_ptr<SessionInfo>& rhs) const {
        return lhs->sessionId < rhs->sessionId;
    }

    virtual void toJsonObj(rapidjson::Value &obj, rapidjson::Document::AllocatorType& allocator) const {
        obj.AddMember("sessionId", sessionId, allocator);
        obj.AddMember("ip1", rapidjson::Value(ip1.c_str(), allocator), allocator);
        obj.AddMember("ip1Port", ip1Port, allocator);
        obj.AddMember("ip1Location", rapidjson::Value(ip1Location.c_str(), allocator), allocator);
        obj.AddMember("ip2", rapidjson::Value(ip2.c_str(), allocator), allocator);
        obj.AddMember("ip2Port", ip2Port, allocator);
        obj.AddMember("ip2Location", rapidjson::Value(ip2Location.c_str(), allocator), allocator);
        obj.AddMember("transProto", rapidjson::Value(transProto.c_str(), allocator), allocator);
        obj.AddMember("appProto", rapidjson::Value(appProto.c_str(), allocator), allocator);
        obj.AddMember("startTime", startTime, allocator);
        obj.AddMember("endTime", endTime, allocator);
        obj.AddMember("ip1SendPacketsCount", ip1SendPacketsCount, allocator);
        obj.AddMember("ip1SendBytesCount", ip1SendBytesCount, allocator);
        obj.AddMember("ip2SendPacketsCount", ip2SendPacketsCount, allocator);
        obj.AddMember("ip2SendBytesCount", ip2SendBytesCount, allocator);
        obj.AddMember("packetCount", packetCount, allocator);
        obj.AddMember("totalBytes", totalBytes, allocator);
        obj.AddMember("remark", rapidjson::Value(remark.c_str(), allocator), allocator);
        obj.AddMember("streamId", streamId, allocator);

        if (processInfo) {
            rapidjson::Value processInfoObj(rapidjson::kObjectType);
            processInfo->toJsonObj(processInfoObj, allocator);
            obj.AddMember("processInfo", processInfoObj, allocator);
        }
    }
};


// 定义五元组
struct FiveTuple {
    std::string srcIP;
    std::string dstIP;
    uint16_t srcPort;
    uint16_t dstPort;
    int transProtoNumber;

    // 重载比较操作符，用于 unordered_map 的键比较，确保会话对称性
    bool operator==(const FiveTuple& other) const {
        // 注意考虑两个方向的匹配
        return (srcIP == other.srcIP && dstIP == other.dstIP && srcPort == other.srcPort && dstPort == other.dstPort && transProtoNumber == other.transProtoNumber) ||
            (srcIP == other.dstIP && dstIP == other.srcIP && srcPort == other.dstPort && dstPort == other.srcPort && transProtoNumber == other.transProtoNumber);
    }
};

// 定义哈希函数，确保会话对称性
struct FiveTupleHash {
    std::size_t operator()(const FiveTuple& tuple) const {
        std::hash<std::string> hashFn;
        std::size_t h1 = hashFn(tuple.srcIP);
        std::size_t h2 = hashFn(tuple.dstIP);
        std::size_t h3 = std::hash<uint16_t>()(tuple.srcPort);
        std::size_t h4 = std::hash<uint16_t>()(tuple.dstPort);
        std::size_t h5 = std::hash<uint8_t>()(tuple.transProtoNumber);

        // 返回源和目的地址/端口的哈希组合，支持对称性
        std::size_t directHash = h1 ^ (h2 << 1) ^ (h3 << 2) ^ (h4 << 3);
        std::size_t reverseHash = h2 ^ (h1 << 1) ^ (h4 << 2) ^ (h3 << 3);

        // 确保无论是正向还是反向，都会返回相同的哈希值
        return directHash ^ reverseHash ^ h5;
    }
};

using SessionMap = std::unordered_map<FiveTuple, std::shared_ptr<SessionInfo>, FiveTupleHash>;

// 网卡信息
struct AdapterInfo {
    int id;
    std::string name;
    std::string remark;
};


// 数据流统计信息
class DataStreamCountInfo : public BaseDataObject {
public:
    uint32_t totalPacketCount = 0;
    std::string node0;
    uint32_t node0PacketCount = 0;
    uint32_t node0BytesCount = 0;
    std::string node1;
    uint32_t node1PacketCount = 0;
    uint32_t node1BytesCount = 0;

    virtual void toJsonObj(rapidjson::Value& obj, rapidjson::Document::AllocatorType& allocator) const {
        obj.AddMember("totalPacketCount", totalPacketCount, allocator);

        obj.AddMember("node0", rapidjson::Value(node0.c_str(), allocator), allocator);
        obj.AddMember("node0PacketCount", node0PacketCount, allocator);
        obj.AddMember("node0BytesCount", node0BytesCount, allocator);

        obj.AddMember("node1", rapidjson::Value(node1.c_str(), allocator), allocator);
        obj.AddMember("node1PacketCount", node1PacketCount, allocator);
        obj.AddMember("node1BytesCount", node1BytesCount, allocator);
    }
};

// 数据流条目结构
class DataStreamItem : public BaseDataObject {
public:
    std::string hexData;
    std::string srcNode;
    std::string dstNode;

    virtual void toJsonObj(rapidjson::Value& obj, rapidjson::Document::AllocatorType& allocator) const {
        obj.AddMember("hexData", rapidjson::Value(hexData.c_str(), allocator), allocator);
        obj.AddMember("srcNode", rapidjson::Value(srcNode.c_str(), allocator), allocator);
        obj.AddMember("dstNode", rapidjson::Value(dstNode.c_str(), allocator), allocator);
    }
};


// 统计信息
class CountInfo : public BaseDataObject {
public:
    CountInfo() {
        totalPackets = 0;
        totalSessions = 0;
        totalBytes = 0;
    }
    int totalPackets;       // 总数据包数
    int totalSessions;      // 总会话数
    int totalBytes;         // 总字节数

    virtual void toJsonObj(rapidjson::Value& obj, rapidjson::Document::AllocatorType& allocator) const {
        obj.AddMember("totalPackets", totalPackets, allocator);
        obj.AddMember("totalSessions", totalSessions, allocator);
        obj.AddMember("totalBytes", totalBytes, allocator);
    }
};

// 查询条件
class QueryCondition {
public:
    QueryCondition() {
        port = 0;
        sessionId = 0;
        processId = 0;
    }
    std::string ip;
    uint16_t port;
    std::string proto;
    std::string domain;
    std::string country;
    uint32_t sessionId;
    uint32_t processId;

    // tshark过滤表达式
    std::string filter;
};


// IP通信统计信息
struct IPStatsInfo : public BaseDataObject {
    std::string ip;
    std::string location;
    double earliestTime = 0.0;
    double latestTime = 0.0;
    std::set<int> ports;
    std::set<std::string> protocols; // 通信协议集合（包括transProto与appProto）

    // 数据统计
    int totalSentPackets = 0;
    int totalRecvPackets = 0;
    int totalSentBytes = 0;
    int totalRecvBytes = 0;
    int tcpSessionCount = 0;
    int udpSessionCount = 0;

    virtual void toJsonObj(rapidjson::Value &obj, rapidjson::Document::AllocatorType& allocator) const {
        obj.AddMember("ip", rapidjson::Value(ip.c_str(), allocator), allocator);
        obj.AddMember("location", rapidjson::Value(location.c_str(), allocator), allocator);
        std::string s_protocols = MiscUtil::convertSetToString(protocols, ',');
        obj.AddMember("proto", rapidjson::Value(s_protocols.c_str(), allocator), allocator);

        rapidjson::Value portsValue;
        portsValue.SetArray();
        for (auto port : ports) {
            portsValue.PushBack(rapidjson::Value(port), allocator);
        }
        obj.AddMember("ports", portsValue, allocator);

        obj.AddMember("earliestTime", earliestTime, allocator);
        obj.AddMember("latestTime", latestTime, allocator);
        obj.AddMember("totalSentPackets", totalSentPackets, allocator);
        obj.AddMember("totalRecvPackets", totalRecvPackets, allocator);
        obj.AddMember("totalSentBytes", totalSentBytes, allocator);
        obj.AddMember("totalRecvBytes", totalRecvBytes, allocator);
        obj.AddMember("tcpSessionCount", tcpSessionCount, allocator);
        obj.AddMember("udpSessionCount", udpSessionCount, allocator);
    }
};


// 协议统计信息
struct ProtoStatsInfo : public BaseDataObject {

    std::string proto;
    int totalPackets = 0;
    int totalBytes = 0;
    int sessionCount = 0;
    std::string protoDescription;

    virtual void toJsonObj(rapidjson::Value &obj, rapidjson::Document::AllocatorType& allocator) const {
        obj.AddMember("proto", rapidjson::Value(proto.c_str(), allocator), allocator);
        obj.AddMember("totalPackets", totalPackets, allocator);
        obj.AddMember("totalBytes", totalBytes, allocator);
        obj.AddMember("sessionCount", sessionCount, allocator);
        obj.AddMember("protoDescription", rapidjson::Value(protoDescription.c_str(), allocator), allocator);
    }
};


// 国家统计信息
struct CountryStatsInfo : public BaseDataObject {

    std::string country;
    int ipCount = 0;
    int totalPackets = 0;
    int totalBytes = 0;
    int sessionCount = 0;

    virtual void toJsonObj(rapidjson::Value& obj, rapidjson::Document::AllocatorType& allocator) const {
        obj.AddMember("country", rapidjson::Value(country.c_str(), allocator), allocator);
        obj.AddMember("ipCount", ipCount, allocator);
        obj.AddMember("totalPackets", totalPackets, allocator);
        obj.AddMember("totalBytes", totalBytes, allocator);
        obj.AddMember("sessionCount", sessionCount, allocator);
    }
};


// HTTP日志
struct HTTPLog : public BaseDataObject {
    uint32_t logId;
    uint32_t sessionId;
    double startTime;
    double endTime;
    std::string clientIp;
    std::string serverIp;
    uint16_t clientPort;
    uint16_t serverPort;

    // 请求相关字段
    std::string method;
    std::string uri;
    std::string host;
    std::string referer;
    std::string userAgent;

    // 响应相关字段
    uint16_t status;
    std::string httpVersion;
    std::string server;
    std::string resContentType;
    uint32_t resContentLength;

    virtual void toJsonObj(rapidjson::Value& obj, rapidjson::Document::AllocatorType& allocator) const {
        obj.AddMember("logId", logId, allocator);
        obj.AddMember("sessionId", sessionId, allocator);
        obj.AddMember("startTime", startTime, allocator);
        obj.AddMember("endTime", endTime, allocator);
        obj.AddMember("clientIp", rapidjson::Value(clientIp.c_str(), allocator), allocator);
        obj.AddMember("serverIp", rapidjson::Value(serverIp.c_str(), allocator), allocator);
        obj.AddMember("clientPort", clientPort, allocator);
        obj.AddMember("serverPort", serverPort, allocator);

        obj.AddMember("method", rapidjson::Value(method.c_str(), allocator), allocator);
        obj.AddMember("uri", rapidjson::Value(uri.c_str(), allocator), allocator);
        obj.AddMember("host", rapidjson::Value(host.c_str(), allocator), allocator);
        obj.AddMember("referer", rapidjson::Value(referer.c_str(), allocator), allocator);
        obj.AddMember("userAgent", rapidjson::Value(userAgent.c_str(), allocator), allocator);

        obj.AddMember("status", status, allocator);
        obj.AddMember("httpVersion", rapidjson::Value(httpVersion.c_str(), allocator), allocator);
        obj.AddMember("server", rapidjson::Value(server.c_str(), allocator), allocator);
        obj.AddMember("resContentType", rapidjson::Value(resContentType.c_str(), allocator), allocator);
        obj.AddMember("resContentLength", resContentLength, allocator);
    }
};

// DNS日志
struct DNSLog : public BaseDataObject {
    uint32_t logId;
    uint32_t sessionId;
    double startTime;
    double endTime;
    std::string clientIp;
    std::string serverIp;
    uint16_t clientPort;
    uint16_t serverPort;

    // 请求相关字段
    std::string queryName;
    std::string queryType;

    // 响应相关字段
    std::string responseName;
    std::string responseType;
    std::string answer;

    virtual void toJsonObj(rapidjson::Value& obj, rapidjson::Document::AllocatorType& allocator) const {
        obj.AddMember("logId", logId, allocator);
        obj.AddMember("sessionId", sessionId, allocator);
        obj.AddMember("startTime", startTime, allocator);
        obj.AddMember("endTime", endTime, allocator);
        obj.AddMember("clientIp", rapidjson::Value(clientIp.c_str(), allocator), allocator);
        obj.AddMember("serverIp", rapidjson::Value(serverIp.c_str(), allocator), allocator);
        obj.AddMember("clientPort", clientPort, allocator);
        obj.AddMember("serverPort", serverPort, allocator);

        obj.AddMember("queryName", rapidjson::Value(queryName.c_str(), allocator), allocator);
        obj.AddMember("queryType", rapidjson::Value(queryType.c_str(), allocator), allocator);

        obj.AddMember("responseName", rapidjson::Value(responseName.c_str(), allocator), allocator);
        obj.AddMember("responseType", rapidjson::Value(responseType.c_str(), allocator), allocator);
        obj.AddMember("answer", rapidjson::Value(answer.c_str(), allocator), allocator);
    }
};


#endif //TSHARK_DATATYPE_H
