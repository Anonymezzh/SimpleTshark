use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tiny_http::{Header, Method, Response, Server, StatusCode};

const BACKEND_BASE_URL: &str = "http://127.0.0.1:9122";
const MCP_HOST: &str = "127.0.0.1";
const MCP_PORT: u16 = 9133;
const DEFAULT_SYSTEM_PROMPT: &str = r#"你是 SimpleTshark 内置的网络流量分析助手。

你的任务是结合会话概览、协议统计、数据包摘要、数据流样本和必要的包详情，对网络会话做出中文分析。

工作原则：
1. 优先先看概览，再按需查看包列表或单包详情。
2. 不要一次请求过多原始数据，先用统计结果缩小范围。
3. 如果发现异常，应明确指出依据，例如重传、RST、失败握手、异常端口、可疑十六进制负载、异常协议组合等。
4. 如果证据不足，要明确说明“不足以判断”以及还需要查看什么。
5. 回答尽量结构化，给出结论、证据、风险判断和建议。
"#;

static MCP_SERVER_RUNNING: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiSettings {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub system_prompt: String,
}

impl Default for AiSettings {
    fn default() -> Self {
        Self {
            base_url: String::new(),
            api_key: String::new(),
            model: String::new(),
            system_prompt: DEFAULT_SYSTEM_PROMPT.to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ToolSummary {
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AiRuntimeInfo {
    pub settings: AiSettings,
    pub mcp_url: String,
    pub mcp_running: bool,
    pub tools: Vec<ToolSummary>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AnalyzeSessionRequest {
    pub session_id: u32,
    pub question: Option<String>,
    pub session_context: Option<Value>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ToolTrace {
    pub name: String,
    pub arguments: Value,
    pub result_preview: String,
    pub is_error: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct AiAnalysisResponse {
    pub session_id: u32,
    pub answer: String,
    pub model: String,
    pub mcp_url: String,
    pub tool_calls: Vec<ToolTrace>,
}

#[derive(Clone)]
struct ToolSpec {
    name: &'static str,
    description: &'static str,
    input_schema: fn() -> Value,
}

struct ToolExecution {
    text: String,
    is_error: bool,
}

fn mcp_url() -> String {
    format!("http://{}:{}/mcp", MCP_HOST, MCP_PORT)
}

fn tool_specs() -> Vec<ToolSpec> {
    vec![
        ToolSpec {
            name: "get_capture_summary",
            description: "获取当前抓包/分析结果的总体统计，包括数据包总量、协议分布、IP排行和国家分布摘要。",
            input_schema: || {
                json!({
                    "type": "object",
                    "properties": {
                        "proto": { "type": "string", "description": "按协议过滤，例如 TCP、HTTP、DNS。" },
                        "ip": { "type": "string", "description": "按 IP 过滤。" },
                        "port": { "type": "integer", "description": "按端口过滤。" },
                        "country": { "type": "string", "description": "按国家/地区过滤。" },
                        "limit": { "type": "integer", "description": "每个榜单返回的最大条数，默认 10，最大 20。" }
                    }
                })
            },
        },
        ToolSpec {
            name: "search_sessions",
            description: "按协议、IP、端口或域名检索会话列表，用于在当前分析结果中定位关注的会话。",
            input_schema: || {
                json!({
                    "type": "object",
                    "properties": {
                        "proto": { "type": "string", "description": "协议过滤，例如 TCP、HTTP、DNS、TLS。" },
                        "ip": { "type": "string", "description": "参与通信的 IP。" },
                        "port": { "type": "integer", "description": "参与通信的端口。" },
                        "domain": { "type": "string", "description": "域名关键字。" },
                        "page_size": { "type": "integer", "description": "返回条数，默认 10，最大 20。" }
                    }
                })
            },
        },
        ToolSpec {
            name: "get_session_overview",
            description: "获取指定会话的基础信息和统计信息，包括五元组、起止时间、包数、字节数和进程信息。",
            input_schema: || {
                json!({
                    "type": "object",
                    "properties": {
                        "session_id": { "type": "integer", "description": "会话 ID。" }
                    },
                    "required": ["session_id"]
                })
            },
        },
        ToolSpec {
            name: "get_session_packets",
            description: "获取指定会话的数据包摘要列表，用于观察握手、重传、RST、协议行为和时序。",
            input_schema: || {
                json!({
                    "type": "object",
                    "properties": {
                        "session_id": { "type": "integer", "description": "会话 ID。" },
                        "page_num": { "type": "integer", "description": "页码，默认 1。" },
                        "page_size": { "type": "integer", "description": "返回包数量，默认 20，最大 40。" }
                    },
                    "required": ["session_id"]
                })
            },
        },
        ToolSpec {
            name: "get_packet_detail",
            description: "获取单个数据包的详细解析结果，包含协议树和十六进制数据，用于深挖关键报文。",
            input_schema: || {
                json!({
                    "type": "object",
                    "properties": {
                        "frame_number": { "type": "integer", "description": "数据包编号。" },
                        "max_chars": { "type": "integer", "description": "返回文本的最大字符数，默认 12000，最大 30000。" }
                    },
                    "required": ["frame_number"]
                })
            },
        },
        ToolSpec {
            name: "get_session_data_stream",
            description: "获取指定会话的双向十六进制数据流样本，用于查看应用层内容特征。",
            input_schema: || {
                json!({
                    "type": "object",
                    "properties": {
                        "session_id": { "type": "integer", "description": "会话 ID。" },
                        "sample_limit": { "type": "integer", "description": "返回的样本条数，默认 12，最大 30。" },
                        "max_hex_chars": { "type": "integer", "description": "每条样本保留的十六进制字符数，默认 96，最大 240。" }
                    },
                    "required": ["session_id"]
                })
            },
        },
    ]
}

fn tool_summaries() -> Vec<ToolSummary> {
    tool_specs()
        .into_iter()
        .map(|tool| ToolSummary {
            name: tool.name.to_string(),
            description: tool.description.to_string(),
        })
        .collect()
}

fn normalize_settings(mut settings: AiSettings) -> AiSettings {
    settings.base_url = settings.base_url.trim().trim_end_matches('/').to_string();
    settings.api_key = settings.api_key.trim().to_string();
    settings.model = settings.model.trim().to_string();
    if settings.system_prompt.trim().is_empty() {
        settings.system_prompt = DEFAULT_SYSTEM_PROMPT.to_string();
    }
    settings
}

fn settings_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed to resolve app data dir: {}", e))?;
    fs::create_dir_all(&dir).map_err(|e| format!("failed to create app data dir: {}", e))?;
    Ok(dir.join("ai_settings.json"))
}

fn load_settings(app: &AppHandle) -> Result<AiSettings, String> {
    let path = settings_path(app)?;
    if !path.exists() {
        return Ok(AiSettings::default());
    }
    let text = fs::read_to_string(&path).map_err(|e| format!("failed to read AI settings: {}", e))?;
    let parsed = serde_json::from_str::<AiSettings>(&text)
        .map_err(|e| format!("failed to parse AI settings: {}", e))?;
    Ok(normalize_settings(parsed))
}

fn save_settings_to_disk(app: &AppHandle, settings: AiSettings) -> Result<AiSettings, String> {
    let normalized = normalize_settings(settings);
    let path = settings_path(app)?;
    let text = serde_json::to_string_pretty(&normalized)
        .map_err(|e| format!("failed to serialize AI settings: {}", e))?;
    fs::write(&path, text).map_err(|e| format!("failed to write AI settings: {}", e))?;
    Ok(normalized)
}

pub fn start_mcp_server() {
    std::thread::spawn(|| {
        let server = match Server::http(format!("{}:{}", MCP_HOST, MCP_PORT)) {
            Ok(server) => {
                MCP_SERVER_RUNNING.store(true, Ordering::Relaxed);
                log::info!("SimpleTshark MCP server listening on {}", mcp_url());
                server
            }
            Err(error) => {
                log::error!("failed to start MCP server: {}", error);
                return;
            }
        };

        let runtime = match tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
        {
            Ok(runtime) => runtime,
            Err(error) => {
                log::error!("failed to create MCP tokio runtime: {}", error);
                return;
            }
        };

        for mut request in server.incoming_requests() {
            let url = request.url().to_string();
            if request.method() == &Method::Options {
                let response = Response::empty(StatusCode(204));
                let _ = request.respond(add_default_headers(response));
                continue;
            }

            if request.method() != &Method::Post || url != "/mcp" {
                let response = Response::from_string("not found").with_status_code(StatusCode(404));
                let _ = request.respond(add_default_headers(response));
                continue;
            }

            let mut body = String::new();
            if let Err(error) = request.as_reader().read_to_string(&mut body) {
                let response = Response::from_string(
                    json!({
                        "jsonrpc": "2.0",
                        "id": Value::Null,
                        "error": {
                            "code": -32700,
                            "message": format!("failed to read request body: {}", error)
                        }
                    })
                    .to_string(),
                )
                .with_status_code(StatusCode(400));
                let _ = request.respond(add_default_headers(response));
                continue;
            }

            let handled = runtime.block_on(handle_mcp_request(&body));
            match handled {
                McpHttpResponse::Empty(status) => {
                    let response = Response::empty(StatusCode(status));
                    let _ = request.respond(add_default_headers(response));
                }
                McpHttpResponse::Json(status, payload) => {
                    let response = Response::from_string(payload).with_status_code(StatusCode(status));
                    let _ = request.respond(add_default_headers(response));
                }
            }
        }
    });
}

enum McpHttpResponse {
    Empty(u16),
    Json(u16, String),
}

async fn handle_mcp_request(body: &str) -> McpHttpResponse {
    let request_value = match serde_json::from_str::<Value>(body) {
        Ok(value) => value,
        Err(error) => {
            return McpHttpResponse::Json(
                400,
                json!({
                    "jsonrpc": "2.0",
                    "id": Value::Null,
                    "error": {
                        "code": -32700,
                        "message": format!("invalid JSON: {}", error)
                    }
                })
                .to_string(),
            );
        }
    };

    let id = request_value.get("id").cloned().unwrap_or(Value::Null);
    let method = request_value
        .get("method")
        .and_then(Value::as_str)
        .unwrap_or_default();

    if method.starts_with("notifications/") {
        return McpHttpResponse::Empty(202);
    }

    let response = match method {
        "initialize" => json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "protocolVersion": "2025-03-26",
                "capabilities": {
                    "tools": {
                        "listChanged": false
                    }
                },
                "serverInfo": {
                    "name": "simpletshark-mcp",
                    "version": env!("CARGO_PKG_VERSION")
                },
                "instructions": DEFAULT_SYSTEM_PROMPT
            }
        }),
        "ping" => json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {}
        }),
        "tools/list" => {
            let tools: Vec<Value> = tool_specs()
                .into_iter()
                .map(|tool| {
                    json!({
                        "name": tool.name,
                        "description": tool.description,
                        "inputSchema": (tool.input_schema)()
                    })
                })
                .collect();

            json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {
                    "tools": tools
                }
            })
        }
        "tools/call" => {
            let params = request_value.get("params").cloned().unwrap_or_else(|| json!({}));
            let tool_name = params
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            let arguments = params.get("arguments").cloned().unwrap_or_else(|| json!({}));
            let execution = match build_http_client(20) {
                Ok(client) => execute_tool(&client, &tool_name, &arguments).await,
                Err(error) => ToolExecution {
                    text: error,
                    is_error: true,
                },
            };

            json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {
                    "content": [
                        {
                            "type": "text",
                            "text": execution.text
                        }
                    ],
                    "isError": execution.is_error
                }
            })
        }
        _ => json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": {
                "code": -32601,
                "message": format!("unsupported method: {}", method)
            }
        }),
    };

    McpHttpResponse::Json(200, response.to_string())
}

