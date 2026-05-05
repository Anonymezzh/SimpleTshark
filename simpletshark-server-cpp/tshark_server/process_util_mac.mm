#import <Cocoa/Cocoa.h>
#include <libproc.h>
#include <string>

// Base64 编码函数（标准实现）
static const std::string base64_chars =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

std::string base64_encode(const unsigned char* bytes_to_encode, size_t in_len) {
    std::string ret;
    int i = 0;
    unsigned char char_array_3[3], char_array_4[4];

    while (in_len--) {
        char_array_3[i++] = *(bytes_to_encode++);
        if (i == 3) {
            char_array_4[0] = (char_array_3[0] & 0xfc) >> 2;
            char_array_4[1] = ((char_array_3[0] & 0x03) << 4) | ((char_array_3[1] & 0xf0) >> 4);
            char_array_4[2] = ((char_array_3[1] & 0x0f) << 2) | ((char_array_3[2] & 0xc0) >> 6);
            char_array_4[3] = char_array_3[2] & 0x3f;

            for (i = 0; i < 4; i++)
                ret += base64_chars[char_array_4[i]];
            i = 0;
        }
    }

    if (i) {
        for (int j = i; j < 3; j++)
            char_array_3[j] = '\0';

        char_array_4[0] = (char_array_3[0] & 0xfc) >> 2;
        char_array_4[1] = ((char_array_3[0] & 0x03) << 4) | ((char_array_3[1] & 0xf0) >> 4);
        char_array_4[2] = ((char_array_3[1] & 0x0f) << 2) | ((char_array_3[2] & 0xc0) >> 6);
        char_array_4[3] = char_array_3[2] & 0x3f;

        for (int j = 0; j < i + 1; j++)
            ret += base64_chars[char_array_4[j]];
        while (i++ < 3)
            ret += '=';
    }

    return ret;
}

// 主函数：输入 PID，输出 base64 编码的 PNG 图标（含 data:image/png;base64 前缀）
std::string getProcessIconBase64(pid_t pid) {
    // 获取可执行文件路径
    char pathbuf[PROC_PIDPATHINFO_MAXSIZE];
    if (proc_pidpath(pid, pathbuf, sizeof(pathbuf)) <= 0) {
        return "";
    }

    NSString *execPath = [NSString stringWithUTF8String:pathbuf];

    // 向上查找 .app 包路径
    NSString *appPath = execPath;
    while (appPath && ![[appPath pathExtension].lowercaseString isEqualToString:@"app"]) {
        NSString *parent = [appPath stringByDeletingLastPathComponent];
        if ([parent isEqualToString:appPath]) break;
        appPath = parent;
    }

    // 如果没有找到 .app，fallback 到原始执行路径
    if (!appPath || ![[NSFileManager defaultManager] fileExistsAtPath:appPath]) {
        appPath = execPath;
    }

    // 获取图标
    NSImage *icon = [[NSWorkspace sharedWorkspace] iconForFile:appPath];
    if (!icon) return "";

    // 设定尺寸并渲染为 bitmap
    NSSize size = NSMakeSize(64, 64);
    [icon setSize:size];
    NSRect rect = NSMakeRect(0, 0, size.width, size.height);

    NSBitmapImageRep *bitmapRep = [[NSBitmapImageRep alloc]
            initWithBitmapDataPlanes:NULL
                          pixelsWide:size.width
                          pixelsHigh:size.height
                       bitsPerSample:8
                     samplesPerPixel:4
                            hasAlpha:YES
                            isPlanar:NO
                      colorSpaceName:NSCalibratedRGBColorSpace
                        bitmapFormat:0
                         bytesPerRow:0
                        bitsPerPixel:0];

    if (!bitmapRep) return "";

    NSGraphicsContext *ctx = [NSGraphicsContext graphicsContextWithBitmapImageRep:bitmapRep];
    [NSGraphicsContext saveGraphicsState];
    [NSGraphicsContext setCurrentContext:ctx];
    [icon drawInRect:rect];
    [NSGraphicsContext restoreGraphicsState];

    NSData *pngData = [bitmapRep representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
    if (!pngData) return "";

    const unsigned char* bytes = (const unsigned char*)[pngData bytes];
    size_t length = [pngData length];
    return "data:image/png;base64," + base64_encode(bytes, length);
}
