
#ifndef TSHARK_SERVER_PROCESS_CONTROLLER_HPP
#define TSHARK_SERVER_PROCESS_CONTROLLER_HPP
#include "base_controller.hpp"

// 进程分析相关的接口
class ProcessController : public BaseController {
public:
    ProcessController(httplib::Server &server, TSharkManager &tsharkManager)
        :BaseController(server, tsharkManager)
    {
    }

    virtual void registerRoute() {

        __server.Get("/api/getProcessList", [this](const httplib::Request& req, httplib::Response& res) {
            getProcessList(req, res);
        });
    }

    // 获取会话列表
    void getProcessList(const httplib::Request &req, httplib::Response &res) {

        try {
            std::set<std::shared_ptr<ProcessInfo>> processSet;
            __tsharkManager.getProcessList(processSet);

            Document doc;
            doc.SetObject();
            Document::AllocatorType& allocator = doc.GetAllocator();

            // 构建进程树（可能多个根节点）
            auto roots = buildProcessTree(processSet);

            if (!roots.empty()) {
                Value rootsArray(kArrayType);
                processForestToJson(roots, rootsArray, allocator);
                doc.AddMember("processTree", rootsArray, allocator);
            }
            else {
                doc.AddMember("processTree", Value(kNullType), allocator);
            }

            sendJsonResponse(res, doc);
        } catch (const std::exception &e) {
            // 如果发生异常，返回错误响应
            sendErrorResponse(res, ERROR_INTERNAL_WRONG);
        }
    }

private:

    // 树节点结构，包含进程信息和子节点
    struct ProcessTreeNode {
        std::shared_ptr<ProcessInfo> process;
        std::vector<std::shared_ptr<ProcessTreeNode>> children;
    };

    // 构建进程树，返回所有根节点
    std::vector<std::shared_ptr<ProcessTreeNode>> buildProcessTree(const std::set<std::shared_ptr<ProcessInfo>>& processSet) {
        std::unordered_map<uint32_t, std::shared_ptr<ProcessTreeNode>> processMap;
        std::vector<std::shared_ptr<ProcessTreeNode>> roots;

        // 第一遍：创建所有节点
        for (const auto& process : processSet) {
            auto node = std::make_shared<ProcessTreeNode>();
            node->process = process;
            processMap[process->processId] = node;
        }

        // 第二遍：构建树结构
        for (const auto& pair : processMap) {
            auto node = pair.second;
            uint32_t parentId = node->process->parentProcessId;

            if (processMap.find(parentId) != processMap.end()) {
                processMap[parentId]->children.push_back(node);
            }
            else {
                roots.push_back(node);
            }
        }

        // 对根节点按processId排序
        std::sort(roots.begin(), roots.end(),
            [](const auto& a, const auto& b) {
                return a->process->processId < b->process->processId;
            });

        return roots;
    }

    // 递归转换单个节点及其子树为JSON
    void treeNodeToJson(const std::shared_ptr<ProcessTreeNode>& node, Value& jsonNode, Document::AllocatorType& allocator) {
        if (!node) return;

        // 创建当前节点的JSON对象
        node->process->toJsonObj(jsonNode, allocator);

        // 如果有子节点，添加children数组
        if (!node->children.empty()) {
            Value childrenArray(kArrayType);
            for (const auto& child : node->children) {
                Value childObj(kObjectType);
                treeNodeToJson(child, childObj, allocator);
                childrenArray.PushBack(childObj, allocator);
            }
            jsonNode.AddMember("children", childrenArray, allocator);
        }
    }

    // 将进程树列表转换为JSON数组
    void processForestToJson(const std::vector<std::shared_ptr<ProcessTreeNode>>& roots, Value& jsonArray, Document::AllocatorType& allocator) {
        jsonArray.SetArray();
        for (const auto& root : roots) {
            Value rootObj(kObjectType);
            treeNodeToJson(root, rootObj, allocator);
            jsonArray.PushBack(rootObj, allocator);
        }
    }
};

#endif //TSHARK_SERVER_PROCESS_CONTROLLER_HPP
