#if defined(__unix__) || defined(__APPLE__)
#include <unistd.h>
#endif
#include <iostream>
#include <vector>
#include "tshark_manager.h"
#include "misc_util.hpp"
#include "third_library/ip2region/ip2region_util.h"
#include "third_library/httplib/httplib.h"
#include "third_library/loguru/loguru.hpp"
#include "tshark_api.hpp"
#include "guid_util.hpp"
#include "tshark_crash_handler.hpp"

void InitLog(int argc, char* argv[]) {
    // 初始化 Loguru
    loguru::init(argc, argv);

    // 设置日志文件路径
    loguru::add_file(MiscUtil::getLogNameByCurrentTimestamp().c_str(), loguru::Append, loguru::Verbosity_MAX);
}

TSharkManager* g_managerPtr = nullptr;


#ifdef _WIN32
// Windows异常处理函数
LONG WINAPI CrashHandler_Win(EXCEPTION_POINTERS* pExceptionPointers) {

    LOG_F(ERROR, "程序发生了异常:%d，即将退出", pExceptionPointers->ExceptionRecord->ExceptionCode);

    //TsharkCrashHandler::WriteCoreDump();

    // 崩溃时，将子进程都关闭
    ProcessUtil::KillAll("tshark.exe");
    ProcessUtil::KillAll("dumpcap.exe");

    _exit(1);

    return EXCEPTION_EXECUTE_HANDLER;
}
#else
// 信号处理函数（只允许调用异步信号安全的函数）
void CrashHandler_Unix(int signum) {

    LOG_F(ERROR, "程序发生了异常:%d，即将退出", signum);

    // 等待调试器介入
    std::this_thread::sleep_for(std::chrono::seconds(60));

    // 生成dump文件
    TsharkCrashHandler::WriteCoreDump();

    // 崩溃时，将子进程都关闭
    ProcessUtil::KillAll("tshark");
    ProcessUtil::KillAll("dumpcap");

    // 直接退出，不调用标准库函数
    _exit(1);
}

void SetupSignalHandlers() {
    struct sigaction sa;
    memset(&sa, 0, sizeof(sa));
    sa.sa_handler = CrashHandler_Unix;
    sigemptyset(&sa.sa_mask);

    // 注册几个常见的致命信号
    sigaction(SIGSEGV, &sa, NULL);
    sigaction(SIGABRT, &sa, NULL);
    sigaction(SIGFPE,  &sa, NULL);
    sigaction(SIGBUS,  &sa, NULL);
    sigaction(SIGTERM,  &sa, NULL);
    sigaction(SIGSTOP,  &sa, NULL);

    // 处理SIGCHLD消息，防止子进程变成僵尸进程
    signal(SIGCHLD, [](int signum) {
        int status;
        while (waitpid(-1, &status, WNOHANG) > 0);
    });
}

#endif

