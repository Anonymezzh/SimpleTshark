// Hide Windows console window
#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

mod wireshark_detector;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use tauri::{Manager, WindowEvent};

#[cfg(target_os = "windows")]
fn strip_extended_prefix(p: &std::path::Path) -> PathBuf {
    use std::path::{Component, Prefix};
    let mut comps = p.components();
    match comps.next() {
        Some(Component::Prefix(prefix_comp)) => match prefix_comp.kind() {
            Prefix::VerbatimDisk(d) => {
                let mut buf = PathBuf::from(format!("{}:\\", char::from(d)));
                for c in comps {
                    buf.push(c.as_os_str());
                }
                buf
            }
            Prefix::VerbatimUNC(server, share) => {
                let mut buf = PathBuf::from(r"\\");
                buf.push(server);
                buf.push(share);
                for c in comps {
                    buf.push(c.as_os_str());
                }
                buf
            }
            _ => p.to_path_buf(),
        },
        _ => p.to_path_buf(),
    }
}

fn unified_log_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(appdata) = std::env::var("APPDATA") {
            let p = PathBuf::from(appdata).join("simpletshark");
            let _ = std::fs::create_dir_all(&p);
            return p;
        }
    }
    if let Ok(home) = std::env::var("HOME") {
        let p = PathBuf::from(home).join("simpletshark");
        let _ = std::fs::create_dir_all(&p);
        return p;
    }
    let p = PathBuf::from("simpletshark");
    let _ = std::fs::create_dir_all(&p);
    p
}

#[cfg(target_os = "windows")]
fn is_elevated() -> bool {
    #[link(name = "shell32")]
    extern "system" {
        fn IsUserAnAdmin() -> i32;
    }
    unsafe { IsUserAnAdmin() != 0 }
}

#[cfg(target_os = "windows")]
fn relaunch_as_admin() -> Result<(), String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    type HWND = *mut core::ffi::c_void;
    type HINSTANCE = *mut core::ffi::c_void;
    type LPCWSTR = *const u16;
    type INT = i32;

    #[link(name = "shell32")]
    extern "system" {
        fn ShellExecuteW(
            hwnd: HWND,
            lpOperation: LPCWSTR,
            lpFile: LPCWSTR,
            lpParameters: LPCWSTR,
            lpDirectory: LPCWSTR,
            nShowCmd: INT,
        ) -> HINSTANCE;
    }

    fn to_wide(s: &OsStr) -> Vec<u16> {
        let mut v: Vec<u16> = s.encode_wide().collect();
        v.push(0);
        v
    }

    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_path = strip_extended_prefix(&exe_path);

    let mut args: Vec<String> = std::env::args().skip(1).collect();
    if !args.iter().any(|a| a == "--elevated") {
        args.insert(0, "--elevated".into());
    }
    let params = args
        .into_iter()
        .map(|a| {
            if a.contains(' ') || a.contains('"') {
                format!("\"{}\"", a.replace('"', "\\\""))
            } else {
                a
            }
        })
        .collect::<Vec<_>>()
        .join(" ");

    let op = to_wide(OsStr::new("runas"));
    let file = to_wide(exe_path.as_os_str());
    let par = to_wide(OsStr::new(&params));

    let res = unsafe {
        ShellExecuteW(
            core::ptr::null_mut(),
            op.as_ptr(),
            file.as_ptr(),
            par.as_ptr(),
            core::ptr::null(),
            1,
        )
    };
    let code = res as isize;
    if code as isize <= 32 {
        return Err(format!("ShellExecuteW failed, code {}", code));
    }
    Ok(())
}

