
#ifndef TSHARK_SERVER_SESSION_SQL_HPP
#define TSHARK_SERVER_SESSION_SQL_HPP

#include <string>
#include <sstream>
#include <iostream>
#include "tshark_datatype.h"
#include "third_library/loguru/loguru.hpp"
#include "pagehelper.h"

class SessionSQL {
public:
    static std::string buildSessionQuerySQL(QueryCondition &condition) {

        std::string sql;
        std::stringstream ss;
        ss << "SELECT * FROM t_sessions";

        std::vector<std::string> conditionList;
        if (!condition.proto.empty()) {
            char buf[100] = {0};
            snprintf(buf, sizeof(buf), "(appProto like '%%%s%%' or transProto like '%%%s%%')", condition.proto.c_str(), condition.proto.c_str());
            conditionList.push_back(buf);
        }
        if (!condition.ip.empty()) {
            char buf[100] = {0};
            snprintf(buf, sizeof(buf), "(ip1='%s' or ip2='%s')", condition.ip.c_str(), condition.ip.c_str());
            conditionList.push_back(buf);
        }
        if (condition.port != 0) {
            char buf[100] = {0};
            snprintf(buf, sizeof(buf), "(ip1Port=%d or ip2Port=%d)", condition.port, condition.port);
            conditionList.push_back(buf);
        }
        if (condition.sessionId != 0) {
            char buf[100] = { 0 };
            snprintf(buf, sizeof(buf), "(sessionId=%d)", condition.sessionId);
            conditionList.push_back(buf);
        }
        if (condition.processId != 0) {
            char buf[100] = { 0 };
            snprintf(buf, sizeof(buf), "(processId=%d)", condition.processId);
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

    static std::string buildSessionQuerySQL_Count(QueryCondition &condition) {
        std::string sql = buildSessionQuerySQL(condition);
        auto pos = sql.find("LIMIT");
        if (pos != std::string::npos) {
            sql = sql.substr(0, pos);
        }
        std::string countSql = "SELECT COUNT(0) FROM (" + sql + ") t_temp;";
        LOG_F(INFO, "[BUILD SQL]: %s", sql.c_str());
        return countSql;
    }

};

#endif //TSHARK_SERVER_SESSION_SQL_HPP
