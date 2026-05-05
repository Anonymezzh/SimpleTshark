use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
pub struct WiresharkInfo {
    pub installed: bool,
    pub version: Option<String>,
    pub tshark_path: Option<String>, 
    pub error: Option<String>,
}

/// Check if Wireshark is installed and get tshark path
pub fn detect_wireshark() -> WiresharkInfo {
    log::info!("Detecting Wireshark installation...");

    #[cfg(target_os = "windows")]
    {
        log::info!("Platform: Windows");
        return detect_windows();
    }

    #[cfg(target_os = "macos")]
    {
        log::info!("Platform: macOS");
        return detect_macos();
    }

    #[cfg(target_os = "linux")]
    {
        log::info!("Platform: Linux");
        return detect_linux();
    }
}

#[cfg(target_os = "windows")]
fn detect_windows() -> WiresharkInfo {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::os::windows::process::CommandExt; // for creation_flags on Windows
    use std::path::Path;

    type HKEY = isize;
    type LPCWSTR = *const u16;
    type DWORD = u32;
    type LPBYTE = *mut u8;
    type LPDWORD = *mut DWORD;

    const HKEY_LOCAL_MACHINE: HKEY = 0x80000002u32 as isize;
    const KEY_READ: u32 = 0x20019;
    const KEY_WOW64_64KEY: u32 = 0x0100;
    const KEY_WOW64_32KEY: u32 = 0x0200;
    const ERROR_SUCCESS: i32 = 0;
    const REG_SZ: DWORD = 1;
    const REG_EXPAND_SZ: DWORD = 2;
    const ERROR_NO_MORE_ITEMS: i32 = 259;

    #[link(name = "advapi32")]
    extern "system" {
        fn RegOpenKeyExW(
            hKey: HKEY,
            lpSubKey: LPCWSTR,
            ulOptions: u32,
            samDesired: u32,
            phkResult: *mut HKEY,
        ) -> i32;
        fn RegQueryValueExW(
            hKey: HKEY,
            lpValueName: LPCWSTR,
            lpReserved: *mut u32,
            lpType: *mut DWORD,
            lpData: LPBYTE,
            lpcbData: LPDWORD,
        ) -> i32;
        fn RegEnumKeyExW(
            hKey: HKEY,
            dwIndex: DWORD,
            lpName: *mut u16,
            lpcName: *mut DWORD,
            lpReserved: *mut DWORD,
            lpClass: *mut u16,
            lpcClass: *mut DWORD,
            lpftLastWriteTime: *mut u64,
        ) -> i32;
        fn RegCloseKey(hKey: HKEY) -> i32;
    }
    
    #[link(name = "kernel32")]
    extern "system" {
        fn ExpandEnvironmentStringsW(lpSrc: LPCWSTR, lpDst: *mut u16, nSize: u32) -> u32;
    }

    #[link(name = "msi")]
    extern "system" {
        fn MsiEnumComponentsW(iComponentIndex: u32, lpComponentBuf: *mut u16) -> u32;
        fn MsiGetComponentPathW(szProduct: *const u16, szComponent: *const u16, lpPathBuf: *mut u16, pcchBuf: *mut u32) -> i32;
        fn MsiGetProductCodeW(szComponent: *const u16, lpProductBuf: *mut u16) -> u32;
    }

    #[link(name = "version")]
    extern "system" {
        fn GetFileVersionInfoSizeW(lptstrFilename: LPCWSTR, lpdwHandle: *mut DWORD) -> DWORD;
        fn GetFileVersionInfoW(lptstrFilename: LPCWSTR, dwHandle: DWORD, dwLen: DWORD, lpData: *mut u8) -> i32;
        fn VerQueryValueW(pBlock: *const u8, lpSubBlock: LPCWSTR, lplpBuffer: *mut *mut std::ffi::c_void, puLen: *mut u32) -> i32;
    }
    

    unsafe fn to_wide(s: &str) -> Vec<u16> {
        OsStr::new(s)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }

    unsafe fn read_registry_string(subkey: &str, value_name: &str) -> Option<String> {
        // Try multiple registry views/paths for robustness:
        // 1) 64-bit view:   HKLM\SOFTWARE\Wireshark
        // 2) 32-bit view:   HKLM\SOFTWARE\Wireshark (WOW6432 redirection)
        // 3) Explicit node: HKLM\SOFTWARE\Wow6432Node\Wireshark

        // Local helper to read a string value with a specific samDesired and subkey
        unsafe fn read_with_flags(
            subkey: &str,
            value_name: &str,
            sam_desired: u32,
        ) -> Option<String> {
            let subkey_wide = to_wide(subkey);
            let value_name_wide = to_wide(value_name);

            let mut hkey: HKEY = 0;
            let status = RegOpenKeyExW(
                HKEY_LOCAL_MACHINE,
                subkey_wide.as_ptr(),
                0,
                sam_desired,
                &mut hkey,
            );

            if status != ERROR_SUCCESS {
                return None;
            }

            let mut data_type: DWORD = 0;
            let mut data_size: DWORD = 0;
            let status = RegQueryValueExW(
                hkey,
                value_name_wide.as_ptr(),
                std::ptr::null_mut(),
                &mut data_type,
                std::ptr::null_mut(),
                &mut data_size,
            );
            if status != ERROR_SUCCESS || data_size == 0 {
                RegCloseKey(hkey);
                return None;
            }

            let mut buffer: Vec<u16> = vec![0; (data_size / 2) as usize];
            let status = RegQueryValueExW(
                hkey,
                value_name_wide.as_ptr(),
                std::ptr::null_mut(),
                &mut data_type,
                buffer.as_mut_ptr() as LPBYTE,
                &mut data_size,
            );
            RegCloseKey(hkey);

            if status == ERROR_SUCCESS {
                if let Some(null_pos) = buffer.iter().position(|&c| c == 0) {
                    buffer.truncate(null_pos);
                }
                let raw = String::from_utf16_lossy(&buffer);
                if data_type == REG_EXPAND_SZ {
                    let src = to_wide(&raw);
                    let mut out: Vec<u16> = vec![0; 32768];
                    let n = ExpandEnvironmentStringsW(src.as_ptr(), out.as_mut_ptr(), out.len() as u32);
                    if n > 0 {
                        let l = (n.saturating_sub(1)) as usize;
                        out.truncate(l);
                        let expanded = String::from_utf16_lossy(&out);
                        log::info!("Expanded REG_EXPAND_SZ {} => {}", value_name, expanded);
                        Some(expanded)
                    } else {
                        log::warn!("ExpandEnvironmentStringsW failed for {}", value_name);
                        Some(raw)
                    }
                } else {
                    Some(raw)
                }
            } else {
                None
            }
        }

        // Try candidates in order
        let candidates: [(&str, u32); 3] = [
            ("SOFTWARE\\Wireshark", KEY_READ | KEY_WOW64_64KEY),
            ("SOFTWARE\\Wireshark", KEY_READ | KEY_WOW64_32KEY),
            ("SOFTWARE\\Wow6432Node\\Wireshark", KEY_READ),
        ];

        for (sub, flags) in candidates.iter() {
            if let Some(val) = read_with_flags(sub, value_name, *flags) {
                return Some(val);
            }
        }
        None
    }

    // Strategy 1: Dedicated Wireshark key (InstallDir / InstallLocation)
    unsafe fn find_install_from_wireshark_key_1() -> Option<String> {
        if let Some(p) = read_registry_string("SOFTWARE\\Wireshark", "InstallDir") { return Some(p); }
        if let Some(p) = read_registry_string("SOFTWARE\\Wireshark", "InstallLocation") { return Some(p); }
        None
    }

    // Read REG_SZ or REG_EXPAND_SZ from an open key
    unsafe fn read_string_value(hkey: HKEY, value_name: &str) -> Option<String> {
        let value_name_wide = to_wide(value_name);
        let mut data_type: DWORD = 0;
        let mut data_size: DWORD = 0;
        
        // First call to get data type and size
        let status = RegQueryValueExW(
            hkey, 
            value_name_wide.as_ptr(), 
            std::ptr::null_mut(), 
            &mut data_type, 
            std::ptr::null_mut(), 
            &mut data_size
        );
        
        // Check if the value exists and is either REG_SZ or REG_EXPAND_SZ
        if status != ERROR_SUCCESS 
            || (data_type != REG_SZ && data_type != REG_EXPAND_SZ) 
            || data_size == 0 {
            return None;
        }
        
        // Allocate buffer and read the actual data
        let mut buffer: Vec<u16> = vec![0; (data_size / 2) as usize];
        let status = RegQueryValueExW(
            hkey, 
            value_name_wide.as_ptr(), 
            std::ptr::null_mut(), 
            &mut data_type, 
            buffer.as_mut_ptr() as LPBYTE, 
            &mut data_size
        );
        
        if status != ERROR_SUCCESS { 
            return None; 
        }
        
        // Remove null terminator if present
        if let Some(null_pos) = buffer.iter().position(|&c| c == 0) { 
            buffer.truncate(null_pos); 
        }
        
        Some(String::from_utf16_lossy(&buffer))
    }

    // Enumerate subkeys under an open key
    unsafe fn enum_subkeys(hkey: HKEY) -> Vec<String> {
        let mut idx: DWORD = 0;
        let mut names = Vec::new();
        loop {
            let mut buf: Vec<u16> = vec![0; 256];
            let mut len: DWORD = 256;
            let ret = RegEnumKeyExW(hkey, idx, buf.as_mut_ptr(), &mut len, std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null_mut());
            if ret == ERROR_NO_MORE_ITEMS { break; }
            if ret != ERROR_SUCCESS { break; }
            buf.truncate(len as usize);
            names.push(String::from_utf16_lossy(&buf));
            idx += 1;
        }
        names
    }

    // Strategy 2: enumerate HKLM Uninstall entries to find Wireshark install dir
    unsafe fn find_install_from_uninstall_2() -> Option<String> {
        let uninstall_paths = [
            ("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall", KEY_READ | KEY_WOW64_64KEY),
            ("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall", KEY_READ | KEY_WOW64_32KEY),
            ("SOFTWARE\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall", KEY_READ),
        ];
        for (path, flags) in uninstall_paths.iter() {
            let mut h_un: HKEY = 0;
            if RegOpenKeyExW(HKEY_LOCAL_MACHINE, to_wide(path).as_ptr(), 0, *flags, &mut h_un) != ERROR_SUCCESS { continue; }
            for sub in enum_subkeys(h_un) {
                //log::info!("sub_key: {}", sub);
                let mut h_app: HKEY = 0;
                if RegOpenKeyExW(h_un, to_wide(&sub).as_ptr(), 0, KEY_READ, &mut h_app) != ERROR_SUCCESS { continue; }
                let name = read_string_value(h_app, "DisplayName");
                let mut install_dir: Option<String> = None;
                if let Some(n) = name {
                    if n.to_lowercase().contains("wireshark") {
                        install_dir = read_string_value(h_app, "InstallLocation");
                        if let Some(ref install_dir) = install_dir {
                            log::info!("InstallLocation: {}", install_dir);
                        } else {
                            log::info!("InstallLocation: Not found");
                        }

                        let loc = install_dir.as_deref().unwrap_or("");
                        log::info!("find_install_from_uninstall_2 InstallLocation: {}", loc);
                        if install_dir.is_none() {
                            if let Some(icon) = read_string_value(h_app, "DisplayIcon") {
                                let mut p = icon.trim().trim_matches('"').to_string();
                                if let Some(pos) = p.find(".exe") { p.truncate(pos + 4); }
                                if let Some(dir) = Path::new(&p).parent() { install_dir = Some(dir.to_string_lossy().to_string()); }
                            }
                        }
                        if install_dir.is_none() {
                            if let Some(unstr) = read_string_value(h_app, "UninstallString") {
                                let mut p = unstr.trim().trim_matches('"').to_string();
                                if let Some(pos) = p.find(".exe") { p.truncate(pos + 4); }
                                if let Some(dir) = Path::new(&p).parent() { install_dir = Some(dir.to_string_lossy().to_string()); }
                            }
                        }
                        RegCloseKey(h_app);
                        RegCloseKey(h_un);
                        return install_dir;
                    }
                }
                RegCloseKey(h_app);
            }
            RegCloseKey(h_un);
        }
        None
    }

    // Strategy 3: Windows Installer (MSI) find ProductCode via registry, then enumerate components to locate install dir
    unsafe fn find_install_from_msi_3() -> Option<String> {
        let prod_code = match find_product_code_from_uninstall() { Some(p) => p, None => return None };
        log::info!("MSI fallback using product code: {}", prod_code);

        const INSTALLSTATE_LOCAL: i32 = 3;
        const INSTALLSTATE_SOURCE: i32 = 4;

        let mut comp_guid: [u16; 39] = [0; 39];
        let mut index: u32 = 0;
        loop {
            let rc = MsiEnumComponentsW(index, comp_guid.as_mut_ptr());
            if rc as i32 == ERROR_NO_MORE_ITEMS { break; }
            index += 1;
            if rc != 0 { continue; }

            let mut prod_buf: [u16; 39] = [0; 39];
            if MsiGetProductCodeW(comp_guid.as_ptr(), prod_buf.as_mut_ptr()) != 0 { continue; }
            let mut end = 0usize; while end < prod_buf.len() && prod_buf[end] != 0 { end += 1; }
            let comp_prod = String::from_utf16_lossy(&prod_buf[..end]);
            if comp_prod.eq_ignore_ascii_case(&prod_code) {
                let mut path_buf: Vec<u16> = vec![0; 32768];
                let mut size: u32 = path_buf.len() as u32;
                let state = MsiGetComponentPathW(
                    prod_buf.as_ptr(),
                    comp_guid.as_ptr(),
                    path_buf.as_mut_ptr(),
                    &mut size,
                );
                if state == INSTALLSTATE_LOCAL || state == INSTALLSTATE_SOURCE {
                    if let Some(z2) = path_buf.iter().position(|&c| c == 0) { path_buf.truncate(z2); }
                    let cpath = String::from_utf16_lossy(&path_buf);
                    //log::info!("MSI matched component path: {}", cpath);
                    let p = std::path::Path::new(&cpath);
                    if p.is_file() {
                        let is_tshark = p
                            .file_name()
                            .and_then(|s| s.to_str())
                            .map(|s| s.eq_ignore_ascii_case("tshark.exe"))
                            .unwrap_or(false);
                        if is_tshark {
                            if let Some(dir) = p.parent() {
                                let out = dir.to_string_lossy().to_string();
                                log::info!("MSI returning directory (from tshark.exe): {}", out);
                                return Some(out);
                            }
                        } else if let Some(dir) = p.parent() {
                            let candidate = dir.join("tshark.exe");
                            if candidate.exists() {
                                let out = dir.to_string_lossy().to_string();
                                log::info!("MSI returning directory (sibling tshark.exe): {}", out);
                                return Some(out);
                            }
                        }
                    } else if p.is_dir() {
                        let candidate = p.join("tshark.exe");
                        if candidate.exists() {
                            let out = p.to_string_lossy().to_string();
                            log::info!("MSI returning directory (dir contains tshark.exe): {}", out);
                            return Some(out);
                        }
                    }
                }
            }
        }
        None
    }

    // Get ProductCode from Uninstall registry by parsing UninstallString
    unsafe fn find_product_code_from_uninstall() -> Option<String> {
        let uninstall_paths = [
            ("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall", KEY_READ | KEY_WOW64_64KEY),
            ("SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall", KEY_READ | KEY_WOW64_32KEY),
            ("SOFTWARE\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall", KEY_READ),
        ];
        for (path, flags) in uninstall_paths.iter() {
            let mut h_un: HKEY = 0;
            if RegOpenKeyExW(HKEY_LOCAL_MACHINE, to_wide(path).as_ptr(), 0, *flags, &mut h_un) != ERROR_SUCCESS { continue; }
            for sub in enum_subkeys(h_un) {
                let mut h_app: HKEY = 0;
                if RegOpenKeyExW(h_un, to_wide(&sub).as_ptr(), 0, KEY_READ, &mut h_app) != ERROR_SUCCESS { continue; }
                // Prefer entries that clearly relate to Wireshark (by icon or name), but avoid MSI ProductName API
                let disp_icon = read_string_value(h_app, "DisplayIcon");
                let disp_name = read_string_value(h_app, "DisplayName");
                let uninstall = read_string_value(h_app, "UninstallString");
                let looks_like_ws = disp_icon.as_deref().unwrap_or("").to_lowercase().contains("wireshark")
                    || disp_name.as_deref().unwrap_or("").to_lowercase().contains("wireshark");
                if let Some(u) = uninstall {
                    if looks_like_ws {
                        if let Some(g) = extract_guid(&u) { 
                            RegCloseKey(h_app); 
                            RegCloseKey(h_un); 
                            return Some(g); 
                        }
                    }
                }
                RegCloseKey(h_app);
            }
            RegCloseKey(h_un);
        }
        None
    }

    // Extract GUID from MSI uninstall string (e.g., msiexec.exe /X{GUID})
    fn extract_guid(s: &str) -> Option<String> {
        if let Some(start) = s.find('{') {
            if let Some(end) = s[start..].find('}') {
                let guid = &s[start..start + end + 1];
                if guid.len() == 38 {
                    return Some(guid.to_string());
                }
            }
        }
        None
    }

    // Read file version from tshark.exe using version.dll
    unsafe fn get_file_version(exe_path: &Path) -> Option<String> {
        let exe = exe_path.as_os_str().to_string_lossy();
        let wide = to_wide(&exe);
        let mut handle: DWORD = 0;
        let size = GetFileVersionInfoSizeW(wide.as_ptr(), &mut handle);
        if size == 0 { return None; }
        let mut buf = vec![0u8; size as usize];
        if GetFileVersionInfoW(wide.as_ptr(), 0, size, buf.as_mut_ptr()) == 0 { return None; }
        let mut lp: *mut std::ffi::c_void = std::ptr::null_mut();
        let mut len: u32 = 0;
        if VerQueryValueW(buf.as_ptr(), to_wide("\\").as_ptr(), &mut lp, &mut len) == 0 { return None; }
        if lp.is_null() { return None; }
        #[repr(C)]
        struct VS_FIXEDFILEINFO { dwSignature: u32, dwStrucVersion: u32, dwFileVersionMS: u32, dwFileVersionLS: u32, dwProductVersionMS: u32, dwProductVersionLS: u32, dwFileFlagsMask: u32, dwFileFlags: u32, dwFileOS: u32, dwFileType: u32, dwFileSubtype: u32, dwFileDateMS: u32, dwFileDateLS: u32 }
        let info = &*(lp as *const VS_FIXEDFILEINFO);
        let major = (info.dwFileVersionMS >> 16) & 0xFFFF;
        let minor = info.dwFileVersionMS & 0xFFFF;
        let build = (info.dwFileVersionLS >> 16) & 0xFFFF;
        let rev = info.dwFileVersionLS & 0xFFFF;
        Some(format!("{}.{}.{}.{}", major, minor, build, rev))
    }

    unsafe {
        // Try to read Wireshark installation path from registry
        log::info!("Reading Wireshark installation path from registry...");
        let mut install_path_opt = find_install_from_wireshark_key_1();
        // if install_path_opt.is_none() { install_path_opt = find_install_from_uninstall_2(); }
        if install_path_opt.is_none() { install_path_opt = find_install_from_msi_3(); }
        if let Some(install_path) = install_path_opt {
            log::info!("Found Wireshark installation path: {}", install_path);
            let tshark_path = PathBuf::from(&install_path).join("tshark.exe");
            log::info!("TShark expected path: {:?}", tshark_path);

            if tshark_path.exists() {
                // Prefer reading version from file metadata (no console popups)
                log::info!("TShark executable found, reading file version...");
                if let Some(version) = get_file_version(&tshark_path) {
                    log::info!("Read file version: {}", version);
                    if check_version_requirement(&version) {
                        log::info!("Version check passed (>= 4.2)");
                        let tshark_dir = install_path.clone();
                        return WiresharkInfo { installed: true, version: Some(version), tshark_path: Some(tshark_dir), error: None };
                    } else {
                        log::warn!("Version check failed: {} < 4.2", version);
                        return WiresharkInfo { installed: true, version: Some(version), tshark_path: None, error: Some("Wireshark version check failed".to_string()) };
                    }
                } else {
                    log::warn!("Failed to read file version from tshark.exe; falling back to --version parsing");
                }
                log::info!("TShark executable found, checking version...");
                // Get version
                if let Ok(output) = std::process::Command::new(&tshark_path)
                    .arg("--version")
                    .creation_flags(0x08000000) // CREATE_NO_WINDOW to hide console window
                    .output()
                {
                    let version_output = String::from_utf8_lossy(&output.stdout);
                    log::info!(
                        "TShark version output: {}",
                        version_output.lines().next().unwrap_or("")
                    );
                    if let Some(version) = parse_tshark_version(&version_output) {
                        log::info!("Parsed version: {}", version);
                        if check_version_requirement(&version) {
                            log::info!("Version check passed (>= 4.2)");
                            // Return the directory path, not the full tshark.exe path
                            let tshark_dir = install_path.clone();
                            log::info!("TShark directory: {}", tshark_dir);
                            return WiresharkInfo {
                                installed: true,
                                version: Some(version),
                                tshark_path: Some(tshark_dir),
                                error: None,
                            };
                        } else {
                            log::warn!("Version check failed: {} < 4.2", version);
                            return WiresharkInfo {
                                installed: true,
                                version: Some(version.clone()),
                                tshark_path: None,
                                error: Some(format!(
                                    "Wireshark version check failed: {}",
                                    version
                                )),
                            };
                        }
                    }
                }

                log::warn!("Failed to get version information");
                return WiresharkInfo {
                    installed: true,
                    version: None,
                    tshark_path: Some(install_path),
                    error: Some("Failed to get version information".to_string()),
                };
            } else {
                log::warn!("TShark executable not found at expected path");
            }
        } else {
            log::warn!("Wireshark not found in registry");
            // Fallback: enumerate Uninstall entries
            if let Some(install_path) = find_install_from_uninstall_2() {
                log::info!("Found Wireshark via Uninstall entries: {}", install_path);
                let tshark_path = PathBuf::from(&install_path).join("tshark.exe");
                if tshark_path.exists() {
                    if let Some(version) = get_file_version(&tshark_path) {
                        log::info!("Read file version: {}", version);
                        if check_version_requirement(&version) {
                            return WiresharkInfo { installed: true, version: Some(version), tshark_path: Some(install_path), error: None };
                        } else {
                            return WiresharkInfo { installed: true, version: Some(version), tshark_path: None, error: Some("Wireshark".to_string()) };
                        }
                    } else {
                        return WiresharkInfo { installed: true, version: None, tshark_path: Some(install_path), error: Some("Wireshark".to_string()) };
                    }
                }
            }
        }
    }

    log::info!("Wireshark detection completed: not installed");
    WiresharkInfo {
        installed: false,
        version: None,
        tshark_path: None,
        error: Some("wireshark not found".to_string()),
    }
}