int main(int argc, char* argv[]) {

    setlocale(LC_ALL, "zh_CN.UTF8");
    InitLog(argc, argv);

    // 单例检查
    if (!ProcessUtil::IsSingleton()) {
        LOG_F(ERROR, "目前只支持同时运行一个SimpleTshark程序");
        return 0;
    }

#ifdef _WIN32
    SetUnhandledExceptionFilter(CrashHandler_Win);
#else
    // 安装信号处理函数，当进程异常退出时，让相关子进程也能退出
    SetupSignalHandlers();
#endif

    // 提取命令行参数：--uipid 和 --tshark_path
    LOG_F(INFO, "=== 解析命令行参数 ===");
    LOG_F(INFO, "argc = %d", argc);
    for (int i = 0; i < argc; i++) {
        LOG_F(INFO, "argv[%d]: %s", i, argv[i]);
    }

    // 提取 --uipid 参数
    std::string uipidParamName = "--uipid=";
    std::string pidParam;
    PID_T pid = 0;

    for (int i = 1; i < argc; i++) {
        if (strstr(argv[i], uipidParamName.c_str()) != nullptr) {
            pidParam = argv[i];
            auto pos1 = pidParam.find(uipidParamName) + uipidParamName.size();
            auto pos2 = pidParam.find(" ", pos1);
            pid = std::stoi(pidParam.substr(pos1, pos2));
            LOG_F(INFO, "找到 UI 进程 PID: %d", pid);
            break;
        }
    }

    if (pid == 0) {
        LOG_F(ERROR, "未找到 --uipid 参数");
        LOG_F(ERROR, "usage: tshark_server --uipid=xxx [--tshark_path=xxx]");
        return -1;
    }

    if (!ProcessUtil::isProcessRunning(pid)) {
        LOG_F(ERROR, "UI进程不存在，tshark_server将退出");
        return -1;
    }

    // 提取 --tshark_path 参数（可选）
    std::string tsharkPathParamName = "--tshark_path=";
    std::string tsharkPath;

    for (int i = 1; i < argc; i++) {
        if (strstr(argv[i], tsharkPathParamName.c_str()) != nullptr) {
            std::string pathParam = argv[i];
            auto pos1 = pathParam.find(tsharkPathParamName) + tsharkPathParamName.size();
            tsharkPath = pathParam.substr(pos1);
            LOG_F(INFO, "找到 TShark 路径参数: %s", tsharkPath.c_str());
            break;
        }
    }

    if (tsharkPath.empty()) {
        LOG_F(INFO, "未提供 --tshark_path 参数，将使用默认路径");
    }

    // 启动UI监控线程
    std::thread uiMonitorThread([&]() {
        while (true) {
            if (!ProcessUtil::isProcessRunning(pid)) {
                LOG_F(INFO, "检测到UI进程已退出");
                return;
            }
            std::this_thread::sleep_for(std::chrono::seconds(5));
        }
    });


    // 确定 tshark 路径
    std::string tsharkBinPath;
    if (!tsharkPath.empty()) {
        // 使用用户提供的路径
        tsharkBinPath = tsharkPath;
        // 确保路径以斜杠结尾
        if (tsharkBinPath.back() != '/' && tsharkBinPath.back() != '\\') {
            tsharkBinPath += "/";
        }
        LOG_F(INFO, "使用用户指定的 TShark 路径: %s", tsharkBinPath.c_str());
    } else {
        // 使用默认的内置路径
        std::string currentExePath = ProcessUtil::getExecutableDir();
        tsharkBinPath = currentExePath + "/tshark/bin/";
        LOG_F(INFO, "使用默认的 TShark 路径: %s", tsharkBinPath.c_str());
    }

    LOG_F(INFO, "=== 初始化 TSharkManager ===");
    TSharkManager manager(tsharkBinPath);
    g_managerPtr = &manager;

    httplib::Server server;
    std::vector<std::string> allowOriginList = {"http://localhost:3000", "http://127.0.0.1:3000", "tauri://localhost", "http://tauri.localhost"};
    server.Options(".*", [&allowOriginList](const httplib::Request& req, httplib::Response& res) {
        // 检查 Origin 是否在允许列表中
        std::string origin = req.get_header_value("Origin");
        auto it = std::find(allowOriginList.begin(), allowOriginList.end(), origin);
        if (it != allowOriginList.end()) {
            res.set_header("Access-Control-Allow-Origin", origin);
        }
        res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE, PUT");
        res.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
        res.set_header("Access-Control-Allow-Credentials", "true");
        res.status = 200;
    });

    server.set_pre_routing_handler([](const httplib::Request &req, httplib::Response &res) {
        // 提取分页参数
        PageAndOrder* pageAndOrder = PageHelper::getPageAndOrder();
        pageAndOrder->pageNum = BaseController::getIntParam(req, "pageNum", 1);
        pageAndOrder->pageSize = BaseController::getIntParam(req, "pageSize", 100);
        pageAndOrder->orderBy = BaseController::getStringParam(req, "orderBy", "");
        pageAndOrder->descOrAsc = BaseController::getStringParam(req, "descOrAsc", "asc");
        return httplib::Server::HandlerResponse::Unhandled;
    });

    server.set_post_routing_handler([&allowOriginList](const httplib::Request &req, httplib::Response &res) {

        if (req.method != "OPTIONS") {
            // 检查 Origin 是否在允许列表中
            std::string origin = req.get_header_value("Origin");
            auto it = std::find(allowOriginList.begin(), allowOriginList.end(), origin);
            if (it != allowOriginList.end()) {
                res.set_header("Access-Control-Allow-Origin", origin);
            }
            res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE, PUT");
            res.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
            res.set_header("Access-Control-Allow-Credentials", "true");
        }

        // 打印请求日志
        LOG_F(INFO, "After HTTP Request: IP = %s, Method = %s, Path = %s", req.remote_addr.c_str(), req.method.c_str(), req.path.c_str());

        // 重置分页参数
        PageAndOrder* pageAndOrder = PageHelper::getPageAndOrder();
        pageAndOrder->reset();
    });

    // 初始化API接口
    TSharkAPI tsharkAPI;
    tsharkAPI.init(server, manager);

    // 在另一个线程中启动HTTP服务
    std::thread serverThread([&]() {
        LOG_F(INFO, "tshark_server is running on http://127.0.0.1:9122");
        if (!server.listen("127.0.0.1", 9122)) {
#ifdef _WIN32
            int error = WSAGetLastError();
            LOG_F(ERROR, "监听端口失败: %d", error);
#else
            LOG_F(ERROR, "监听端口失败: %d", errno);
#endif
            exit(0);
        }
    });


    // 等待UI进程退出
    uiMonitorThread.join();

    // UI进程退出后，HTTP服务即关闭
    server.stop();
    serverThread.join();

    // 如果还在抓包或者监控网卡流量，将其关闭
    manager.reset();

    LOG_F(INFO, "tshark_server 已退出");

    return 0;
}


