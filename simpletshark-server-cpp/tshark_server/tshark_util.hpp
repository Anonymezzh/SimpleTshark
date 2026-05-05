
#ifndef TSHARK_UTIL_H
#define TSHARK_UTIL_H

#include <iostream>
#include <string>
#include <vector>
#include <sstream>
#include <regex>
#include <algorithm>
#include "process_util.hpp"

#ifdef _WIN32
#define MIN min
#else
#define MIN std::min
#endif

// tshark的一些工具函数
class TSharkUtil {

public:
    static void init(std::string _tsharkPath) {

        if (tsharkPath.find(" ") != std::string::npos) {
            tsharkPath = "\"" + _tsharkPath + "tshark" + "\"";
            capinfosPath = "\"" + _tsharkPath + "capinfos" + "\"";
            editcapPath = "\"" + _tsharkPath + "editcap" + "\"";
        }
        else {
            tsharkPath = _tsharkPath + "tshark";
            capinfosPath = _tsharkPath + "capinfos";
            editcapPath = _tsharkPath + "editcap";
        }
    }

    // 将数据包格式转换为旧的pcap格式
    static bool convertToPcap(const std::string& inputFile, const std::string& outputFile) {
        // 构建 editcap 命令，将 pcapng 转换为 pcap 格式
        std::string command = editcapPath + " -F pcap \"" + inputFile + "\" \"" + outputFile + "\"";
        if (!ProcessUtil::Exec(command)) {
            LOG_F(ERROR, "Failed to convert to pcap format, command: %s", command.c_str());
            return false;
        }

        LOG_F(INFO, "Successfully converted %s to %s in pcap format", inputFile.c_str(), outputFile.c_str());
        return true;
    }

    // 获取pcap文件中的数据包数量
    static int getPcapPacketCount(std::string pcapFilePath) {
        std::string command = capinfosPath + " \"" + pcapFilePath + "\"";
        FILE* pipe = ProcessUtil::PopenEx(command.c_str());
        if (!pipe) {
            LOG_F(ERROR, "Failed to run capinfos command");
            throw std::runtime_error("Failed to run capinfos command");
        }

        char buffer[1024];
        std::string result;
        while (fgets(buffer, sizeof(buffer), pipe) != nullptr) {
            result += buffer;
        }
        fclose(pipe);

        // 从结果中提取包数量
        std::stringstream ss(result);
        std::string line;
        int packetCount = 0;
        while (std::getline(ss, line)) {
            if (line.find("Number of packets = ") != std::string::npos) {
                packetCount = std::stoi(line.substr(line.find("= ") + 2));
                break;
            }
        }
        return packetCount;
    }

    // 按照splitSize为单位对文件进行拆分
    // 拆分后的文件命名规则：simpletshark_split_数据包编号base_数据包偏移base.pcap
    static bool splitPcapFile(const std::string& filename, int packetCount, int splitSize, std::vector<std::string>& result) {

        if (packetCount < 20000 || splitSize < 10000 || splitSize > packetCount) {
            std::cout << "packetCount or splitSize too small" << std::endl;
            return false;
        }
        int frameNumberBase = 0;
        int frameOffsetBase = 24;
        for (int i = 0; i <= packetCount; i += splitSize) {
            int endFrameNumber = MIN(i + splitSize, packetCount);
            std::string outputFilename = "\"" + MiscUtil::getDefaultDataDir() + "simpletshark_split_" + std::to_string(frameNumberBase) + "_" + std::to_string(frameOffsetBase) + ".pcap" + "\"";
            std::string command = editcapPath + " -F pcap -r " + filename + " " + outputFilename + " " +
                                  std::to_string(frameNumberBase + 1) + "-" + std::to_string(endFrameNumber);
            ProcessUtil::Exec(command.c_str());
            frameNumberBase += splitSize;

            uint32_t fileSize = MiscUtil::getFileSize(outputFilename);
            frameOffsetBase = frameOffsetBase + fileSize - 24;

            result.push_back(outputFilename);
        }

        return true;
    }

    // 从文件名中提取数据包相关偏移信息
    static bool extractFrameOffsetFromFileName(std::string filename, uint32_t& frameNumberBase, uint32_t& frameOffsetBase) {

        // 去除文件名前后的引号
        if (filename[0] == '\"')
            filename = filename.substr(1);
        if (filename[filename.size() - 1] == '\"')
            filename = filename.substr(0, filename.size() - 1);

        std::regex pattern(R"(.*simpletshark_split_(\d+)_(\d+)\.pcap)");
        std::smatch matches;

        if (std::regex_match(filename, matches, pattern) && matches.size() == 3) {
            try {
                frameNumberBase = std::stoi(matches[1].str());
                frameOffsetBase = std::stoi(matches[2].str());
                return true;
            } catch (const std::invalid_argument& e) {
                std::cout << "Invalid number format: " << e.what() << std::endl;
            } catch (const std::out_of_range& e) {
                std::cout << "Number out of range: " << e.what() << std::endl;
            }
        }
        return false;
    }

private:
    static std::string tsharkPath;
    static std::string editcapPath;
    static std::string capinfosPath;
};

std::string TSharkUtil::tsharkPath;
std::string TSharkUtil::editcapPath;
std::string TSharkUtil::capinfosPath;

#endif //TSHARK_UTIL_H