#[cfg(target_os = "macos")]
fn detect_macos() -> WiresharkInfo {
    // Check common installation path
    let tshark_path = PathBuf::from("/Applications/Wireshark.app/Contents/MacOS/tshark");
    log::info!("Checking for TShark at: {:?}", tshark_path);

    if tshark_path.exists() {
        log::info!("TShark executable found, checking version...");
        // Get version
        if let Ok(output) = std::process::Command::new(&tshark_path)
            .arg("--version")
            .output()
        {
            let version_output = String::from_utf8_lossy(&output.stdout);
            log::info!(
                "TShark version output: {}",
                version_output.lines().next().unwrap_or("")
            );
            if let Some(version) = parse_tshark_version(&version_output) {
                log::info!("Parsed version: {}", version);
                if check_version_requirement(&version) {
                    log::info!("Version check passed (>= 4.2)");
                    // Return the directory path, not the full tshark path
                    let tshark_dir = "/Applications/Wireshark.app/Contents/MacOS";
                    log::info!("TShark directory: {}", tshark_dir);
                    return WiresharkInfo {
                        installed: true,
                        version: Some(version),
                        tshark_path: Some(tshark_dir.to_string()),
                        error: None,
                    };
                } else {
                    log::warn!("Version check failed: {} < 4.2", version);
                    return WiresharkInfo {
                        installed: true,
                        version: Some(version.clone()),
                        tshark_path: None,
                        error: Some(format!(
                            "Wireshark version check failed: {}",
                            version
                        )),
                    };
                }
            }
        }

        log::warn!("Failed to get version information");
        return WiresharkInfo {
            installed: true,
            version: None,
            tshark_path: Some("/Applications/Wireshark.app/Contents/MacOS".to_string()),
            error: Some("can not get wireshark version".to_string()),
        };
    } else {
        log::warn!("TShark executable not found at: {:?}", tshark_path);
    }

    log::info!("Wireshark detection completed: not installed");
    WiresharkInfo {
        installed: false,
        version: None,
        tshark_path: None,
        error: Some("Wireshark detection completed: not installed".to_string()),
    }
}