fn start_tshark_server(
    resources_path: &PathBuf,
    tshark_path: Option<String>,
) -> Result<Child, String> {
    let pid = std::process::id();
    log::info!("start_tshark_server called with UI PID: {}", pid);

    #[cfg(target_os = "windows")]
    let server_path = strip_extended_prefix(&resources_path.join("tshark_server_helper.exe"));
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    let server_path = resources_path.join("tshark_server");

    log::info!("TShark server path: {:?}", server_path);

    if !server_path.exists() {
        let err_msg = format!("TShark server not found at: {:?}", server_path);
        log::error!("{}", err_msg);
        return Err(err_msg);
    }

    log::info!("TShark server binary found, checking permissions...");

    // #[cfg(not(target_os = "windows"))]
    // {
    //     use std::os::unix::fs::PermissionsExt;
    //     let mut perms = std::fs::metadata(&server_path)
    //         .map_err(|e| {
    //             let err_msg = format!("Failed to get metadata: {}", e);
    //             log::error!("{}", err_msg);
    //             err_msg
    //         })?
    //         .permissions();
    //     perms.set_mode(0o755);
    //     std::fs::set_permissions(&server_path, perms).map_err(|e| {
    //         let err_msg = format!("Failed to set permissions: {}", e);
    //         log::error!("{}", err_msg);
    //         err_msg
    //     })?;
    //     log::info!("Set executable permissions on TShark server");
    // }

    log::info!("Preparing command to launch TShark server...");
    let mut cmd = Command::new(&server_path);
    cmd.arg(format!("--uipid={}", pid));
    log::info!("Command arg: --uipid={}", pid);

    // Add tshark_path parameter if provided
    if let Some(path) = tshark_path {
        log::info!("Adding tshark_path argument: --tshark_path={}", path);
        cmd.arg(format!("--tshark_path={}", path));
    } else {
        log::warn!("No tshark_path provided, server will use bundled tshark or system tshark");
    }

    cmd.stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        const DETACHED_PROCESS: u32 = 0x00000008;
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS);
        log::info!("Set Windows process creation flags");
    }

    log::info!("Spawning TShark server process...");
    let child = cmd.spawn().map_err(|e| {
        let err_msg = format!("Failed to spawn tshark server process: {}", e);
        log::error!("{}", err_msg);
        err_msg
    })?;

    log::info!("TShark server process spawned with PID: {}", child.id());
    Ok(child)
}

// ===== MAC collection for GUID =====
#[cfg(target_os = "windows")]
#[allow(non_camel_case_types, non_snake_case, non_upper_case_globals)]
mod win_mac {
    use super::*;
    use std::os::raw::c_char;

    const ERROR_BUFFER_OVERFLOW: u32 = 111;
    const NO_ERROR: u32 = 0;

    #[repr(C)]
    struct IP_ADDR_STRING {
        Next: *mut IP_ADDR_STRING,
        IpAddress: [c_char; 16],
        IpMask: [c_char; 16],
        Context: u32,
    }

    #[repr(C)]
    struct IP_ADAPTER_INFO {
        Next: *mut IP_ADAPTER_INFO,
        ComboIndex: u32,
        AdapterName: [c_char; 260],
        Description: [c_char; 132],
        AddressLength: u32,
        Address: [u8; 8],
        Index: u32,
        Type: u32,
        DhcpEnabled: u32,
        CurrentIpAddress: *mut IP_ADDR_STRING,
        IpAddressList: IP_ADDR_STRING,
        GatewayList: IP_ADDR_STRING,
        DhcpServer: IP_ADDR_STRING,
        HaveWins: u32,
        PrimaryWinsServer: IP_ADDR_STRING,
        SecondaryWinsServer: IP_ADDR_STRING,
        LeaseObtained: u32,
        LeaseExpires: u32,
    }

    #[link(name = "iphlpapi")]
    extern "system" {
        fn GetAdaptersInfo(pAdapterInfo: *mut IP_ADAPTER_INFO, pOutBufLen: *mut u32) -> u32;
    }

    pub fn collect_macs() -> Vec<String> {
        unsafe {
            // First call to query required buffer size
            let mut len: u32 = 0;
            let mut ret = GetAdaptersInfo(std::ptr::null_mut(), &mut len as *mut u32);
            if ret != ERROR_BUFFER_OVERFLOW {
                // Some systems may return NO_ERROR on the first call; fallback to a reasonable size
                if ret != NO_ERROR || len == 0 {
                    len = std::mem::size_of::<IP_ADAPTER_INFO>() as u32 * 16;
                }
            }

            let mut buf: Vec<u8> = vec![0u8; len as usize];
            let pinfo = buf.as_mut_ptr() as *mut IP_ADAPTER_INFO;
            ret = GetAdaptersInfo(pinfo, &mut len as *mut u32);
            if ret != NO_ERROR {
                return Vec::new();
            }

            let mut out = Vec::new();
            let mut cur = pinfo;
            while !cur.is_null() {
                let info = &*cur;
                let addr_len = info.AddressLength as usize;
                if addr_len >= 6 {
                    let mac = &info.Address[0..6];
                    // filter all-zero mac
                    if mac.iter().any(|&b| b != 0) {
                        let s = mac
                            .iter()
                            .map(|b| format!("{:02x}", b))
                            .collect::<Vec<_>>()
                            .join(":");
                        out.push(s);
                    }
                }
                cur = info.Next;
            }
            out
        }
    }
}

