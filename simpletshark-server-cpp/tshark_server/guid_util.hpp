#ifndef GUID_UTIL_HPP
#define GUID_UTIL_HPP

#include <iostream>
#include <string>
#include <sstream>
#include <iomanip>
#include <random>

#if defined(_WIN32)
#include <windows.h>
#include <intrin.h>
#elif defined(__linux__) || defined(__APPLE__)
#include <fstream>
#include <unistd.h>
#endif

class GUIDUtil {

public:
    // 根据硬件信息生成固定的GUID
    static std::string GenerateGUIDFromHardware() {

        if (__guid.empty()) {

            // 获取硬件信息
            std::string cpuSerial = GetCPUSerialNumber();
            std::string diskSerial = GetDiskSerialNumber();

            // 拼接硬件信息
            std::string hardwareInfo = cpuSerial + diskSerial;

            // 计算哈希值
            std::hash<std::string> hasher;
            size_t hashValue = hasher(hardwareInfo);

            // 转换为GUID格式
            std::ostringstream guid;
            guid << std::hex << std::setfill('0')
                 << std::setw(8) << ((hashValue >> 32) & 0xFFFFFFFF) << "-"
                 << std::setw(4) << ((hashValue >> 16) & 0xFFFF) << "-"
                 << std::setw(4) << (hashValue & 0xFFFF) << "-"
                 << std::setw(4) << ((hashValue >> 48) & 0xFFFF) << "-"
                 << std::setw(12) << (hashValue & 0xFFFFFFFFFFFF);

            __guid = guid.str();

        }
        return __guid;
    }

private:
    // 获取CPU序列号（跨平台）
    static std::string GetCPUSerialNumber() {
#if defined(_WIN32)
        int CPUInfo[4] = { 0 };
        char CPUString[49] = { 0 };

        __cpuid(CPUInfo, 0x80000002);
        memcpy(CPUString, CPUInfo, sizeof(CPUInfo));

        __cpuid(CPUInfo, 0x80000003);
        memcpy(CPUString + 16, CPUInfo, sizeof(CPUInfo));

        __cpuid(CPUInfo, 0x80000004);
        memcpy(CPUString + 32, CPUInfo, sizeof(CPUInfo));

        return std::string(CPUString);
#elif defined(__linux__) || defined(__APPLE__)
        std::ifstream cpuinfo("/proc/cpuinfo");
        std::string line;
        while (std::getline(cpuinfo, line)) {
            if (line.find("Serial") != std::string::npos) {
                auto pos = line.find(":");
                if (pos != std::string::npos) {
                    return line.substr(pos + 1);
                }
            }
        }
        return "UnknownCPU";
#else
        return "UnsupportedPlatformCPU";
#endif
    }

    // 获取硬盘序列号（跨平台）
    static std::string GetDiskSerialNumber() {
#if defined(_WIN32)
        DWORD serialNumber = 0;
        if (GetVolumeInformationA(
            "C:\\", nullptr, 0, &serialNumber, nullptr, nullptr, nullptr, 0)) {
            return std::to_string(serialNumber);
        }
        return "UnknownDisk";
#elif defined(__linux__)
        std::ifstream diskinfo("/sys/class/dmi/id/product_uuid");
        std::string serial;
        if (diskinfo.is_open() && std::getline(diskinfo, serial)) {
            return serial;
        }
        return "UnknownDisk";
#elif defined(__APPLE__)
        char buffer[128];
        FILE* pipe = popen("ioreg -rd1 -c IOPlatformExpertDevice | awk '/IOPlatformUUID/ {print $NF}'", "r");
        if (!pipe) return "UnknownDisk";
        std::string result = "";
        while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
            result += buffer;
        }
        pclose(pipe);
        // 去掉换行符
        result.erase(result.find_last_not_of(" \n\r") + 1);
        return result;
#else
        return "UnsupportedPlatformDisk";
#endif
    }
private:
    static std::string __guid;
};

std::string GUIDUtil::__guid;

#endif 