#[cfg(target_os = "linux")]
fn detect_linux() -> WiresharkInfo {
    // Try to find tshark in PATH
    log::info!("Searching for tshark in system PATH...");
    if let Ok(output) = std::process::Command::new("which").arg("tshark").output() {
        if output.status.success() {
            let tshark_full_path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            log::info!("Found tshark at: {}", tshark_full_path);

            if !tshark_full_path.is_empty() {
                log::info!("TShark executable found, checking version...");
                // Get version
                if let Ok(output) = std::process::Command::new(&tshark_full_path)
                    .arg("--version")
                    .output()
                {
                    let version_output = String::from_utf8_lossy(&output.stdout);
                    log::info!(
                        "TShark version output: {}",
                        version_output.lines().next().unwrap_or("")
                    );
                    if let Some(version) = parse_tshark_version(&version_output) {
                        log::info!("Parsed version: {}", version);
                        if check_version_requirement(&version) {
                            log::info!("Version check passed (>= 4.2)");
                            // Extract directory from full path
                            let tshark_path_buf = PathBuf::from(&tshark_full_path);
                            if let Some(parent) = tshark_path_buf.parent() {
                                let tshark_dir = parent.to_string_lossy().to_string();
                                log::info!("TShark directory: {}", tshark_dir);
                                return WiresharkInfo {
                                    installed: true,
                                    version: Some(version),
                                    tshark_path: Some(tshark_dir),
                                    error: None,
                                };
                            }
                        } else {
                            log::warn!("Version check failed: {} < 4.2", version);
                            return WiresharkInfo {
                                installed: true,
                                version: Some(version.clone()),
                                tshark_path: None,
                                error: Some(format!(
                                    "Wireshark version check failed: {}",
                                    version
                                )),
                            };
                        }
                    }
                }

                log::warn!("Failed to get version information");
                // Extract directory even if version check failed
                let tshark_path_buf = PathBuf::from(&tshark_full_path);
                if let Some(parent) = tshark_path_buf.parent() {
                    let tshark_dir = parent.to_string_lossy().to_string();
                    return WiresharkInfo {
                        installed: true,
                        version: None,
                        tshark_path: Some(tshark_dir),
                        error: Some("error".to_string()),
                    };
                }
            }
        } else {
            log::warn!("'which tshark' command failed");
        }
    } else {
        log::warn!("Failed to execute 'which tshark' command");
    }

    log::info!("Wireshark detection completed: not installed");
    WiresharkInfo {
        installed: false,
        version: None,
        tshark_path: None,
        error: Some("Wireshark detection completed: not installed".to_string()),
    }
}

/// Parse tshark version from output like "TShark (Wireshark) 4.2.0 ..."
fn parse_tshark_version(output: &str) -> Option<String> {
    // Look for version pattern like "4.2.0"
    for line in output.lines() {
        if line.contains("TShark") || line.contains("Wireshark") {
            // Try to extract version number
            let words: Vec<&str> = line.split_whitespace().collect();
            for word in words {
                // Check if this looks like a version (e.g., "4.2.0")
                if word.contains('.') && word.chars().next().map_or(false, |c| c.is_numeric()) {
                    // Clean up any trailing characters
                    let version = word.trim_end_matches(|c: char| !c.is_numeric() && c != '.');
                    return Some(version.to_string());
                }
            }
        }
    }
    None
}

/// Check if version meets requirement (>= 4.2)
fn check_version_requirement(version: &str) -> bool {
    let parts: Vec<&str> = version.split('.').collect();
    if parts.len() >= 2 {
        if let (Ok(major), Ok(minor)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
            return major > 4 || (major == 4 && minor >= 2);
        }
    }
    false
}
