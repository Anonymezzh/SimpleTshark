
#ifndef PROCESSUTIL_H
#define PROCESSUTIL_H

#include <stdio.h>
#include <string>
#include <thread>
#include <mutex>

#ifdef _WIN32
#include <Windows.h>
#include <io.h>
#include <fcntl.h>
#include <csignal>
#include <tlhelp32.h>
#include <shellapi.h>
#include <shlobj_core.h>
#include <commctrl.h>
#include <wincodec.h>
#include <atlenc.h>
#include <winternl.h>

typedef DWORD PID_T;
#else
#include <unistd.h>
#include <signal.h>
#include <limits.h>
#include <sys/wait.h>
#include <pthread.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <semaphore.h>
#include <spawn.h>
typedef pid_t PID_T;
#endif

#if defined(__linux__)
#include <sys/mman.h>
#endif

#if defined(__APPLE__)
#include <mach-o/dyld.h>
#include <limits.h>
#include <libproc.h>
#include <pthread.h>
#endif


#include "misc_util.hpp"


class ProcessUtil {

public:
    // Linux/Mac版本
#if defined(__unix__) || defined(__APPLE__)
    static FILE* PopenEx(std::string command, PID_T* pidOut = nullptr) {
        int pipefd[2] = { 0 };
        FILE* pipeFp = nullptr;

        if (pipe(pipefd) == -1) {
            perror("pipe");
            return nullptr;
        }

        pid_t pid = fork();
        if (pid == -1) {
            perror("fork");
            close(pipefd[0]);
            close(pipefd[1]);
            return nullptr;
        }

        if (pid == 0) {
            // 子进程
            close(pipefd[0]);  // 关闭读端
            dup2(pipefd[1], STDOUT_FILENO); // 将 stdout 重定向到管道
            dup2(pipefd[1], STDERR_FILENO); // 将 stderr 重定向到管道
            close(pipefd[1]);

            execl("/bin/sh", "sh", "-c", command.c_str(), NULL);  // 执行命令
            _exit(1);  // execl失败
        }

        // 父进程将读取管道，关闭写端
        close(pipefd[1]);
        pipeFp = fdopen(pipefd[0], "r");

        if (pidOut) {
            *pidOut = pid;
        }

        return pipeFp;
    }

    static int Kill(PID_T pid) {

        int ret = 0;
        while (true) {
            int x = kill(pid, 0);
            if (x == 0) {
                ret = kill(pid, SIGTERM);
                std::this_thread::sleep_for(std::chrono::milliseconds(1));
            } else {
                break;
            }
        }
        return ret;
        //return kill(pid, SIGTERM);
    }

    // 批量根据进程名杀死进程
    static void KillAll(const char* name) {
        std::string cmd = "killall -9 ";
        cmd += name;
        std::system(cmd.c_str());
    }

    static PID_T WaitPid(PID_T pid, int* status, int options) {
        return waitpid(pid, status, options);
    }