fn add_default_headers<T: Read + Send + 'static>(response: Response<T>) -> Response<T> {
    let response = response.with_header(
        Header::from_bytes("Content-Type", "application/json; charset=utf-8").unwrap(),
    );
    response.with_header(
        Header::from_bytes("Access-Control-Allow-Origin", "*").unwrap(),
    )
}

fn build_http_client(timeout_seconds: u64) -> Result<Client, String> {
    Client::builder()
        .timeout(Duration::from_secs(timeout_seconds))
        .build()
        .map_err(|e| format!("failed to create HTTP client: {}", e))
}

fn normalize_chat_completions_url(base_url: &str) -> String {
    let base = base_url.trim().trim_end_matches('/');
    if base.ends_with("/chat/completions") {
        base.to_string()
    } else {
        format!("{}/chat/completions", base)
    }
}

fn truncate_text(text: &str, max_chars: usize) -> String {
    let count = text.chars().count();
    if count <= max_chars {
        return text.to_string();
    }
    let truncated: String = text.chars().take(max_chars).collect();
    format!("{truncated}\n...<truncated {} chars>", count - max_chars)
}

fn pretty_json(value: &Value) -> Result<String, String> {
    serde_json::to_string_pretty(value).map_err(|e| format!("failed to serialize json: {}", e))
}