/*
int64_t GetUnixTimestampMs() {
    static LARGE_INTEGER s_freq = {};
    static LARGE_INTEGER s_startCounter = {};
    static int64_t s_startUnixMs = 0;

    if (s_freq.QuadPart == 0) {
        QueryPerformanceFrequency(&s_freq);
        QueryPerformanceCounter(&s_startCounter);

        FILETIME ft;
        GetSystemTimeAsFileTime(&ft);
        ULARGE_INTEGER uli;
        uli.LowPart = ft.dwLowDateTime;
        uli.HighPart = ft.dwHighDateTime;

        // FILETIME: 1601-01-01 到现在，单位 100ns
        // 转成 1970 UNIX epoch 毫秒
        s_startUnixMs = (uli.QuadPart / 10000ULL) - 11644473600000ULL;
    }

    LARGE_INTEGER nowCounter;
    QueryPerformanceCounter(&nowCounter);

    int64_t delta = (nowCounter.QuadPart - s_startCounter.QuadPart) * 1000LL / s_freq.QuadPart;

    return s_startUnixMs + delta;
}

#include "network_stats_util.hpp"

int main() {

    setlocale(LC_ALL, "zh_CN.UTF8");

    int64_t t1 = GetUnixTimestampMs();
    printf("t1 = %lld\n", t1);

    std::map<std::string, NetworkCounters> data = NetworkStatsUtil::getSnapshot();

    int64_t t2 = GetUnixTimestampMs();
    printf("t2 = %lld\n", t2);
    printf("delta = %lld\n", t2 - t1);

    for (auto item : data) {
        printf("%s\tin_bytes=%d\tout_bytes=%d\n", item.first.c_str(), item.second.ibytes, item.second.obytes);
    }

    return 0;
}
*/