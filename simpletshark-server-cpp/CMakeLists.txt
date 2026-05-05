cmake_minimum_required(VERSION 3.29)
project(tshark_server)

set(CMAKE_CXX_STANDARD 14)

include_directories(.)
include_directories(tshark_server)
include_directories(tshark_server/third_library)

add_executable(tshark_server
        tshark_server/tshark_server.cpp
        tshark_server/third_library/ip2region/xdb_bench.cc
        tshark_server/third_library/ip2region/xdb_search.cc
        tshark_server/third_library/ip2region/ip2region_util.cpp
        tshark_server/third_library/ip2region/ip2region_util.h
        tshark_server/third_library/loguru/loguru.cpp
        tshark_server/tshark_manager.cpp
        tshark_server/tshark_manager.h
        tshark_server/tshark_datatype.h
        tshark_server/process_util.hpp
        tshark_server/misc_util.hpp
        tshark_server/database.hpp
        tshark_server/third_library/sqlite3/sqlite3.h
        tshark_server/third_library/sqlite3/sqlite3.c
        tshark_server/tshark_util.hpp
        tshark_server/tshark_errorcode.hpp
        tshark_server/controller/packet_controller.hpp
        tshark_server/controller/session_controller.hpp
        tshark_server/controller/stats_controller.hpp
        tshark_server/controller/adaptor_controller.hpp
        tshark_server/tshark_api.hpp
        tshark_server/sql/packet_sql.hpp
        tshark_server/pagehelper.cpp
        tshark_server/tshark_crash_handler.hpp
        tshark_server/network_stats_util.hpp
)

# macOS 特定源文件
if(APPLE)
    target_sources(tshark_server PRIVATE
            tshark_server/process_util_mac.mm
    )
endif()

# Linux 特定源文件
if(UNIX AND NOT APPLE)
    target_sources(tshark_server PRIVATE
            tshark_server/process_util_linux.cpp
    )
endif()

# 链接 Cocoa 框架 (仅 macOS)
if(APPLE)
    find_library(COCOA_LIBRARY Cocoa REQUIRED)
    target_link_libraries(tshark_server ${COCOA_LIBRARY})
endif()