fn sanitize_large_fields(value: Value) -> Value {
    match value {
        Value::Object(map) => {
            let mut sanitized = serde_json::Map::new();
            for (key, value) in map {
                if key == "processIcoDataBase64" {
                    continue;
                }
                sanitized.insert(key, sanitize_large_fields(value));
            }
            Value::Object(sanitized)
        }
        Value::Array(items) => Value::Array(items.into_iter().map(sanitize_large_fields).collect()),
        other => other,
    }
}

fn arg_string(arguments: &Value, key: &str) -> Option<String> {
    arguments
        .get(key)
        .and_then(Value::as_str)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn arg_u32(arguments: &Value, key: &str) -> Option<u32> {
    arguments
        .get(key)
        .and_then(Value::as_u64)
        .and_then(|value| u32::try_from(value).ok())
}

fn arg_usize(arguments: &Value, key: &str, default: usize, max: usize) -> usize {
    arguments
        .get(key)
        .and_then(Value::as_u64)
        .and_then(|value| usize::try_from(value).ok())
        .map(|value| value.clamp(1, max))
        .unwrap_or(default)
}

fn require_u32(arguments: &Value, key: &str) -> Result<u32, String> {
    arg_u32(arguments, key).ok_or_else(|| format!("missing required integer argument `{}`", key))
}

async fn backend_post_json(
    client: &Client,
    path: &str,
    query: Option<Vec<(String, String)>>,
    body: Value,
) -> Result<Value, String> {
    let url = format!("{}{}", BACKEND_BASE_URL, path);
    let mut request = client.post(url).json(&body);
    if let Some(query) = query {
        request = request.query(&query);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("backend request failed: {}", e))?;
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("failed to read backend response: {}", e))?;

    if !status.is_success() {
        return Err(format!(
            "backend returned HTTP {}: {}",
            status,
            truncate_text(&text, 600)
        ));
    }

    let value: Value =
        serde_json::from_str(&text).map_err(|e| format!("failed to parse backend json: {}", e))?;
    let code = value.get("code").and_then(Value::as_i64).unwrap_or(-1);
    if code != 0 {
        let message = value
            .get("msg")
            .and_then(Value::as_str)
            .unwrap_or("unknown backend error");
        return Err(message.to_string());
    }
    Ok(value)
}