    static void SetCurrentThreadName(std::string name) {
#ifdef __APPLE__
        pthread_setname_np(name.c_str());
#else
        pthread_setname_np(pthread_self(), name.c_str());
#endif
    }

#endif
#ifdef _WIN32
    // Windows 版本
    static FILE* PopenEx(std::string command, PID_T* pidOut = nullptr) {

        //  Windows平台要转换，否则执行tshark时候，命令行参数有中文（比如网卡名）会乱码
        command = MiscUtil::UTF8ToANSIString(command);

        HANDLE hReadPipe, hWritePipe;
        SECURITY_ATTRIBUTES saAttr;
        PROCESS_INFORMATION piProcInfo;
        STARTUPINFO siStartInfo;
        FILE* pipeFp = nullptr;

        // 设置安全属性，允许管道句柄继承
        saAttr.nLength = sizeof(SECURITY_ATTRIBUTES);
        saAttr.bInheritHandle = TRUE;
        saAttr.lpSecurityDescriptor = nullptr;

        // 创建匿名管道
        if (!CreatePipe(&hReadPipe, &hWritePipe, &saAttr, 0)) {
            perror("CreatePipe");
            return nullptr;
        }

        // 确保写句柄不被子进程继承
        if (!SetHandleInformation(hReadPipe, HANDLE_FLAG_INHERIT, 0)) {
            perror("SetHandleInformation");
            CloseHandle(hReadPipe);
            CloseHandle(hWritePipe);
            return nullptr;
        }

        // 初始化 STARTUPINFO 结构体
        ZeroMemory(&piProcInfo, sizeof(PROCESS_INFORMATION));
        ZeroMemory(&siStartInfo, sizeof(STARTUPINFO));
        siStartInfo.cb = sizeof(STARTUPINFO);
        siStartInfo.hStdError = hWritePipe;
        siStartInfo.hStdOutput = hWritePipe;
        siStartInfo.dwFlags |= STARTF_USESTDHANDLES;

        // 创建子进程
        if (!CreateProcess(
            nullptr,                                            // No module name (use command line)
            (LPSTR)command.data(),                              // Command line
            nullptr,                                            // Process handle not inheritable
            nullptr,                                            // Thread handle not inheritable
            TRUE,                                               // Set handle inheritance
            CREATE_NO_WINDOW ,                                  // No window
            nullptr,                                            // Use parent's environment block
            nullptr,                                            // Use parent's starting directory 
            &siStartInfo,                                       // Pointer to STARTUPINFO structure
            &piProcInfo                                         // Pointer to PROCESS_INFORMATION structure
        )) {
            perror("CreateProcess");
            CloseHandle(hReadPipe);
            CloseHandle(hWritePipe);
            return nullptr;
        }

        // 关闭写端句柄（父进程不使用）
        CloseHandle(hWritePipe);

        // 返回子进程 PID
        if (pidOut) {
            *pidOut = piProcInfo.dwProcessId;
        }

        // 将管道的读端转换为 FILE* 并返回
        pipeFp = _fdopen(_open_osfhandle(reinterpret_cast<intptr_t>(hReadPipe), _O_RDONLY), "r");
        if (!pipeFp) {
            CloseHandle(hReadPipe);
        }

        // 关闭进程句柄（不需要等待子进程）
        CloseHandle(piProcInfo.hProcess);
        CloseHandle(piProcInfo.hThread);

        return pipeFp;
    }

    static int Kill(PID_T pid) {

        // 打开指定进程
        HANDLE hProcess = OpenProcess(PROCESS_TERMINATE, FALSE, pid);
        if (hProcess == nullptr) {
            std::cout << "Failed to open process with PID " << pid << ", error: " << GetLastError() << std::endl;
            return -1;
        }

        // 终止进程
        if (!TerminateProcess(hProcess, 0)) {
            std::cout << "Failed to terminate process with PID " << pid << ", error: " << GetLastError() << std::endl;
            CloseHandle(hProcess);
            return -1;
        }

        // 成功终止进程
        CloseHandle(hProcess);
        return 0;
    }

    static void KillAll(std::string name) {
#ifdef _WIN32
        ProcessUtil::Exec("taskkill /IM " + name + " /F");
#elif defined(__APPLE__)
        ProcessUtil::Exec("killall " + name);
#endif
    }


    // 模拟 Linux 的 waitpid 函数
    static PID_T WaitPid(PID_T pid, int* status, int options) {
        if (pid <= 0 || options != 0) {
            std::cout << "Unsupported options or invalid PID." << std::endl;
            return -1;
        }

        // 打开指定进程的句柄
        HANDLE hProcess = OpenProcess(SYNCHRONIZE | PROCESS_QUERY_INFORMATION, FALSE, pid);
        if (!hProcess) {
            std::cout << "Failed to open process with PID " << pid << ", error: " << GetLastError() << std::endl;
            return -1;
        }

        // 等待进程退出
        DWORD waitResult = WaitForSingleObject(hProcess, INFINITE);
        if (waitResult != WAIT_OBJECT_0) {
            std::cout << "WaitForSingleObject failed, error: " << GetLastError() << std::endl;
            CloseHandle(hProcess);
            return -1;
        }

        // 获取进程退出代码
        DWORD exitCode;
        if (GetExitCodeProcess(hProcess, &exitCode)) {
            if (status) {
                *status = (exitCode & 0xFF);
            }
        }
        else {
            std::cout << "Failed to get exit code, error: " << GetLastError() << std::endl;
        }

        CloseHandle(hProcess);
        return pid;
    }

