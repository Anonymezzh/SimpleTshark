
#ifndef DATABASE_H
#define DATABASE_H

#include <iostream>
#include <list>
#include <string>
#include <sstream>
#include "third_library/sqlite3/sqlite3.h"
#include <stdexcept>
#include "tshark_datatype.h"
#include "misc_util.hpp"
#include "sql/packet_sql.hpp"
#include "sql/session_sql.hpp"
#include "sql/stats_sql.hpp"
#include <unordered_set>
#include "pagehelper.h"
#include "third_library/loguru/loguru.hpp"

// 数据库类
class Database {
public:
    // 构造函数，初始化数据库并创建表
    Database(const std::string &dbName) {
        // 打开数据库连接
        if (sqlite3_open(dbName.c_str(), &db) != SQLITE_OK) {
            LOG_F(ERROR, "Failed to open database");
            throw std::runtime_error("Failed to open database");
        }

        createPacketTable();
        createFilterPacketTable();
        createSessionTable();
    }

    // 析构函数，关闭数据库连接
    ~Database() {
        if (db) {
            sqlite3_close(db);
        }
    }

    // 清空过滤数据包表
    void clearFilterPacketTable() {
        // 清空表
        const char *sql = "DELETE FROM t_packets_filter;";
        sqlite3_exec(db, sql, nullptr, nullptr, nullptr);
    }


    // 存储数据包信息到表中
    void storePackets(std::unordered_set<std::shared_ptr<PacketInfo>>& packets, bool hasFilter) {
        //std::cout << "enter storePacketList, packets size: " << packets.size() << std::endl;

        // 开启事务
        sqlite3_exec(db, "BEGIN TRANSACTION;", nullptr, nullptr, nullptr);

        // SQL 插入语句
        std::string insertSQL;
        if (hasFilter) {
            insertSQL = R"(
                INSERT INTO t_packets_filter (
                    frameNumber, timestamp, srcMac, dstMac, srcIP, srcLocation, srcPort,
                    dstIP, dstLocation, dstPort, frameLength, capLength,
                    transProtoNumber, protocol, info, fileOffset, belongSessionId
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            )";
        } else {
            insertSQL =  R"(
                INSERT INTO t_packets (
                    frameNumber, timestamp, srcMac, dstMac, srcIP, srcLocation, srcPort,
                    dstIP, dstLocation, dstPort, frameLength, capLength,
                    transProtoNumber, protocol, info, fileOffset, belongSessionId
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
            )";
        }

        sqlite3_stmt* stmt;
        if (sqlite3_prepare_v2(db, insertSQL.c_str(), -1, &stmt, nullptr) != SQLITE_OK) {
            throw std::runtime_error("Failed to prepare insert statement");
        }

        // 遍历列表并插入数据
        for (const auto& packet : packets) {
            sqlite3_bind_int(stmt, 1, packet->frameNumber);
            sqlite3_bind_double(stmt, 2, packet->timestamp);
            sqlite3_bind_text(stmt, 3, packet->srcMac.c_str(), -1, SQLITE_STATIC);
            sqlite3_bind_text(stmt, 4, packet->dstMac.c_str(), -1, SQLITE_STATIC);
            sqlite3_bind_text(stmt, 5, packet->srcIP.c_str(), -1, SQLITE_STATIC);
            sqlite3_bind_text(stmt, 6, packet->srcLocation.c_str(), -1, SQLITE_STATIC);
            sqlite3_bind_int(stmt, 7, packet->srcPort);
            sqlite3_bind_text(stmt, 8, packet->dstIP.c_str(), -1, SQLITE_STATIC);
            sqlite3_bind_text(stmt, 9, packet->dstLocation.c_str(), -1, SQLITE_STATIC);
            sqlite3_bind_int(stmt, 10, packet->dstPort);
            sqlite3_bind_int(stmt, 11, packet->frameLength);
            sqlite3_bind_int(stmt, 12, packet->capLength);
            sqlite3_bind_int(stmt, 13, packet->transProtoNumber);
            sqlite3_bind_text(stmt, 14, packet->protocol.c_str(), -1, SQLITE_STATIC);
            sqlite3_bind_text(stmt, 15, packet->info.c_str(), -1, SQLITE_STATIC);
            sqlite3_bind_int(stmt, 16, packet->fileOffset);
            sqlite3_bind_int(stmt, 17, packet->belongSessionId);

            int res = sqlite3_step(stmt);
            if (res != SQLITE_DONE) {
                LOG_F(ERROR, "数据插入失败，返回值: %d", res);
                throw std::runtime_error("Failed to execute insert statement");
            }

            sqlite3_reset(stmt); // 重置语句以便下一次绑定
        }

        // 结束事务
        sqlite3_exec(db, "COMMIT;", nullptr, nullptr, nullptr);

        // 释放语句
        sqlite3_finalize(stmt);
    }

