
#ifndef TSHARK_SERVER_PACKET_SQL_HPP
#define TSHARK_SERVER_PACKET_SQL_HPP

#include <string>
#include <sstream>
#include <iostream>
#include "tshark_datatype.h"
#include "third_library/loguru/loguru.hpp"
#include "pagehelper.h"

class PacketSQL {
public:
    static std::string buildPacketQuerySQL(QueryCondition &condition) {

        std::string sql;
        std::stringstream ss;

        if (condition.filter.empty()) {
            ss << "SELECT * FROM t_packets";
        } else {
            ss << "SELECT * FROM t_packets_filter";
        }

        std::vector<std::string> conditionList;
        if (!condition.proto.empty()) {
            char buf[100] = {0};
            snprintf(buf, sizeof(buf), "protocol='%s'", condition.proto.c_str());
            conditionList.push_back(buf);
        }
        if (condition.sessionId != 0) {
            char buf[100] = {0};
            snprintf(buf, sizeof(buf), "belongSessionId=%d", condition.sessionId);
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

        ss << PageHelper::getPageSql();

        sql = ss.str();
        LOG_F(INFO, "[BUILD SQL]: %s", sql.c_str());
        return sql;
    }

    static std::string buildPacketQuerySQL_Count(QueryCondition &condition) {
        std::string sql = buildPacketQuerySQL(condition);
        auto pos = sql.find("LIMIT");
        if (pos != std::string::npos) {
            sql = sql.substr(0, pos);
        }
        std::string countSql = "SELECT COUNT(0) FROM (" + sql + ") t_temp;";
        LOG_F(INFO, "[BUILD SQL]: %s", countSql.c_str());
        return countSql;
    }

    // 统计数据包总数和总字节数SQL
    static std::string buildPacketCountSQL(QueryCondition& condition) {
        std::string sql;
        std::stringstream ss;
        ss << "SELECT COUNT(0) as totalPackets, SUM(capLength) as totalBytes FROM t_packets";

        std::vector<std::string> conditionList;
        if (!condition.proto.empty()) {
            char buf[100] = { 0 };
            snprintf(buf, sizeof(buf), "protocol='%s'", condition.proto.c_str());
            conditionList.push_back(buf);
        }
        if (condition.sessionId != 0) {
            char buf[100] = { 0 };
            snprintf(buf, sizeof(buf), "belongSessionId=%d", condition.sessionId);
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

        sql = ss.str();
        LOG_F(INFO, "[BUILD SQL]: %s", sql.c_str());
        return sql;
    }

};

#endif //TSHARK_SERVER_PACKET_SQL_HPP