    static void SetCurrentThreadName(std::string name) {
        std::wstring wname = MiscUtil::ANSIToUnicode(name);
        SetThreadDescription(GetCurrentThread(), wname.c_str());
    }

#endif

    static bool isProcessRunning(PID_T pid) {
#ifdef _WIN32
        HANDLE process = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, FALSE, pid);
        if (process == NULL) {
            return false;
        }
        DWORD exitCode;
        if (GetExitCodeProcess(process, &exitCode)) {
            CloseHandle(process);
            return (exitCode == STILL_ACTIVE);
        }
        CloseHandle(process);
        return false;
#else
        // On Unix-like systems, sending signal 0 to a process checks if it exists
        int ret = kill(pid, 0);
        return (ret == 0);
#endif
    }


    // 跨平台杀死线程的函数
    static bool KillThread(std::shared_ptr<std::thread> thread) {
        if (!thread->joinable()) {
            return false;
        }

#ifdef _WIN32
        // Windows平台使用TerminateThread
        HANDLE handle = thread->native_handle();
        bool result = (TerminateThread(handle, 0) != 0);
        if (result) {
            thread->detach(); // 线程已被终止，可以detach
        }
        return result;
#else
        // Linux平台使用pthread_cancel
        pthread_t handle = thread->native_handle();
        int result = pthread_cancel(handle);
        if (result == 0) {
            thread->detach(); // 线程已被取消，可以detach
            return true;
        }
        return false;
#endif
    }



    static std::string getExecutablePath() {
#if defined(_WIN32)
        char buffer[MAX_PATH];
        DWORD length = GetModuleFileNameA(NULL, buffer, MAX_PATH);

        std::string path = MiscUtil::ANSIToUTF8String(buffer);
        return path;
#elif defined(__APPLE__)
        char buffer[PATH_MAX];
        uint32_t size = sizeof(buffer);
        if (_NSGetExecutablePath(buffer, &size) == 0)
            return std::string(buffer);
        else {
            // 分配足够大小的缓冲区
            char* buf = new char[size];
            _NSGetExecutablePath(buf, &size);
            std::string path(buf);
            delete[] buf;
            return path;
        }
#elif defined(__linux__)
        char buffer[PATH_MAX];
        ssize_t length = readlink("/proc/self/exe", buffer, sizeof(buffer) - 1);
        if (length != -1) {
            buffer[length] = '\0'; // 添加结束符
            return std::string(buffer);
        }
        return std::string();
#endif
    }

    static std::string getExecutableDir() {
        std::string fullPath = getExecutablePath();
        // 查找最后一个斜杠或反斜杠的位置
        size_t pos = fullPath.find_last_of("/\\");
        if (pos != std::string::npos)
            return fullPath.substr(0, pos + 1);
        return std::string();
    }

    // 封装一下执行命令行程序，将控制台窗口隐藏
    static bool Exec(std::string cmdline) {
#ifdef _WIN32
        //  Windows平台要转换，否则执行tshark时候，命令行参数有中文（比如网卡名）会乱码
        cmdline = MiscUtil::UTF8ToANSIString(cmdline);

        PROCESS_INFORMATION piProcInfo;
        STARTUPINFO siStartInfo;

        // 初始化 STARTUPINFO 结构体
        ZeroMemory(&piProcInfo, sizeof(PROCESS_INFORMATION));
        ZeroMemory(&siStartInfo, sizeof(STARTUPINFO));

        // 创建子进程
        if (CreateProcess(
            nullptr,                        // No module name (use command line)
            (LPSTR)cmdline.data(),          // Command line
            nullptr,                        // Process handle not inheritable
            nullptr,                        // Thread handle not inheritable
            TRUE,                           // Set handle inheritance
            CREATE_NO_WINDOW,               // No window
            nullptr,                        // Use parent's environment block
            nullptr,                        // Use parent's starting directory
            &siStartInfo,                   // Pointer to STARTUPINFO structure
            &piProcInfo                     // Pointer to PROCESS_INFORMATION structure
        )) {
            WaitForSingleObject(piProcInfo.hProcess, INFINITE);
            CloseHandle(piProcInfo.hProcess);
            CloseHandle(piProcInfo.hThread);
            return true;
        }
        else {
            return false;
        }
#else
        int ret = std::system(cmdline.c_str());
        if (ret != 0) {
            const char* errorMsg = std::strerror(errno);
            LOG_F(ERROR, "std::system(\"%s\") return: %d, errno=%d, errorMsg=%s", cmdline.c_str(), ret, errno, errorMsg);
        }

        // 如果errno=10，也判定为成功，被全局的信号处理器waitpid处理过子进程了
        return ret == 0 || (ret == -1 && errno == 10);
#endif
    }

    // 判断进程是否为单例
    static bool IsSingleton() {
#ifdef _WIN32
        // 使用命名互斥体确保只有一个进程实例运行
        HANDLE hMutex = CreateMutex(NULL, TRUE, "__SIMPLETSHARK_MUTEX__");
        if (GetLastError() == ERROR_ALREADY_EXISTS) {
            // 互斥体已经存在，说明另一个实例已经运行
            return false;
        }
#elif defined(__APPLE__)
        // macOS 使用文件锁方式
        int fd = open("/tmp/simpletshark.lock", O_CREAT | O_RDWR, 0666);
        if (fd < 0) {
            LOG_F(ERROR, "无法打开锁文件");
            return false;
        }
        // 使用 lockf 尝试加锁，如果加锁失败则说明已经有进程持有该锁
        if (lockf(fd, F_TLOCK, 0) < 0) {
            close(fd);
            return false;
        }
        // 注意：为了使锁保持有效，不要在进程生命周期中关闭 fd
#else
        // Linux 使用共享内存 + 进程间互斥体
        const char* shm_name = "/simpletshark_mutex_shm";
        int shm_fd = shm_open(shm_name, O_CREAT | O_RDWR, 0666);
        if (shm_fd < 0) {
            LOG_F(ERROR, "无法创建共享内存");
            return false;
        }

        // 设置共享内存大小
        if (ftruncate(shm_fd, sizeof(pthread_mutex_t)) != 0) {
            LOG_F(ERROR, "无法设置共享内存大小");
            close(shm_fd);
            return false;
        }

        // 映射共享内存
        pthread_mutex_t* mutex = (pthread_mutex_t*)mmap(NULL, sizeof(pthread_mutex_t),
                                                         PROT_READ | PROT_WRITE, MAP_SHARED, shm_fd, 0);
        if (mutex == MAP_FAILED) {
            LOG_F(ERROR, "无法映射共享内存");
            close(shm_fd);
            return false;
        }

        // 初始化互斥体属性为进程间共享
        pthread_mutexattr_t attr;
        pthread_mutexattr_init(&attr);
        pthread_mutexattr_setpshared(&attr, PTHREAD_PROCESS_SHARED);

        // 尝试初始化互斥体（如果已初始化则跳过）
        static bool mutex_initialized = false;
        if (!mutex_initialized) {
            pthread_mutex_init(mutex, &attr);
            mutex_initialized = true;
        }
        pthread_mutexattr_destroy(&attr);

        // 尝试加锁，使用非阻塞方式
        int result = pthread_mutex_trylock(mutex);

        // 关闭文件描述符（但保持映射和锁）
        close(shm_fd);

        if (result != 0) {
            // 加锁失败，说明另一个实例正在运行
            munmap(mutex, sizeof(pthread_mutex_t));
            return false;
        }

        // 注意：为了使互斥体保持有效，不要在进程生命周期中解锁或取消映射
#endif
        return true;
    }