    // 存储会话信息到表中
    void storeAndUpdateSessions(std::unordered_set<std::shared_ptr<SessionInfo>>& sessions) {

        //std::cout << "enter storeAndUpdateSessionList, sessions size: " << sessions.size() << std::endl;

        // 开启事务
        sqlite3_exec(db, "BEGIN TRANSACTION;", nullptr, nullptr, nullptr);

        // SQL UPSERT 语句
        std::string upsertSQL = R"(
            INSERT INTO t_sessions (
                sessionId, ip1, ip1Location, ip1Port, ip2, ip2Location, ip2Port,
                transProto, appProto, startTime, endTime,
                ip1SendPacketsCount, ip1SendBytesCount, ip2SendPacketsCount, ip2SendBytesCount,
                packetCount, totalBytes, remark, streamId, processId
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(sessionId) DO UPDATE SET
                transProto = excluded.transProto,
                appProto = excluded.appProto,
                startTime = excluded.startTime,
                endTime = excluded.endTime,
                ip1SendPacketsCount = excluded.ip1SendPacketsCount,
                ip1SendBytesCount = excluded.ip1SendBytesCount,
                ip2SendPacketsCount = excluded.ip2SendPacketsCount,
                ip2SendBytesCount = excluded.ip2SendBytesCount,
                packetCount = excluded.packetCount,
                totalBytes = excluded.totalBytes,
                remark = excluded.remark,
                streamId = excluded.streamId,
                processId = excluded.processId;
        )";

        sqlite3_stmt* stmt;
        if (sqlite3_prepare_v2(db, upsertSQL.c_str(), -1, &stmt, nullptr) != SQLITE_OK) {
            throw std::runtime_error("Failed to prepare UPSERT statement");
        }

        // 遍历列表并插入或更新数据
        for (const auto& session : sessions) {
            sqlite3_bind_int(stmt, 1, session->sessionId);
            sqlite3_bind_text(stmt, 2, session->ip1.c_str(), -1, SQLITE_STATIC);
            sqlite3_bind_text(stmt, 3, session->ip1Location.c_str(), -1, SQLITE_STATIC);
            sqlite3_bind_int(stmt, 4, session->ip1Port);
            sqlite3_bind_text(stmt, 5, session->ip2.c_str(), -1, SQLITE_STATIC);
            sqlite3_bind_text(stmt, 6, session->ip2Location.c_str(), -1, SQLITE_STATIC);
            sqlite3_bind_int(stmt, 7, session->ip2Port);
            sqlite3_bind_text(stmt, 8, session->transProto.c_str(), -1, SQLITE_STATIC);
            sqlite3_bind_text(stmt, 9, session->appProto.c_str(), -1, SQLITE_STATIC);
            sqlite3_bind_double(stmt, 10, session->startTime);
            sqlite3_bind_double(stmt, 11, session->endTime);
            sqlite3_bind_int(stmt, 12, session->ip1SendPacketsCount);
            sqlite3_bind_int(stmt, 13, session->ip1SendBytesCount);
            sqlite3_bind_int(stmt, 14, session->ip2SendPacketsCount);
            sqlite3_bind_int(stmt, 15, session->ip2SendBytesCount);
            sqlite3_bind_int(stmt, 16, session->packetCount);
            sqlite3_bind_int(stmt, 17, session->totalBytes);
            sqlite3_bind_text(stmt, 18, session->remark.c_str(), -1, SQLITE_STATIC);
            sqlite3_bind_int(stmt, 19, session->streamId);
            sqlite3_bind_int(stmt, 20, session->processInfo ? session->processInfo->processId : 0);

            if (sqlite3_step(stmt) != SQLITE_DONE) {
                throw std::runtime_error("Failed to execute UPSERT statement");
            }

            sqlite3_reset(stmt); // 重置语句以便下一次绑定
        }

        // 结束事务
        sqlite3_exec(db, "COMMIT;", nullptr, nullptr, nullptr);

        // 释放语句
        sqlite3_finalize(stmt);
    }

