#ifdef __linux__

#include <string>
#include <sys/types.h>
#include <unistd.h>

// Linux版本的getProcessIconBase64实现
// 注意：Linux下获取应用图标比较复杂，需要：
// 1. 查找.desktop文件获取图标路径
// 2. 使用GTK+/Qt库加载和转换图标
// 3. 将图标转换为PNG格式并编码为Base64
//
// 由于这需要额外的图形库依赖，这里提供简化实现返回空字符串
// 如需完整实现，建议使用libgtk-3-dev或Qt库
std::string getProcessIconBase64(pid_t pid) {
    // TODO: 实现Linux下的图标获取功能
    // 可能的实现方案：
    // 1. 读取/proc/[pid]/cmdline获取可执行文件路径
    // 2. 在/usr/share/applications/目录下查找对应的.desktop文件
    // 3. 从.desktop文件中提取Icon字段
    // 4. 使用GTK或Qt库加载图标并转换为PNG
    // 5. 进行Base64编码

    return "";
}

#endif // __linux__