#ifdef __APPLE__
    static bool GetProcessNameByPid(PID_T pid, std::string& processName, std::string& processFullPath) {
        char buffer[PROC_PIDPATHINFO_MAXSIZE];
        int ret = proc_pidpath(pid, buffer, sizeof(buffer));
        if (ret > 0) {
            processFullPath = std::string(buffer);

            // 提取文件名部分
            char* p = strrchr(buffer, '/');
            if (p != nullptr) {
                processName = p + 1;
            } else {
                processName = buffer;
            }
            return true;
        }
        return false;
    }

    static pid_t GetParentPid(pid_t pid) {
        struct proc_bsdinfo proc;
        int ret = proc_pidinfo(pid, PROC_PIDTBSDINFO, 0, &proc, sizeof(proc));
        if (ret <= 0) {
            return -1; // 获取失败
        }
        return proc.pbi_ppid;
    }

#endif // __APPLE__


#ifdef __linux__
    static std::string GetProcessPath(pid_t pid) {
        char path[PATH_MAX];
        std::string link = "/proc/" + std::to_string(pid) + "/exe";
        ssize_t len = readlink(link.c_str(), path, sizeof(path) - 1);
        if (len != -1) {
            path[len] = '\0';
            return std::string(path);
        } else {
            return "Unknown";
        }
    }
