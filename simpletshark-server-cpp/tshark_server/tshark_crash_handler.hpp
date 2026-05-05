
#ifndef TSHARK_SERVER_TSHARK_CRASH_HANDLER_HPP
#define TSHARK_SERVER_TSHARK_CRASH_HANDLER_HPP

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctime>

#if defined(__unix__) || defined(__APPLE__)
#include <execinfo.h>
#include <signal.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/resource.h>
#endif

class TsharkCrashHandler {

public:
#if defined(__unix__) || defined(__APPLE__)
    // Mac平台生成dump文件
    static void WriteCoreDump() {

        // 获取当前时间
        std::time_t now = std::time(nullptr);
        std::tm* localTime = std::localtime(&now);

        // 格式化文件名
        char crashFileName[64];
        std::strftime(crashFileName, sizeof(crashFileName), "simpletshark_crash_%Y-%m-%d_%H-%M-%S.txt", localTime);

        // 打开文件，准备写入堆栈信息
        std::ofstream outfile(MiscUtil::getDefaultDataDir() + crashFileName, std::ios::out | std::ios::app);
        if (!outfile.is_open()) {
            std::cerr << "Failed to open stack trace file for writing!" << std::endl;
            abort();
        }

        // 获取堆栈信息
        void* callstack[128];
        int frames = backtrace(callstack, 128);
        char** strs = backtrace_symbols(callstack, frames);

        // 写入堆栈信息到文件
        outfile << "Stack trace:" << std::endl;
        for (int i = 0; i < frames; ++i) {
            outfile << strs[i] << std::endl;
        }

        // 释放资源
        free(strs);
        outfile.close();
    }

#endif

};

#endif //TSHARK_SERVER_TSHARK_CRASH_HANDLER_HPP
