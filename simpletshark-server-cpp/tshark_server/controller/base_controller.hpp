
#ifndef TSHARK_SERVER_BASE_CONTROLLER_HPP
#define TSHARK_SERVER_BASE_CONTROLLER_HPP
#include "third_library/httplib/httplib.h"
#include "tshark_datatype.h"
#include "tshark_errorcode.hpp"
#include "tshark_manager.h"
#include <memory>
#include <third_library/rapidjson/document.h>
#include <third_library/rapidjson/writer.h>
#include <third_library/rapidjson/prettywriter.h>
#include <third_library/rapidjson/stringbuffer.h>
#include "pagehelper.h"

// 基类Controller
class BaseController {
public:
    BaseController(httplib::Server &server, TSharkManager &tsharkManager)
        :__server(server)
        ,__tsharkManager(tsharkManager) {
    }
    virtual void registerRoute() = 0;

protected:
    httplib::Server &__server;
    TSharkManager &__tsharkManager;

public:
    // 从URL中提取整数参数
    static int getIntParam(const httplib::Request &req, std::string paramName, int defaultValue = 0) {

        int value = defaultValue;
        auto it = req.params.find(paramName);
        if (it != req.params.end()) {
            value = std::stoi(it->second);
        }
        return value;
    }

    // 从URL中提取字符串参数
    static std::string getStringParam(const httplib::Request &req, std::string paramName, std::string defaultValue = "") {
        std::string value = defaultValue;
        auto it = req.params.find(paramName);
        if (it != req.params.end()) {
            value = it->second;
        }
        return value;
    }

protected:

    // 发送字符串列表数据
    void sendDataList(httplib::Response& res, std::vector<std::string> &stringList) {
        /**
         * 返回数据格式：
         * {
         *     "code": 0,
         *     "msg": "操作成功",
         *     "total": total,
         *     "data" [] / {}
         * }
         */
        rapidjson::Document resDoc;
        rapidjson::Document::AllocatorType& allocator = resDoc.GetAllocator();
        resDoc.SetObject();

        // 添加 "code" 和 "msg"
        resDoc.AddMember("code", ERROR_SUCCESS, allocator);

        std::string msg = TSharkError::getErrorMsg(ERROR_SUCCESS);
        resDoc.AddMember("msg", rapidjson::Value(msg.c_str(), allocator), allocator);

        // 构建 "data" 数组
        rapidjson::Value dataArray(rapidjson::kArrayType);
        for (const auto& str : stringList) {
            rapidjson::Value obj(rapidjson::kStringType);
            obj.SetString(str.c_str(), allocator);
            dataArray.PushBack(obj, allocator);
        }

        resDoc.AddMember("data", dataArray, allocator);

        // 序列化为 JSON 字符串
        rapidjson::StringBuffer buffer;
        rapidjson::Writer<rapidjson::StringBuffer> writer(buffer);
        resDoc.Accept(writer);

        // 设置响应内容
        res.set_content(buffer.GetString(), "application/json");
    }

    // 使用模板的形式返回数据列表
    template<typename Data>
    void sendDataList(httplib::Response &res, std::vector<Data>& dataList, int total) {
        /**
         * 返回数据格式：
         * {
         *     "code": 0,
         *     "msg": "操作成功",
         *     "total": total,
         *     "data" [] / {}
         * }
         */
        rapidjson::Document resDoc;
        rapidjson::Document::AllocatorType& allocator = resDoc.GetAllocator();
        resDoc.SetObject();

        // 添加 "code" 和 "msg"
        resDoc.AddMember("code", ERROR_SUCCESS, allocator);
        resDoc.AddMember("msg", rapidjson::Value(TSharkError::getErrorMsg(ERROR_SUCCESS).c_str(), allocator), allocator);

        // 添加 "total"
        resDoc.AddMember("total", total, allocator);

        // 构建 "data" 数组
        rapidjson::Value dataArray(rapidjson::kArrayType);
        for (const auto& data : dataList) {
            rapidjson::Value obj(rapidjson::kObjectType);
            data.toJsonObj(obj, allocator);
            assert(obj.IsObject());
            dataArray.PushBack(obj, allocator);
        }

        resDoc.AddMember("data", dataArray, allocator);

        // 序列化为 JSON 字符串
        rapidjson::StringBuffer buffer;
        rapidjson::Writer<rapidjson::StringBuffer> writer(buffer);
        resDoc.Accept(writer);

        // 设置响应内容
        res.set_content(buffer.GetString(), "application/json");
    }