#endif // __linux__


#ifdef _WIN32
    // 获取进程名函数
    static bool GetProcessNameByPid(PID_T pid, std::string& processName, std::string& processFullPath) {

        HANDLE hProcess = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
        if (hProcess != NULL) {
            char buffer[MAX_PATH] = { 0 };
            DWORD size = MAX_PATH;
            if (QueryFullProcessImageNameA(hProcess, 0, buffer, &size)) {

                processFullPath = buffer;

                // 提取文件名部分
                char* p = strrchr(buffer, '\\');
                if (p != nullptr) {
                    processName = p + 1;
                }
                else {
                    processName = buffer;
                }
            }
            CloseHandle(hProcess);

            processName = MiscUtil::ANSIToUTF8String(processName);
            processFullPath = MiscUtil::ANSIToUTF8String(processFullPath);
            return true;
        }

        return false;
    }

    static DWORD GetParentProcessId(DWORD pid)
    {
        DWORD parentPid = 0;
        HANDLE hSnapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);

        if (hSnapshot != INVALID_HANDLE_VALUE) {
            PROCESSENTRY32 pe32;
            pe32.dwSize = sizeof(PROCESSENTRY32);

            if (Process32First(hSnapshot, &pe32)) {
                do {
                    if (pe32.th32ProcessID == pid) {
                        parentPid = pe32.th32ParentProcessID;
                        break;
                    }
                } while (Process32Next(hSnapshot, &pe32));
            }
            CloseHandle(hSnapshot);
        }

        return parentPid;
    }

#pragma pack(push, 2)  // ICO 文件需要 2 字节对齐
    typedef struct {
        WORD           idReserved;   // 保留 (必须为 0)
        WORD           idType;       // 资源类型 (1 为图标)
        WORD           idCount;      // 图标数量
    } ICONDIR, * LPICONDIR;

    typedef struct {
        BYTE    bWidth;          // 宽度，像素
        BYTE    bHeight;         // 高度，像素
        BYTE    bColorCount;     // 颜色数 (0 表示 ≥256 色)
        BYTE    bReserved;       // 保留
        WORD    wPlanes;         // 颜色平面数
        WORD    wBitCount;       // 每像素位数
        DWORD   dwBytesInRes;    // 资源大小
        DWORD   dwImageOffset;   // 资源偏移
    } ICONDIRENTRY, * LPICONDIRENTRY;