#[cfg(target_os = "windows")]
fn os_version_string() -> String {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    type HKEY = isize;
    type LPCWSTR = *const u16;
    const HKEY_LOCAL_MACHINE: HKEY = 0x80000002u32 as isize;
    const KEY_READ: u32 = 0x20019;
    const ERROR_SUCCESS: i32 = 0;

    #[link(name = "advapi32")]
    extern "system" {
        fn RegOpenKeyExW(
            hKey: HKEY,
            lpSubKey: LPCWSTR,
            ulOptions: u32,
            samDesired: u32,
            phkResult: *mut HKEY,
        ) -> i32;
        fn RegCloseKey(hKey: HKEY) -> i32;
        fn RegQueryValueExW(
            hKey: HKEY,
            lpValueName: LPCWSTR,
            lpReserved: *mut u32,
            lpType: *mut u32,
            lpData: *mut u8,
            lpcbData: *mut u32,
        ) -> i32;
    }

    fn wide(s: &str) -> Vec<u16> {
        OsStr::new(s)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    unsafe fn read_string(hk: HKEY, name: &str) -> Option<String> {
        let mut ty: u32 = 0;
        let mut len: u32 = 0;
        if RegQueryValueExW(
            hk,
            wide(name).as_ptr(),
            std::ptr::null_mut(),
            &mut ty,
            std::ptr::null_mut(),
            &mut len,
        ) != ERROR_SUCCESS
            || len < 2
        {
            return None;
        }
        let mut buf = vec![0u16; (len as usize + 1) / 2];
        if RegQueryValueExW(
            hk,
            wide(name).as_ptr(),
            std::ptr::null_mut(),
            &mut ty,
            buf.as_mut_ptr() as *mut u8,
            &mut len,
        ) != ERROR_SUCCESS
        {
            return None;
        }
        let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
        Some(String::from_utf16_lossy(&buf[..end]))
    }

    unsafe fn read_dword(hk: HKEY, name: &str) -> Option<u32> {
        let mut ty: u32 = 0;
        let mut len: u32 = 4;
        let mut v: u32 = 0;
        if RegQueryValueExW(
            hk,
            wide(name).as_ptr(),
            std::ptr::null_mut(),
            &mut ty,
            &mut v as *mut _ as *mut u8,
            &mut len,
        ) == ERROR_SUCCESS
        {
            Some(v)
        } else {
            None
        }
    }

    unsafe {
        let mut hk: HKEY = 0;
        if RegOpenKeyExW(
            HKEY_LOCAL_MACHINE,
            wide("SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion").as_ptr(),
            0,
            KEY_READ,
            &mut hk,
        ) != ERROR_SUCCESS
        {
            // fall back to sys_info if registry open fails
            return sys_info::os_release().unwrap_or_default();
        }

        let product = read_string(hk, "ProductName").unwrap_or_default();
        let display = read_string(hk, "DisplayVersion")
            .or_else(|| read_string(hk, "ReleaseId"))
            .unwrap_or_default();
        let build = read_string(hk, "CurrentBuild")
            .or_else(|| read_string(hk, "CurrentBuildNumber"))
            .unwrap_or_default();
        let ubr = read_dword(hk, "UBR")
            .map(|v| v.to_string())
            .unwrap_or_default();
        let _ = RegCloseKey(hk);

        let mut s = if product.is_empty() {
            "Windows".to_string()
        } else {
            product
        };
        if !display.is_empty() {
            s.push(' ');
            s.push_str(&display);
        }
        if !build.is_empty() {
            s.push_str(" (build ");
            s.push_str(&build);
            if !ubr.is_empty() {
                s.push('.');
                s.push_str(&ubr);
            }
            s.push(')');
        }
        if s.is_empty() {
            sys_info::os_release().unwrap_or_default()
        } else {
            s
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn os_version_string() -> String {
    sys_info::os_release().unwrap_or_default()
}



// Commands
#[tauri::command]
fn check_wireshark() -> wireshark_detector::WiresharkInfo {
    let info = wireshark_detector::detect_wireshark();
    log::info!(
        "Wireshark detection result: installed={}, version={:?}, path={:?}, error={:?}",
        info.installed,
        info.version,
        info.tshark_path,
        info.error
    );
    info
}

#[tauri::command]
fn start_tshark_server_command(app: tauri::AppHandle) -> Result<String, String> {
    log::info!("start_tshark_server_command called from frontend");

    // Check Wireshark installation again
    let wireshark_info = wireshark_detector::detect_wireshark();

    if !wireshark_info.installed || wireshark_info.tshark_path.is_none() {
        let err = "Wireshark not installed or tshark not found".to_string();
        log::error!("{}", err);
        return Err(err);
    }

    let resources_path = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;

    let tshark_path = wireshark_info.tshark_path;

    log::info!("Starting TShark server from command");
    log::info!("Resources path: {:?}", resources_path);
    log::info!("TShark path: {:?}", tshark_path);

    match start_tshark_server(&resources_path, tshark_path) {
        Ok(child) => {
            let msg = format!("TShark server started successfully, PID: {}", child.id());
            log::info!("{}", msg);
            Ok(msg)
        }
        Err(e) => {
            log::error!("Failed to start TShark server: {}", e);
            Err(e)
        }
    }
}

#[tauri::command]
fn operation_window(window: tauri::Window, operation_type: String) {
    match operation_type.as_str() {
        "max" => {
            let _ = window.maximize();
        }
        "restoreDown" => {
            let _ = window.unmaximize();
        }
        "min" => {
            let _ = window.minimize();
        }
        "close" => {
            let _ = window.close();
        }
        _ => {}
    }
}

#[tauri::command]
fn open_devtools(app: tauri::AppHandle) {
    if let Some(webview) = app.get_webview_window("main") {
        webview.open_devtools();
    }
}

#[tauri::command]
async fn open_file_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let file = app
        .dialog()
        .file()
        .add_filter("pcap", &["pcap", "cap", "pcapng"])
        .blocking_pick_file();
    Ok(file.map(|f| f.to_string()))
}

#[tauri::command]
async fn show_save_dialog(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let now = chrono::Local::now();
    let default_name = format!(
        "simpletshark_{}_{}.pcap",
        now.format("%Y-%m-%d"),
        now.format("%H-%M-%S")
    );
    let file = app
        .dialog()
        .file()
        .set_title("保存文件")
        .set_file_name(&default_name)
        .blocking_save_file();
    Ok(file.map(|f| f.to_string()))
}

fn main() {
    tauri::Builder::default()
        .plugin({
            let log_dir = unified_log_dir();
            tauri_plugin_log::Builder::new()
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Folder {
                        path: log_dir.clone(),
                        file_name: Some("simpletshark.log".into()),
                    },
                ))
                .level(log::LevelFilter::Info)
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
                .build()
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            // Ensure admin on Windows (release)
            #[cfg(all(target_os = "windows", not(debug_assertions)))]
            {
                let is_marked = std::env::args().any(|a| a == "--elevated");
                if !is_elevated() && !is_marked {
                    match relaunch_as_admin() {
                        Ok(()) => {
                            std::process::exit(0);
                        }
                        Err(_) => {}
                    }
                }
            }

            // Resolve resources path
            let resources_path = app
                .path()
                .resource_dir()
                .map_err(|e| format!("Failed to get resource dir: {}", e))?;

            // Npcap check removed: rely on Wireshark/tshark presence only

            // Check Wireshark installation
            log::info!("=== Checking Wireshark installation ===");
            let wireshark_info = wireshark_detector::detect_wireshark();
            log::info!("Wireshark detection completed:");
            log::info!("  - Installed: {}", wireshark_info.installed);
            log::info!("  - Version: {:?}", wireshark_info.version);
            log::info!("  - TShark path: {:?}", wireshark_info.tshark_path);
            log::info!("  - Error: {:?}", wireshark_info.error);

            // Only start tshark server if Wireshark is properly installed
            if wireshark_info.installed && wireshark_info.tshark_path.is_some() {
                let tshark_path = wireshark_info.tshark_path.clone();
                log::info!("=== Starting TShark server ===");
                log::info!("Resources path: {:?}", resources_path);
                log::info!("TShark directory to pass: {:?}", tshark_path);

                match start_tshark_server(&resources_path, tshark_path) {
                    Ok(child) => {
                        log::info!("TShark server started successfully, PID: {}", child.id());
                    }
                    Err(e) => {
                        log::error!("Failed to start TShark server: {}", e);
                    }
                }
            } else {
                log::warn!("Wireshark not detected, skipping TShark server startup");
            }

            // Set dynamic window size based on screen resolution
            if let Some(window) = app.get_webview_window("main") {
                // Get primary monitor
                if let Ok(Some(monitor)) = window.primary_monitor() {
                    let screen_size = monitor.size();

                    // Calculate 80% of screen size
                    let target_width = (screen_size.width as f64 * 0.8) as u32;
                    let target_height = (screen_size.height as f64 * 0.8) as u32;

                    // Set minimum size (for 13-inch laptops, typically 1280x800 or higher)
                    // Minimum: 1024x640 (80% of 1280x800)
                    let min_width = 1024u32;
                    let min_height = 640u32;

                    // Use the larger of calculated size or minimum size
                    let final_width = target_width.max(min_width);
                    let final_height = target_height.max(min_height);

                    log::info!(
                        "Screen size: {}x{}, Setting window size to: {}x{}",
                        screen_size.width,
                        screen_size.height,
                        final_width,
                        final_height
                    );

                    // Set window size
                    let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                        width: final_width,
                        height: final_height,
                    }));

                    // Set minimum window size
                    let _ = window.set_min_size(Some(tauri::Size::Physical(tauri::PhysicalSize {
                        width: min_width,
                        height: min_height,
                    })));

                    // Center window after resizing
                    let _ = window.center();
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            operation_window,
            open_file_dialog,
            show_save_dialog,
            open_devtools,
            check_wireshark,
            start_tshark_server_command
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                let _ = window.label();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
