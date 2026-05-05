
#ifndef TSHARK_SERVER_PACKET_CONTROLLER_HPP
#define TSHARK_SERVER_PACKET_CONTROLLER_HPP
#include "base_controller.hpp"
#include "tshark_translate.hpp"
#include "tshark_filter.hpp"

// 数据包相关的接口
class PacketController : public BaseController {
public:
    PacketController(httplib::Server &server, TSharkManager &tsharkManager)
        :BaseController(server, tsharkManager)
    {
    }

    virtual void registerRoute() {
        __server.Get("/api/getFilterFieldList", [this](const httplib::Request& req, httplib::Response& res) {
            getFilterFieldList(req, res);
        });

        __server.Post("/api/analysisFile", [this](const httplib::Request& req, httplib::Response& res) {
            analysisiFile(req, res);
        });

        __server.Get("/api/getHistoryFileList", [this](const httplib::Request& req, httplib::Response& res) {
            getHistoryFileList(req, res);
        });

        __server.Post("/api/getPacketList", [this](const httplib::Request& req, httplib::Response& res) {
            getPacketList(req, res);
        });

        __server.Post("/api/getPacketDetail", [this](const httplib::Request& req, httplib::Response& res) {
            getPacketDetail(req, res);
        });

        __server.Post("/api/getPacketCountInfo", [this](const httplib::Request& req, httplib::Response& res) {
            getPacketCountInfo(req, res);
        });

        __server.Post("/api/savePacket", [this](const httplib::Request& req, httplib::Response& res) {
            savePacket(req, res);
        });
    }

    // 获取过滤器字段自动提示列表
    void getFilterFieldList(const httplib::Request& req, httplib::Response& res) {
        try {
            std::string keyword = getStringParam(req, "keyword");
            if (keyword.empty()) {
                return sendErrorResponse(res, ERROR_PARAMETER_WRONG);
            }

            std::vector<std::string> fieldList;
            tsharkFilter.search(keyword, fieldList);
            sendDataList(res, fieldList);
        }
        catch (const std::exception& e) {
            // 如果发生异常，返回错误响应
            sendErrorResponse(res, ERROR_INTERNAL_WRONG);
        }
    }

    // 分析离线数据包
    void analysisiFile(const httplib::Request& req, httplib::Response& res) {
        try {
            if (req.body.empty()) {
                return sendErrorResponse(res, ERROR_PARAMETER_WRONG);
            }

            // 检查当前状态是否允许分析文件
            if (__tsharkManager.getWorkStatus() != STATUS_IDLE) {
                return sendErrorResponse(res, ERROR_STATUS_WRONG);
            }

            // 使用 RapidJSON 解析 JSON
            rapidjson::Document doc;
            if (doc.Parse(req.body.c_str()).HasParseError()) {
                return sendErrorResponse(res, ERROR_PARAMETER_WRONG);
            }

            // 提取数据包文件路径
            std::string filePath = doc["filePath"].GetString();
            if (!MiscUtil::fileExists(filePath.c_str())) {
                return sendErrorResponse(res, ERROR_FILE_NOTFOUND);
            }

            // 检查文件大小
            if (MiscUtil::getFileSize(filePath) > MAX_PACKET_PROCESS) {
                return sendErrorResponse(res, ERROR_FILE_TOOLARGE);
            }

            // 开始分析
            if (__tsharkManager.analysisFile(filePath)) {
                sendSuccessResponse(res);
            }
            else {
                sendErrorResponse(res, ERROR_TSHARK_WRONG);
            }
        }
        catch (const std::exception& e) {
            // 如果发生异常，返回错误响应
            sendErrorResponse(res, ERROR_INTERNAL_WRONG);
        }
    }

    // 获得历史分析文件列表
    void getHistoryFileList(const httplib::Request& req, httplib::Response& res) {
        try {
            std::vector<std::string> historyList;
            __tsharkManager.getAnalysisFileHistory(historyList);
            sendDataList(res, historyList);
        }
        catch (const std::exception& e) {
            // 如果发生异常，返回错误响应
            sendErrorResponse(res, ERROR_INTERNAL_WRONG);
        }
    }