    // 查询数据包统计信息
    CountInfo queryPacketCountInfo(QueryCondition &condition) {
        sqlite3_stmt* stmt = nullptr;
        std::string sql = PacketSQL::buildPacketCountSQL(condition);
        CountInfo countInfo;

        // 准备 SQL 查询
        if (sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr) != SQLITE_OK) {
            return countInfo;
        }

        // 执行查询并获取结果
        if (sqlite3_step(stmt) == SQLITE_ROW) {
            countInfo.totalPackets = sqlite3_column_int(stmt, 0);
            countInfo.totalBytes = sqlite3_column_int(stmt, 1);
        }

        // 清理资源
        sqlite3_finalize(stmt);

        return countInfo;
    }

    // 从数据库查询数据包分页数据
    bool queryPackets(QueryCondition &condition, std::vector<PacketInfo>& packetList, int &total) {
        sqlite3_stmt *stmt = nullptr, *countStmt = nullptr;
        std::string sql = PacketSQL::buildPacketQuerySQL(condition);
        if (sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr) != SQLITE_OK) {
            std::cout << "Failed to prepare statement: " << sqlite3_errmsg(db) << std::endl;
            return false;
        }

        while (sqlite3_step(stmt) == SQLITE_ROW) {
            PacketInfo packet;
            packet.frameNumber = sqlite3_column_int(stmt, 0);
            packet.timestamp = sqlite3_column_double(stmt, 1);
            packet.srcMac = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 2));
            packet.dstMac = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 3));
            packet.srcIP = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 4));
            packet.srcLocation = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 5));
            packet.srcPort = sqlite3_column_int(stmt, 6);
            packet.dstIP = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 7));
            packet.dstLocation = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 8));
            packet.dstPort = sqlite3_column_int(stmt, 9);
            packet.frameLength = sqlite3_column_int(stmt, 10);
            packet.capLength = sqlite3_column_int(stmt, 11);
            packet.transProtoNumber = sqlite3_column_int(stmt, 12);
            packet.protocol = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 13));
            packet.info = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 14));
            packet.fileOffset = sqlite3_column_int(stmt, 15);
            packet.belongSessionId = sqlite3_column_int(stmt, 16);
            packetList.push_back(packet);
        }

        sqlite3_finalize(stmt);

        // 再查询总数total
        sql = PacketSQL::buildPacketQuerySQL_Count(condition);
        if (sqlite3_prepare_v2(db, sql.c_str(), -1, &countStmt, nullptr) != SQLITE_OK) {
            std::cout << "Failed to prepare statement: " << sqlite3_errmsg(db) << std::endl;
            return false;
        }
        // 执行查询并获取结果
        if (sqlite3_step(countStmt) == SQLITE_ROW) {
            total = sqlite3_column_int(countStmt, 0);
        }

        sqlite3_finalize(countStmt);
        return true;
    }


    // 从数据库查询会话分页数据
    bool querySessions(QueryCondition &condition, std::vector<SessionInfo> &sessionList, int &total) {
        sqlite3_stmt *stmt = nullptr, *countStmt = nullptr;
        std::string sql = SessionSQL::buildSessionQuerySQL(condition);

        if (sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr) != SQLITE_OK) {
            std::cout << "Failed to prepare statement: " << sqlite3_errmsg(db) << std::endl;
            return false;
        }

        while (sqlite3_step(stmt) == SQLITE_ROW) {
            SessionInfo session;
            session.sessionId = sqlite3_column_int(stmt, 0);
            session.ip1 = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1));
            session.ip1Port = sqlite3_column_int(stmt, 2);
            session.ip1Location = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 3));
            session.ip2 = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 4));
            session.ip2Port = sqlite3_column_int(stmt, 5);
            session.ip2Location = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 6));
            session.transProto = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 7));
            session.appProto = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 8));
            session.startTime = sqlite3_column_double(stmt, 9);
            session.endTime = sqlite3_column_double(stmt, 10);
            session.ip1SendPacketsCount = sqlite3_column_int(stmt, 11);
            session.ip1SendBytesCount = sqlite3_column_int(stmt, 12);
            session.ip2SendPacketsCount = sqlite3_column_int(stmt, 13);
            session.ip2SendBytesCount = sqlite3_column_int(stmt, 14);
            session.packetCount = sqlite3_column_int(stmt, 15);
            session.totalBytes = sqlite3_column_int(stmt, 16);
            session.remark = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 17));
            session.streamId = sqlite3_column_int(stmt, 18);
            session.processInfo = std::make_shared<ProcessInfo>();
            session.processInfo->processId = sqlite3_column_int(stmt, 19);

            sessionList.push_back(session);
        }

        sqlite3_finalize(stmt);

        // 再查询总数total
        sql = SessionSQL::buildSessionQuerySQL_Count(condition);
        if (sqlite3_prepare_v2(db, sql.c_str(), -1, &countStmt, nullptr) != SQLITE_OK) {
            std::cout << "Failed to prepare statement: " << sqlite3_errmsg(db) << std::endl;
            return false;
        }
        // 执行查询并获取结果
        if (sqlite3_step(countStmt) == SQLITE_ROW) {
            total = sqlite3_column_int(countStmt, 0);
        }

        sqlite3_finalize(countStmt);
        return true;
    }

    // IP统计查询-查询列表数据
    bool queryIPStats(QueryCondition &condition, std::vector<IPStatsInfo> &ipStatsList, int &total) {

        sqlite3_stmt *stmt = nullptr, *countStmt = nullptr;
        std::string sql = StatsSQL::buildIPStatsQuerySQL(condition);
        if (sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr) != SQLITE_OK) {
            std::cout << "Failed to prepare statement: " << sqlite3_errmsg(db) << std::endl;
            return false;
        }

        // 执行查询并输出结果
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            IPStatsInfo ipStatsInfo;
            ipStatsInfo.ip = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
            ipStatsInfo.location = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 1));
            ipStatsInfo.earliestTime = sqlite3_column_double(stmt, 2);
            ipStatsInfo.latestTime = sqlite3_column_double(stmt, 3);
            // 处理ports
            std::string portsStr(reinterpret_cast<const char*>(sqlite3_column_text(stmt, 4)));
            auto portVecStr = MiscUtil::splitString(portsStr, ',');
            ipStatsInfo.ports = MiscUtil::toIntVector(portVecStr);

            // 处理transProtos和appProtos
            std::string transProtosStr(reinterpret_cast<const char*>(sqlite3_column_text(stmt, 5)));
            std::string appProtosStr(reinterpret_cast<const char*>(sqlite3_column_text(stmt, 6)));
            ipStatsInfo.protocols = MiscUtil::splitString(transProtosStr + "," + appProtosStr, ',');

            ipStatsInfo.totalSentPackets = sqlite3_column_int(stmt, 7);
            ipStatsInfo.totalSentBytes = sqlite3_column_int(stmt, 8);
            ipStatsInfo.totalRecvPackets = sqlite3_column_int(stmt, 9);
            ipStatsInfo.totalRecvBytes = sqlite3_column_int(stmt, 10);
            ipStatsInfo.tcpSessionCount = sqlite3_column_int(stmt, 11);
            ipStatsInfo.udpSessionCount = sqlite3_column_int(stmt, 12);

            ipStatsList.push_back(ipStatsInfo);
        }

        sqlite3_finalize(stmt);

        // 再查询总数total
        sql = StatsSQL::buildIPStatsQuerySQL_Count(condition);
        if (sqlite3_prepare_v2(db, sql.c_str(), -1, &countStmt, nullptr) != SQLITE_OK) {
            std::cout << "Failed to prepare statement: " << sqlite3_errmsg(db) << std::endl;
            return false;
        }
        // 执行查询并获取结果
        if (sqlite3_step(countStmt) == SQLITE_ROW) {
            total = sqlite3_column_int(countStmt, 0);
        }

        sqlite3_finalize(countStmt);
        return true;
    }

    // 协议统计查询-查询列表数据
    bool queryProtoStats(QueryCondition &condition, std::vector<ProtoStatsInfo> &protoStatsList, int &total) {

        sqlite3_stmt *stmt = nullptr, *countStmt = nullptr;
        std::string sql = StatsSQL::buildProtoStatsQuerySQL(condition);
        if (sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr) != SQLITE_OK) {
            std::cout << "Failed to prepare statement: " << sqlite3_errmsg(db) << std::endl;
            return false;
        }

        // 执行查询并输出结果
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            ProtoStatsInfo protoStatsInfo;
            protoStatsInfo.proto = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
            protoStatsInfo.totalPackets = sqlite3_column_int(stmt, 1);
            protoStatsInfo.totalBytes = sqlite3_column_int(stmt, 2);
            protoStatsInfo.sessionCount = sqlite3_column_int(stmt, 3);

            protoStatsList.push_back(protoStatsInfo);
        }

        sqlite3_finalize(stmt);

        // 再查询总数total
        sql = StatsSQL::buildProtoStatsQuerySQL_Count(condition);
        if (sqlite3_prepare_v2(db, sql.c_str(), -1, &countStmt, nullptr) != SQLITE_OK) {
            std::cout << "Failed to prepare statement: " << sqlite3_errmsg(db) << std::endl;
            return false;
        }
        // 执行查询并获取结果
        if (sqlite3_step(countStmt) == SQLITE_ROW) {
            total = sqlite3_column_int(countStmt, 0);
        }

        sqlite3_finalize(countStmt);
        return true;
    }


    // 国家统计查询-查询列表数据
    bool queryCountryStats(QueryCondition& condition, std::vector<CountryStatsInfo>& countryStatsList, int& total) {

        sqlite3_stmt* stmt = nullptr, * countStmt = nullptr;
        std::string sql = StatsSQL::buildCountryStatsQuerySQL(condition);
        if (sqlite3_prepare_v2(db, sql.c_str(), -1, &stmt, nullptr) != SQLITE_OK) {
            std::cout << "Failed to prepare statement: " << sqlite3_errmsg(db) << std::endl;
            return false;
        }

        // 执行查询并输出结果
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            CountryStatsInfo countryStatsInfo;
            countryStatsInfo.country = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
            countryStatsInfo.ipCount = sqlite3_column_int(stmt, 1);
            countryStatsInfo.totalPackets = sqlite3_column_int(stmt, 2);
            countryStatsInfo.totalBytes = sqlite3_column_int(stmt, 3);
            countryStatsInfo.sessionCount = sqlite3_column_int(stmt, 4);

            if (countryStatsInfo.country.empty()) {
                countryStatsInfo.country = "未知";
            }

            countryStatsList.push_back(countryStatsInfo);
        }

        sqlite3_finalize(stmt);

        // 再查询总数total
        sql = StatsSQL::buildCountryStatsQuerySQL_Count(condition);
        if (sqlite3_prepare_v2(db, sql.c_str(), -1, &countStmt, nullptr) != SQLITE_OK) {
            std::cout << "Failed to prepare statement: " << sqlite3_errmsg(db) << std::endl;
            return false;
        }
        // 执行查询并获取结果
        if (sqlite3_step(countStmt) == SQLITE_ROW) {
            total = sqlite3_column_int(countStmt, 0);
        }

        sqlite3_finalize(countStmt);
        return true;
    }