async fn get_capture_summary_tool(client: &Client, arguments: &Value) -> Result<String, String> {
    let limit = arg_usize(arguments, "limit", 10, 20);
    let mut filter = serde_json::Map::new();
    if let Some(value) = arg_string(arguments, "proto") {
        filter.insert("proto".to_string(), Value::String(value));
    }
    if let Some(value) = arg_string(arguments, "ip") {
        filter.insert("ip".to_string(), Value::String(value));
    }
    if let Some(value) = arg_string(arguments, "country") {
        filter.insert("country".to_string(), Value::String(value));
    }
    if let Some(value) = arg_u32(arguments, "port") {
        filter.insert("port".to_string(), Value::Number(value.into()));
    }
    let filter_value = Value::Object(filter);

    let count = backend_post_json(client, "/api/getPacketCountInfo", None, filter_value.clone()).await?;
    let proto_stats = backend_post_json(
        client,
        "/api/getProtoStatsList",
        Some(vec![
            ("pageNum".to_string(), "1".to_string()),
            ("pageSize".to_string(), limit.to_string()),
        ]),
        filter_value.clone(),
    )
    .await?;
    let ip_stats = backend_post_json(
        client,
        "/api/getIPStatsList",
        Some(vec![
            ("pageNum".to_string(), "1".to_string()),
            ("pageSize".to_string(), limit.to_string()),
        ]),
        filter_value.clone(),
    )
    .await?;
    let country_stats = backend_post_json(
        client,
        "/api/getCountryStatsList",
        Some(vec![
            ("pageNum".to_string(), "1".to_string()),
            ("pageSize".to_string(), limit.to_string()),
        ]),
        filter_value,
    )
    .await?;

    pretty_json(&json!({
        "filters": arguments,
        "packet_count_info": count.get("data").cloned().unwrap_or(Value::Null),
        "top_protocols": proto_stats.get("data").cloned().unwrap_or(Value::Null),
        "top_ips": ip_stats.get("data").cloned().unwrap_or(Value::Null),
        "top_countries": country_stats.get("data").cloned().unwrap_or(Value::Null)
    }))
}

