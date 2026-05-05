#ifndef TSHARK_FILTER_HPP
#define TSHARK_FILTER_HPP
#include <iostream>
#include <fstream>
#include <string>
#include <set>
#include <vector>
#include "third_library/sqlite3/sqlite3.h"
#include "third_library/loguru/loguru.hpp"
#include "process_util.hpp"

class TSharkFilter {

public:
    TSharkFilter() {
        // 打开 SQLite 数据库
        std::string dbPath = ProcessUtil::getExecutableDir() + "tshark_fields.db";
        if (sqlite3_open(dbPath.c_str(), &db) != SQLITE_OK) {
            LOG_F(ERROR, "无法打开数据库(%s): %s", dbPath.c_str(), sqlite3_errmsg(db));
            throw std::runtime_error("filter init failed");
        } else {
            LOG_F(INFO, "打开tshark字段数据库成功: %s", dbPath.c_str());
        }
    }

    // 析构函数，关闭数据库连接
    ~TSharkFilter() {
        if (db) {
            sqlite3_close(db);
        }
    }

    void search(std::string keyword, std::vector<std::string> &results) {
        // 准备查询语句
        sqlite3_stmt* stmt;
        const char* searchSQL = "SELECT field FROM records WHERE field LIKE ? LIMIT 100;";
        if (sqlite3_prepare_v2(db, searchSQL, -1, &stmt, nullptr) != SQLITE_OK) {
            LOG_F(ERROR, "准备 SQL 查询失败: %s", sqlite3_errmsg(db));
            return;
        }

        // 绑定搜索关键字
        std::string likePattern = keyword + "%";
        sqlite3_bind_text(stmt, 1, likePattern.c_str(), -1, SQLITE_TRANSIENT);

        // 执行查询并输出结果
        while (sqlite3_step(stmt) == SQLITE_ROW) {
            const char* result = reinterpret_cast<const char*>(sqlite3_column_text(stmt, 0));
            results.push_back(result);
        }

        // 清理资源
        sqlite3_finalize(stmt);
    }

private:
    sqlite3* db = nullptr;
};

#endif // TSHARK_FILTER_HPP