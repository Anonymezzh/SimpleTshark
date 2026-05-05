
#ifndef TSHARK_SERVER_STATS_SQL_HPP
#define TSHARK_SERVER_STATS_SQL_HPP

#include <string>
#include <sstream>
#include <iostream>
#include "tshark_datatype.h"
#include "third_library/loguru/loguru.hpp"
#include "pagehelper.h"

class StatsSQL {
public:

    // IP统计
    static std::string buildIPStatsQuerySQL(QueryCondition &condition) {

        std::string sql;
        std::stringstream ss;
        ss << R"SQL(
            SELECT
                ip,
                location,
                MIN(startTime) AS earliestTime,
                MAX(endTime) AS latestTime,
                GROUP_CONCAT(DISTINCT port) AS ports,
                GROUP_CONCAT(DISTINCT transProto) AS transProtos,
                GROUP_CONCAT(DISTINCT appProto) AS appProtos,
                SUM(sentPackets) AS totalSentPackets,
                SUM(sentBytes) AS totalSentBytes,
                SUM(recvPackets) AS totalRecvPackets,
                SUM(recvBytes) AS totalRecvBytes,
                SUM(tcpSessions) AS tcpSessionCount,
                SUM(udpSessions) AS udpSessionCount
            FROM (
                SELECT
                    ip1 AS ip,
                    ip1Location AS location,
                    startTime,
                    endTime,
                    ip1Port AS port,
                    transProto,
                    appProto,
                    ip1SendPacketsCount AS sentPackets,
                    ip1SendBytesCount AS sentBytes,
                    ip2SendPacketsCount AS recvPackets,
                    ip2SendBytesCount AS recvBytes,
                    CASE WHEN transProto LIKE '%TCP%' THEN 1 ELSE 0 END AS tcpSessions,
                    CASE WHEN transProto LIKE '%UDP%' THEN 1 ELSE 0 END AS udpSessions
                FROM t_sessions
                UNION ALL
                SELECT
                    ip2 AS ip,
                    ip2Location AS location,
                    startTime,
                    endTime,
                    ip2Port AS port,
                    transProto,
                    appProto,
                    ip2SendPacketsCount AS sentPackets,
                    ip2SendBytesCount AS sentBytes,
                    ip1SendPacketsCount AS recvPackets,
                    ip1SendBytesCount AS recvBytes,
                    CASE WHEN transProto LIKE '%TCP%' THEN 1 ELSE 0 END AS tcpSessions,
                    CASE WHEN transProto LIKE '%UDP%' THEN 1 ELSE 0 END AS udpSessions
                FROM t_sessions
            ) t
        )SQL";

        std::vector<std::string> conditionList;
        if (!condition.proto.empty()) {
            char buf[100] = {0};
            snprintf(buf, sizeof(buf), "(appProto like '%%%s%%' or transProto like '%%%s%%')", condition.proto.c_str(), condition.proto.c_str());
            conditionList.push_back(buf);
        }
        if (!condition.ip.empty()) {
            char buf[100] = {0};
            snprintf(buf, sizeof(buf), "(ip='%s')", condition.ip.c_str());
            conditionList.push_back(buf);
        }
        if (condition.port != 0) {
            char buf[100] = {0};
            snprintf(buf, sizeof(buf), "(ports like '%%%d%%')", condition.port);
            conditionList.push_back(buf);
        }

        // 拼接 WHERE 条件
        if (!conditionList.empty()) {
            ss << " WHERE ";
            for (size_t i = 0; i < conditionList.size(); ++i) {
                if (i > 0) {
                    ss << " AND ";
                }
                ss << conditionList[i];
            }
        }

        ss << " GROUP BY ip";
        ss << PageHelper::getPageSql();
        sql = ss.str();
        LOG_F(INFO, "[BUILD SQL]: %s", sql.c_str());

        return sql;
    }

    static std::string buildIPStatsQuerySQL_Count(QueryCondition &condition) {
        std::string sql = buildIPStatsQuerySQL(condition);
        auto pos = sql.find("LIMIT");
        if (pos != std::string::npos) {
            sql = sql.substr(0, pos);
        }
        std::string countSql = "SELECT COUNT(0) FROM (" + sql + ") t_temp;";
        std::cout << "[BUILD SQL]: " << countSql << std::endl;
        return countSql;
    }

    // 协议统计
    static std::string buildProtoStatsQuerySQL(QueryCondition &condition) {

        std::string sql;
        std::stringstream ss;
        ss << R"SQL(
            SELECT
                    protocol,
                    COUNT(0) AS totalPackets,
                    SUM(capLength) AS totalBytes,
                    COUNT(DISTINCT belongSessionId) AS sessionCount
            FROM t_packets
            GROUP BY protocol
        )SQL";

        ss << PageHelper::getPageSql();

        sql = ss.str();
        LOG_F(INFO, "[BUILD SQL]: %s", sql.c_str());

        return sql;
    }

    static std::string buildProtoStatsQuerySQL_Count(QueryCondition &condition) {
        std::string sql = buildProtoStatsQuerySQL(condition);
        auto pos = sql.find("LIMIT");
        if (pos != std::string::npos) {
            sql = sql.substr(0, pos);
        }
        std::string countSql = "SELECT COUNT(0) FROM (" + sql + ") t_temp;";
        LOG_F(INFO, "[BUILD SQL]: %s", countSql.c_str());
        return countSql;
    }


    // 国家统计
    static std::string buildCountryStatsQuerySQL(QueryCondition& condition) {

        std::string sql;
        std::stringstream ss;
        ss << R"SQL(
            SELECT 
                country,
                COUNT(DISTINCT ip) AS ipCount,
                SUM(packetCount) AS totalPackets,
                SUM(totalBytes) AS totalBytes,
                COUNT(DISTINCT sessionId) AS sessionCount
            FROM (
                SELECT 
                    sessionId,
                    ip1 AS ip,
                    CASE WHEN INSTR(ip1Location, '-') > 0 
                         THEN SUBSTR(ip1Location, 1, INSTR(ip1Location, '-') - 1) 
                         ELSE ip1Location END AS country,
                    packetCount,
                    totalBytes
                FROM t_sessions
                UNION ALL
                SELECT 
                    sessionId,
                    ip2 AS ip,
                    CASE WHEN INSTR(ip2Location, '-') > 0 
                         THEN SUBSTR(ip2Location, 1, INSTR(ip2Location, '-') - 1) 
                         ELSE ip2Location END AS country,
                    packetCount,
                    totalBytes
                FROM t_sessions
            ) t
            GROUP BY country
        )SQL";

        ss << PageHelper::getPageSql();

        sql = ss.str();
        LOG_F(INFO, "[BUILD SQL]: %s", sql.c_str());

        return sql;
    }

    static std::string buildCountryStatsQuerySQL_Count(QueryCondition& condition) {
        std::string sql = buildCountryStatsQuerySQL(condition);
        auto pos = sql.find("LIMIT");
        if (pos != std::string::npos) {
            sql = sql.substr(0, pos);
        }
        std::string countSql = "SELECT COUNT(0) FROM (" + sql + ") t_temp;";
        LOG_F(INFO, "[BUILD SQL]: %s", countSql.c_str());
        return countSql;
    }
};

#endif //TSHARK_SERVER_STATS_SQL_HPP