    // 获取数据包列表
    void getPacketList(const httplib::Request &req, httplib::Response &res) {

        try {
            QueryCondition queryCondition;
            if (!parseQueryCondition(req, queryCondition)) {
                sendErrorResponse(res, ERROR_PARAMETER_WRONG);
                return;
            }

            // 调用 tSharkManager 的方法获取数据
            std::vector<PacketInfo> packetList;
            int total = 0;
            __tsharkManager.getPacketList(queryCondition, packetList, total);
            sendDataList(res, packetList, total);
        } catch (const std::exception &e) {
            // 如果发生异常，返回错误响应
            sendErrorResponse(res, ERROR_INTERNAL_WRONG);
        }
    }

    // 获取数据包详情
    void getPacketDetail(const httplib::Request &req, httplib::Response &res) {

        try {

            if (req.body.empty()) {
                return sendErrorResponse(res, ERROR_PARAMETER_WRONG);
            }

            // 使用 RapidJSON 解析 JSON
            rapidjson::Document doc;
            if (doc.Parse(req.body.c_str()).HasParseError()) {
                return sendErrorResponse(res, ERROR_PARAMETER_WRONG);
            }

            // 提取数据包编号参数
            uint32_t frameNumber = doc["frameNumber"].GetInt();

            // 获取数据包详情
            rapidjson::Document dataDoc;
            if (!__tsharkManager.getPacketDetailInfo(frameNumber, dataDoc)) {
                return sendErrorResponse(res, ERROR_INTERNAL_WRONG);
            }

            // 字段翻译成中文
            translator.translateShowNameFields(dataDoc["proto"], dataDoc.GetAllocator());

            sendJsonResponse(res, dataDoc);
        } catch (const std::exception &e) {
            // 如果发生异常，返回错误响应
            sendErrorResponse(res, ERROR_PARAMETER_WRONG);
        }
    }

    // 获取数据包统计数据
    void getPacketCountInfo(const httplib::Request& req, httplib::Response& res) {

        try {
            // 提取 URL 查询参数
            QueryCondition queryCondition;
            if (!parseQueryCondition(req, queryCondition)) {
                sendErrorResponse(res, ERROR_PARAMETER_WRONG);
                return;
            }

            // 调用 tSharkManager 的方法获取数据
            CountInfo countInfo = __tsharkManager.getPacketCountInfo(queryCondition);
            sendDataObject(res, countInfo);
        }
        catch (const std::exception& e) {
            // 如果发生异常，返回错误响应
            sendErrorResponse(res, ERROR_INTERNAL_WRONG);
        }
    }

    // 保存当前数据包
    void savePacket(const httplib::Request &req, httplib::Response &res) {

        try {

            if (req.body.empty()) {
                return sendErrorResponse(res, ERROR_PARAMETER_WRONG);
            }

            // 使用 RapidJSON 解析 JSON
            rapidjson::Document doc;
            if (doc.Parse(req.body.c_str()).HasParseError()) {
                return sendErrorResponse(res, ERROR_PARAMETER_WRONG);
            }

            // 提取保存路径和过滤器
            std::string savePath;
            if (doc.HasMember("savePath") && doc["savePath"].IsString()) {
                savePath = doc["savePath"].GetString();
            }
            if (savePath.empty()) {
                return sendErrorResponse(res, ERROR_PARAMETER_WRONG);
            }

            std::string filter;
            if (doc.HasMember("filter") && doc["filter"].IsString()) {
                filter = doc["filter"].GetString();
            }

            bool result = false;
            if (filter.empty()) {
                result = __tsharkManager.savePacket(savePath);
            } else {
                result = __tsharkManager.saveFilterPacket(savePath, filter);
            }

            if (result) {
                sendSuccessResponse(res);
            } else {
                sendErrorResponse(res, ERROR_FILE_SAVE_FAILED);
            }
        } catch (const std::exception &e) {
            // 如果发生异常，返回错误响应
            sendErrorResponse(res, ERROR_PARAMETER_WRONG);
        }
    }

private:
    TSharkTranslator translator;
    TSharkFilter tsharkFilter;
};


#endif //TSHARK_SERVER_PACKET_CONTROLLER_HPP