async fn search_sessions_tool(client: &Client, arguments: &Value) -> Result<String, String> {
    let page_size = arg_usize(arguments, "page_size", 10, 20);
    let mut body = serde_json::Map::new();
    if let Some(value) = arg_string(arguments, "proto") {
        body.insert("proto".to_string(), Value::String(value));
    }
    if let Some(value) = arg_string(arguments, "ip") {
        body.insert("ip".to_string(), Value::String(value));
    }
    if let Some(value) = arg_string(arguments, "domain") {
        body.insert("domain".to_string(), Value::String(value));
    }
    if let Some(value) = arg_u32(arguments, "port") {
        body.insert("port".to_string(), Value::Number(value.into()));
    }

    let response = backend_post_json(
        client,
        "/api/getSessionList",
        Some(vec![
            ("pageNum".to_string(), "1".to_string()),
            ("pageSize".to_string(), page_size.to_string()),
        ]),
        Value::Object(body),
    )
    .await?;

    pretty_json(&json!({
        "filters": arguments,
        "total": response.get("total").cloned().unwrap_or(Value::Null),
        "sessions": sanitize_large_fields(response.get("data").cloned().unwrap_or(Value::Null))
    }))
}

async fn get_session_overview_tool(client: &Client, arguments: &Value) -> Result<String, String> {
    let session_id = require_u32(arguments, "session_id")?;
    let session_response = backend_post_json(
        client,
        "/api/getSessionList",
        Some(vec![
            ("pageNum".to_string(), "1".to_string()),
            ("pageSize".to_string(), "1".to_string()),
        ]),
        json!({ "sessionId": session_id }),
    )
    .await?;

    let session = session_response
        .get("data")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .cloned()
        .map(sanitize_large_fields)
        .ok_or_else(|| format!("session {} not found", session_id))?;
    let count = backend_post_json(
        client,
        "/api/getPacketCountInfo",
        None,
        json!({ "sessionId": session_id }),
    )
    .await?;

    pretty_json(&json!({
        "session_id": session_id,
        "session": session,
        "packet_count_info": count.get("data").cloned().unwrap_or(Value::Null)
    }))
}

async fn get_session_packets_tool(client: &Client, arguments: &Value) -> Result<String, String> {
    let session_id = require_u32(arguments, "session_id")?;
    let page_num = arg_u32(arguments, "page_num").unwrap_or(1);
    let page_size = arg_usize(arguments, "page_size", 20, 40);
    let response = backend_post_json(
        client,
        "/api/getPacketList",
        Some(vec![
            ("pageNum".to_string(), page_num.to_string()),
            ("pageSize".to_string(), page_size.to_string()),
        ]),
        json!({ "sessionId": session_id }),
    )
    .await?;

    let packets = response
        .get("data")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|packet| {
            json!({
                "frameNumber": packet.get("frameNumber").cloned().unwrap_or(Value::Null),
                "timestamp": packet.get("timestamp").cloned().unwrap_or(Value::Null),
                "srcIP": packet.get("srcIP").cloned().unwrap_or(Value::Null),
                "srcPort": packet.get("srcPort").cloned().unwrap_or(Value::Null),
                "dstIP": packet.get("dstIP").cloned().unwrap_or(Value::Null),
                "dstPort": packet.get("dstPort").cloned().unwrap_or(Value::Null),
                "protocol": packet.get("protocol").cloned().unwrap_or(Value::Null),
                "capLength": packet.get("capLength").cloned().unwrap_or(Value::Null),
                "info": packet.get("info").cloned().unwrap_or(Value::Null),
                "timeorderInfo": packet.get("timeorderInfo").cloned().unwrap_or(Value::Null)
            })
        })
        .collect::<Vec<_>>();

    pretty_json(&json!({
        "session_id": session_id,
        "page_num": page_num,
        "page_size": page_size,
        "total": response.get("total").cloned().unwrap_or(Value::Null),
        "packets": packets
    }))
}

