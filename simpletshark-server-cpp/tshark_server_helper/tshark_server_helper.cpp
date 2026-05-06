// launch_helper.cpp
#include <windows.h>
#include <stdio.h>
#include <string>
#include <vector>

namespace {

std::string quote_arg(const std::string& arg) {
    if (arg.find_first_of(" \t\"") == std::string::npos) {
        return arg;
    }

    std::string quoted = "\"";
    size_t backslashes = 0;
    for (char ch : arg) {
        if (ch == '\\') {
            backslashes++;
            quoted.push_back(ch);
            continue;
        }

        if (ch == '"') {
            quoted.append(backslashes, '\\');
            quoted.push_back('\\');
            quoted.push_back('"');
            backslashes = 0;
            continue;
        }

        backslashes = 0;
        quoted.push_back(ch);
    }

    quoted.append(backslashes, '\\');
    quoted.push_back('"');
    return quoted;
}

std::string build_server_path() {
    char module_path[MAX_PATH] = { 0 };
    DWORD len = GetModuleFileNameA(NULL, module_path, MAX_PATH);
    if (len == 0 || len >= MAX_PATH) {
        return std::string();
    }

    std::string path(module_path, len);
    size_t pos = path.find_last_of("\\/");
    if (pos == std::string::npos) {
        return "tshark_server.exe";
    }

    return path.substr(0, pos + 1) + "tshark_server.exe";
}

std::string build_command_line(const std::string& server_path, int argc, char* argv[]) {
    std::string command_line = quote_arg(server_path);
    for (int i = 1; i < argc; ++i) {
        command_line.push_back(' ');
        command_line += quote_arg(argv[i]);
    }
    return command_line;
}

}  // namespace

int main(int argc, char* argv[]) {
    std::string server_path = build_server_path();
    if (server_path.empty()) {
        printf("获取 tshark_server.exe 路径失败\n");
        return 1;
    }

    STARTUPINFOA si = { sizeof(si) };
    PROCESS_INFORMATION pi = {};
    std::string command_line = build_command_line(server_path, argc, argv);
    std::vector<char> mutable_command_line(command_line.begin(), command_line.end());
    mutable_command_line.push_back('\0');

    if (CreateProcessA(
        server_path.c_str(),
        mutable_command_line.data(),
        NULL,
        NULL,
        FALSE,
        CREATE_NO_WINDOW,
        NULL,
        NULL,
        &si,
        &pi
    )) {
        CloseHandle(pi.hThread);
        CloseHandle(pi.hProcess);
        return 0;
    }

    printf("创建进程失败: %lu\n", GetLastError());
    return 1;
}