#pragma pack(pop)  // 恢复默认对齐

    // 将EXE图标转换为Base64编码字符串的函数
    static std::string GetExeIconAsBase64(const std::string& exePath, int iconIndex = 0) {
        // 1. 从EXE文件中提取图标
        HICON hIcon = nullptr;

        // 尝试使用ExtractIconEx获取图标
        if (ExtractIconExA(exePath.c_str(), iconIndex, &hIcon, nullptr, 1) <= 0) {
            // 如果失败，尝试使用SHDefExtractIcon
            if (S_OK != SHDefExtractIconA(exePath.c_str(), iconIndex, 0, &hIcon, nullptr, 0)) {
                return "";
            }
        }

        std::vector<BYTE> icoData;

        // 2. 将图标数据写入内存缓冲区
        ICONINFO iconInfo = { 0 };
        if (GetIconInfo(hIcon, &iconInfo)) {
            BITMAP bmColor = { 0 };
            if (iconInfo.hbmColor) {
                GetObject(iconInfo.hbmColor, sizeof(BITMAP), &bmColor);
            }

            BITMAP bmMask = { 0 };
            if (iconInfo.hbmMask) {
                GetObject(iconInfo.hbmMask, sizeof(BITMAP), &bmMask);
            }

            // 计算所需缓冲区大小
            DWORD bufferSize = sizeof(ICONDIR) + sizeof(ICONDIRENTRY) +
                sizeof(BITMAPINFOHEADER) +
                (bmColor.bmWidth * bmColor.bmHeight * 4);

            icoData.resize(bufferSize);
            BYTE* buffer = icoData.data();
            DWORD offset = 0;

            // 准备ICO文件头
            ICONDIR iconDir = { 0 };
            iconDir.idReserved = 0;
            iconDir.idType = 1; // 1 for .ico
            iconDir.idCount = 1;

            // 图标目录条目
            ICONDIRENTRY iconEntry = { 0 };
            iconEntry.bWidth = (BYTE)(bmColor.bmWidth);
            iconEntry.bHeight = (BYTE)(bmColor.bmHeight);
            iconEntry.bColorCount = 0; // 0 for 256+ colors
            iconEntry.bReserved = 0;
            iconEntry.wPlanes = 1;
            iconEntry.wBitCount = 32;
            iconEntry.dwBytesInRes = sizeof(BITMAPINFOHEADER) + bmColor.bmWidth * bmColor.bmHeight * 4;
            iconEntry.dwImageOffset = sizeof(ICONDIR) + sizeof(ICONDIRENTRY);

            // 写入ICO文件头
            memcpy(buffer + offset, &iconDir, sizeof(iconDir));
            offset += sizeof(iconDir);
            memcpy(buffer + offset, &iconEntry, sizeof(iconEntry));
            offset += sizeof(iconEntry);

            // 准备位图信息头
            BITMAPINFOHEADER bmih = { 0 };
            bmih.biSize = sizeof(BITMAPINFOHEADER);
            bmih.biWidth = bmColor.bmWidth;
            bmih.biHeight = bmColor.bmHeight * 2; // 图标高度是颜色位图+掩码位图
            bmih.biPlanes = 1;
            bmih.biBitCount = 32;
            bmih.biCompression = BI_RGB;
            bmih.biSizeImage = 0;
            bmih.biXPelsPerMeter = 0;
            bmih.biYPelsPerMeter = 0;
            bmih.biClrUsed = 0;
            bmih.biClrImportant = 0;

            // 写入位图信息头
            memcpy(buffer + offset, &bmih, sizeof(bmih));
            offset += sizeof(bmih);

            // 获取图标像素数据
            HDC hdc = GetDC(NULL);
            if (hdc) {
                BITMAPINFO bi = { 0 };
                bi.bmiHeader = bmih;
                bi.bmiHeader.biHeight = bmColor.bmHeight; // 只处理颜色部分

                // 写入像素数据
                if (GetDIBits(hdc, iconInfo.hbmColor, 0, bmColor.bmHeight,
                    buffer + offset, &bi, DIB_RGB_COLORS)) {
                    // 成功获取像素数据
                }
                ReleaseDC(NULL, hdc);
            }

            // 清理
            if (iconInfo.hbmColor) DeleteObject(iconInfo.hbmColor);
            if (iconInfo.hbmMask) DeleteObject(iconInfo.hbmMask);
        }

        if (hIcon) {
            DestroyIcon(hIcon);
        }

        // 3. 将ICO数据转换为Base64字符串
        if (!icoData.empty()) {
            // 计算Base64编码后所需缓冲区大小
            int base64Length = Base64EncodeGetRequiredLength(icoData.size());
            std::vector<char> base64Buffer(base64Length + 1); // +1 for null terminator

            if (Base64Encode(icoData.data(), icoData.size(),
                base64Buffer.data(), &base64Length, ATL_BASE64_FLAG_NOCRLF)) {
                base64Buffer[base64Length] = '\0'; // 确保以null结尾
                return std::string("data:image/x-icon;base64,") + base64Buffer.data();
            }
        }

        return "";
    }
#endif        // _WIN32

};



#endif //PROCESSUTIL_H