async fn get_packet_detail_tool(client: &Client, arguments: &Value) -> Result<String, String> {
    let frame_number = require_u32(arguments, "frame_number")?;
    let max_chars = arg_usize(arguments, "max_chars", 12_000, 30_000);
    let response = backend_post_json(
        client,
        "/api/getPacketDetail",
        None,
        json!({ "frameNumber": frame_number }),
    )
    .await?;

    let detail_text = pretty_json(&json!({
        "frame_number": frame_number,
        "detail": response.get("data").cloned().unwrap_or(Value::Null)
    }))?;

    Ok(truncate_text(&detail_text, max_chars))
}

async fn get_session_data_stream_tool(client: &Client, arguments: &Value) -> Result<String, String> {
    let session_id = require_u32(arguments, "session_id")?;
    let sample_limit = arg_usize(arguments, "sample_limit", 12, 30);
    let max_hex_chars = arg_usize(arguments, "max_hex_chars", 96, 240);
    let response = backend_post_json(
        client,
        "/api/getSessionDataStream",
        None,
        json!({ "sessionId": session_id }),
    )
    .await?;

    let samples = response
        .get("data")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .take(sample_limit)
        .map(|item| {
            let hex_data = item
                .get("hexData")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string();
            json!({
                "srcNode": item.get("srcNode").cloned().unwrap_or(Value::Null),
                "dstNode": item.get("dstNode").cloned().unwrap_or(Value::Null),
                "byteLength": hex_data.len() / 2,
                "hexPreview": truncate_text(&hex_data, max_hex_chars)
            })
        })
        .collect::<Vec<_>>();

    pretty_json(&json!({
        "session_id": session_id,
        "count": response.get("count").cloned().unwrap_or(Value::Null),
        "sample_count": samples.len(),
        "samples": samples
    }))
}

async fn execute_tool(client: &Client, tool_name: &str, arguments: &Value) -> ToolExecution {
    let result = match tool_name {
        "get_capture_summary" => get_capture_summary_tool(client, arguments).await,
        "search_sessions" => search_sessions_tool(client, arguments).await,
        "get_session_overview" => get_session_overview_tool(client, arguments).await,
        "get_session_packets" => get_session_packets_tool(client, arguments).await,
        "get_packet_detail" => get_packet_detail_tool(client, arguments).await,
        "get_session_data_stream" => get_session_data_stream_tool(client, arguments).await,
        _ => Err(format!("unknown tool: {}", tool_name)),
    };

    match result {
        Ok(text) => ToolExecution {
            text,
            is_error: false,
        },
        Err(error) => ToolExecution {
            text: format!("Tool `{}` failed: {}", tool_name, error),
            is_error: true,
        },
    }
}

fn build_openai_tools() -> Vec<Value> {
    tool_specs()
        .into_iter()
        .map(|tool| {
            json!({
                "type": "function",
                "function": {
                    "name": tool.name,
                    "description": tool.description,
                    "parameters": (tool.input_schema)()
                }
            })
        })
        .collect()
}

fn extract_message_text(message: &Value) -> String {
    match message.get("content") {
        Some(Value::String(text)) => text.clone(),
        Some(Value::Array(parts)) => parts
            .iter()
            .filter_map(|part| {
                part.get("text")
                    .and_then(Value::as_str)
                    .map(|text| text.to_string())
            })
            .collect::<Vec<_>>()
            .join("\n"),
        _ => String::new(),
    }
}

async fn call_chat_completions(
    client: &Client,
    settings: &AiSettings,
    messages: &[Value],
) -> Result<Value, String> {
    let url = normalize_chat_completions_url(&settings.base_url);
    let mut request = client
        .post(url)
        .header("Content-Type", "application/json")
        .json(&json!({
            "model": settings.model,
            "temperature": 0.2,
            "messages": messages,
            "tools": build_openai_tools()
        }));

    if !settings.api_key.is_empty() {
        request = request.bearer_auth(&settings.api_key);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("LLM request failed: {}", e))?;
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("failed to read LLM response: {}", e))?;

    if !status.is_success() {
        return Err(format!(
            "LLM API returned HTTP {}: {}",
            status,
            truncate_text(&text, 1000)
        ));
    }

    serde_json::from_str::<Value>(&text)
        .map_err(|e| format!("failed to parse LLM response JSON: {}", e))
}

#[tauri::command]
pub fn get_ai_runtime_info(app: AppHandle) -> Result<AiRuntimeInfo, String> {
    let settings = load_settings(&app)?;
    Ok(AiRuntimeInfo {
        settings,
        mcp_url: mcp_url(),
        mcp_running: MCP_SERVER_RUNNING.load(Ordering::Relaxed),
        tools: tool_summaries(),
    })
}