private:

    // 创建数据包的表
    void createPacketTable() {
        // 检查表是否存在，若不存在则创建
        std::string createTableSQL = R"(
            CREATE TABLE IF NOT EXISTS t_packets (
                frameNumber INTEGER PRIMARY KEY,
                timestamp REAL,
                srcMac TEXT,
                dstMac TEXT,
                srcIP TEXT,
                srcLocation TEXT,
                srcPort INTEGER,
                dstIP TEXT,
                dstLocation TEXT,
                dstPort INTEGER,
                frameLength INTEGER,
                capLength INTEGER,
                transProtoNumber INTEGER,
                protocol TEXT,
                info TEXT,
                fileOffset INTEGER,
                belongSessionId INTEGER
            );
        )";

        if (sqlite3_exec(db, createTableSQL.c_str(), nullptr, nullptr, nullptr) != SQLITE_OK) {
            throw std::runtime_error("Failed to create table t_packets");
        }

        // 清空表数据
        std::string clearTableSQL = "DELETE FROM t_packets;";
        if (sqlite3_exec(db, clearTableSQL.c_str(), nullptr, nullptr, nullptr) != SQLITE_OK) {
            throw std::runtime_error("Failed to clear table t_packets");
        }
    }

    // 创建带过滤器的数据包的表
    void createFilterPacketTable() {
        // 检查表是否存在，若不存在则创建
        std::string createTableSQL = R"(
            CREATE TABLE IF NOT EXISTS t_packets_filter (
                frameNumber INTEGER PRIMARY KEY,
                timestamp REAL,
                srcMac TEXT,
                dstMac TEXT,
                srcIP TEXT,
                srcLocation TEXT,
                srcPort INTEGER,
                dstIP TEXT,
                dstLocation TEXT,
                dstPort INTEGER,
                frameLength INTEGER,
                capLength INTEGER,
                transProtoNumber INTEGER,
                protocol TEXT,
                info TEXT,
                fileOffset INTEGER,
                belongSessionId INTEGER
            );
        )";

        if (sqlite3_exec(db, createTableSQL.c_str(), nullptr, nullptr, nullptr) != SQLITE_OK) {
            throw std::runtime_error("Failed to create table t_packets");
        }

        // 清空表数据
        std::string clearTableSQL = "DELETE FROM t_packets;";
        if (sqlite3_exec(db, clearTableSQL.c_str(), nullptr, nullptr, nullptr) != SQLITE_OK) {
            throw std::runtime_error("Failed to clear table t_packets");
        }
    }

    // 创建会话表
    void createSessionTable() {
        // 检查表是否存在，若不存在则创建
        std::string createTableSQL = R"(
            CREATE TABLE IF NOT EXISTS t_sessions (
                sessionId INTEGER PRIMARY KEY,
                ip1 TEXT,
                ip1Port INTEGER,
                ip1Location TEXT,
                ip2 TEXT,
                ip2Port INTEGER,
                ip2Location TEXT,
                transProto TEXT,
                appProto TEXT,
                startTime REAL,
                endTime REAL,
                ip1SendPacketsCount INTEGER,
                ip1SendBytesCount INTEGER,
                ip2SendPacketsCount INTEGER,
                ip2SendBytesCount INTEGER,
                packetCount INTEGER,
                totalBytes INTEGER,
                remark TEXT,
                streamId INTEGER,
                processId INTEGER
            );
        )";

        if (sqlite3_exec(db, createTableSQL.c_str(), nullptr, nullptr, nullptr) != SQLITE_OK) {
            throw std::runtime_error("Failed to create table t_sessions");
        }

        // 清空表数据
        std::string clearTableSQL = "DELETE FROM t_sessions;";
        if (sqlite3_exec(db, clearTableSQL.c_str(), nullptr, nullptr, nullptr) != SQLITE_OK) {
            throw std::runtime_error("Failed to clear table t_sessions");
        }
    }

private:
    sqlite3* db = nullptr; // SQLite 数据库连接
};


#endif //DATABASE_H