    // 使用模板的形式返回数据对象
    template<typename Data>
    void sendDataObject(httplib::Response& res, Data& data) {
        /**
         * 返回数据格式：
         * {
         *     "code": 0,
         *     "msg": "操作成功",
         *     "total": total,
         *     "data" {}
         * }
         */
        rapidjson::Document resDoc;
        rapidjson::Document::AllocatorType& allocator = resDoc.GetAllocator();
        resDoc.SetObject();

        // 添加 "code" 和 "msg"
        resDoc.AddMember("code", ERROR_SUCCESS, allocator);
        resDoc.AddMember("msg", rapidjson::Value(TSharkError::getErrorMsg(ERROR_SUCCESS).c_str(), allocator), allocator);

        // 构建 "data" 对象
        rapidjson::Value dataObject(rapidjson::kObjectType);
        data.toJsonObj(dataObject, allocator);
        resDoc.AddMember("data", dataObject, allocator);

        // 序列化为 JSON 字符串
        rapidjson::StringBuffer buffer;
        rapidjson::Writer<rapidjson::StringBuffer> writer(buffer);
        resDoc.Accept(writer);

        // 设置响应内容
        res.set_content(buffer.GetString(), "application/json");
    }

    // 成功响应，返回JSON内容
    void sendJsonResponse(httplib::Response &res, rapidjson::Document& dataDoc) {
        /**
         * 返回数据格式：
         * {
         *     "code": 0,
         *     "msg": "操作成功",
         *     "data" [] / {}
         * }
         */
        rapidjson::Document resDoc;
        rapidjson::Document::AllocatorType& allocator = resDoc.GetAllocator();
        resDoc.SetObject();
        resDoc.AddMember("code", ERROR_SUCCESS, allocator);
        resDoc.AddMember("msg", rapidjson::Value(TSharkError::getErrorMsg(ERROR_SUCCESS).c_str(), allocator), allocator);
        resDoc.AddMember("data", dataDoc, allocator);

        rapidjson::StringBuffer buffer;
        rapidjson::Writer<rapidjson::StringBuffer> writer(buffer);
        resDoc.Accept(writer);

        res.set_content(buffer.GetString(), "application/json");
    }

    // 返回成功响应，但没有数据
    void sendSuccessResponse(httplib::Response& res) {
        rapidjson::Document resDoc;
        rapidjson::Document::AllocatorType& allocator = resDoc.GetAllocator();
        resDoc.SetObject();
        resDoc.AddMember("code", 0, allocator);
        resDoc.AddMember("msg", rapidjson::Value(TSharkError::getErrorMsg(ERROR_SUCCESS).c_str(), allocator), allocator);

        rapidjson::StringBuffer buffer;
        rapidjson::Writer<rapidjson::StringBuffer> writer(buffer);
        resDoc.Accept(writer);

        res.set_content(buffer.GetString(), "application/json");
    }


    // 发生错误响应
    void sendErrorResponse(httplib::Response &res, int errorCode) {
        rapidjson::Document resDoc;
        rapidjson::Document::AllocatorType& allocator = resDoc.GetAllocator();
        resDoc.SetObject();
        resDoc.AddMember("code", errorCode, allocator);
        resDoc.AddMember("msg", rapidjson::Value(TSharkError::getErrorMsg(errorCode).c_str(), allocator), allocator);

        rapidjson::StringBuffer buffer;
        rapidjson::Writer<rapidjson::StringBuffer> writer(buffer);
        resDoc.Accept(writer);

        res.set_content(buffer.GetString(), "application/json");
    }

    // 提取请求中的参数
    bool parseQueryCondition(const httplib::Request& req, QueryCondition &queryCondition) {

        try {

            // 检查是否有 body 数据
            if (req.body.empty()) {
                throw std::runtime_error("Request body is empty");
            }

            // 使用 RapidJSON 解析 JSON
            rapidjson::Document doc;
            if (doc.Parse(req.body.c_str()).HasParseError()) {
                throw std::runtime_error("Failed to parse JSON");
            }

            // 验证是否是 JSON 对象
            if (!doc.IsObject()) {
                throw std::runtime_error("Invalid JSON format, expected an object");
            }

            // 提取字段并赋值到 QueryCondition 中
            if (doc.HasMember("ip") && doc["ip"].IsString()) {
                queryCondition.ip = doc["ip"].GetString();
            }

            if (doc.HasMember("port") && doc["port"].IsUint()) {
                queryCondition.port = static_cast<uint16_t>(doc["port"].GetUint());
            }

            if (doc.HasMember("proto") && doc["proto"].IsString()) {
                queryCondition.proto = doc["proto"].GetString();
            }

            if (doc.HasMember("domain") && doc["domain"].IsString()) {
                queryCondition.domain = doc["domain"].GetString();
            }

            if (doc.HasMember("country") && doc["country"].IsString()) {
                queryCondition.country = doc["country"].GetString();
            }

            if (doc.HasMember("processId") && doc["processId"].IsInt()) {
                queryCondition.processId = doc["processId"].GetInt();
            }

            if (doc.HasMember("sessionId") && doc["sessionId"].IsInt()) {
                queryCondition.sessionId = doc["sessionId"].GetInt();
            }

            if (doc.HasMember("filter") && doc["filter"].IsString()) {
                queryCondition.filter = doc["filter"].GetString();
            }
        } catch (std::exception &) {
            std::cout << "parse parameter error" << std::endl;
            return false;
        }

        return true;
    }
};



#endif //TSHARK_SERVER_PACKET_CONTROLLER_HPP