#[tauri::command]
pub fn save_ai_settings(app: AppHandle, settings: AiSettings) -> Result<AiRuntimeInfo, String> {
    let settings = save_settings_to_disk(&app, settings)?;
    Ok(AiRuntimeInfo {
        settings,
        mcp_url: mcp_url(),
        mcp_running: MCP_SERVER_RUNNING.load(Ordering::Relaxed),
        tools: tool_summaries(),
    })
}

#[tauri::command]
pub async fn analyze_session_with_ai(
    app: AppHandle,
    request: AnalyzeSessionRequest,
) -> Result<AiAnalysisResponse, String> {
    let settings = load_settings(&app)?;
    if settings.base_url.is_empty() {
        return Err("AI API Base URL 未配置".to_string());
    }
    if settings.model.is_empty() {
        return Err("AI 模型名称未配置".to_string());
    }
    if settings.api_key.is_empty() {
        return Err("AI API Key 未配置".to_string());
    }

    let session_id = request.session_id;
    let question = request
        .question
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("请分析这个会话是否存在异常、失败握手、重传、可疑通信或敏感数据传输，并给出依据。")
        .to_string();

    let mut user_prompt = format!(
        "当前要分析的会话 ID: {}\n用户问题: {}\n\n请优先调用概览类工具，再按需查看包列表、数据流样本或关键包详情。",
        session_id, question
    );
    if let Some(session_context) = request.session_context {
        let session_context = sanitize_large_fields(session_context);
        let session_context_text =
            pretty_json(&session_context).unwrap_or_else(|_| session_context.to_string());
        user_prompt.push_str("\n\n前端当前会话上下文：\n");
        user_prompt.push_str(&truncate_text(&session_context_text, 6000));
    }

    let llm_client = build_http_client(90)?;
    let tool_client = build_http_client(20)?;
    let mut messages = vec![
        json!({
            "role": "system",
            "content": settings.system_prompt
        }),
        json!({
            "role": "user",
            "content": user_prompt
        }),
    ];

    let mut traces = Vec::new();

    for _round in 0..8 {
        let completion = call_chat_completions(&llm_client, &settings, &messages).await?;
        let message = completion
            .get("choices")
            .and_then(Value::as_array)
            .and_then(|choices| choices.first())
            .and_then(|choice| choice.get("message"))
            .cloned()
            .ok_or_else(|| format!("invalid LLM response: {}", truncate_text(&completion.to_string(), 1000)))?;

        let tool_calls = message
            .get("tool_calls")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();

        if tool_calls.is_empty() {
            let answer = extract_message_text(&message);
            if answer.trim().is_empty() {
                return Err("模型未返回可用结论".to_string());
            }

            return Ok(AiAnalysisResponse {
                session_id,
                answer,
                model: settings.model,
                mcp_url: mcp_url(),
                tool_calls: traces,
            });
        }

        messages.push(message.clone());

        for tool_call in tool_calls {
            let tool_type = tool_call
                .get("type")
                .and_then(Value::as_str)
                .unwrap_or_default();
            if tool_type != "function" {
                continue;
            }

            let tool_id = tool_call
                .get("id")
                .and_then(Value::as_str)
                .ok_or_else(|| "tool call id missing".to_string())?
                .to_string();
            let function = tool_call
                .get("function")
                .ok_or_else(|| "tool function payload missing".to_string())?;
            let tool_name = function
                .get("name")
                .and_then(Value::as_str)
                .ok_or_else(|| "tool name missing".to_string())?
                .to_string();
            let arguments_text = function
                .get("arguments")
                .and_then(Value::as_str)
                .unwrap_or("{}");
            let arguments = serde_json::from_str::<Value>(arguments_text).unwrap_or_else(|_| json!({}));

            let execution = execute_tool(&tool_client, &tool_name, &arguments).await;
            traces.push(ToolTrace {
                name: tool_name.clone(),
                arguments: arguments.clone(),
                result_preview: truncate_text(&execution.text, 500),
                is_error: execution.is_error,
            });

            messages.push(json!({
                "role": "tool",
                "tool_call_id": tool_id,
                "content": execution.text
            }));
        }
    }

    Err("AI 分析达到最大 tool 调用轮次，未生成最终结论".to_string())
}
