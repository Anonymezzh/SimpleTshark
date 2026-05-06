import { invoke } from '@tauri-apps/api/core';
import { isTauri } from '@/utils/tauri';

export interface AiSettings {
  base_url: string;
  api_key: string;
  model: string;
  system_prompt: string;
}

export interface ToolSummary {
  name: string;
  description: string;
}

export interface AiRuntimeInfo {
  settings: AiSettings;
  mcp_url: string;
  mcp_running: boolean;
  tools: ToolSummary[];
}

export interface ToolTrace {
  name: string;
  arguments: Record<string, any>;
  result_preview: string;
  is_error: boolean;
}

export interface AiAnalysisResponse {
  session_id: number;
  answer: string;
  model: string;
  mcp_url: string;
  tool_calls: ToolTrace[];
}

export interface AnalyzeSessionPayload {
  session_id: number;
  question?: string;
  session_context?: Record<string, any>;
}

const AI_SETTINGS_STORAGE_KEY = 'simpletshark-ai-settings';

const defaultSettings: AiSettings = {
  base_url: '',
  api_key: '',
  model: '',
  system_prompt: '',
};

function getLocalSettings(): AiSettings {
  try {
    const raw = localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return { ...defaultSettings };
    }
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch (error) {
    return { ...defaultSettings };
  }
}

function setLocalSettings(settings: AiSettings) {
  localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export async function getAiRuntimeInfo(): Promise<AiRuntimeInfo> {
  if (isTauri()) {
    return invoke<AiRuntimeInfo>('get_ai_runtime_info');
  }

  return {
    settings: getLocalSettings(),
    mcp_url: '',
    mcp_running: false,
    tools: [],
  };
}

export async function saveAiSettings(settings: AiSettings): Promise<AiRuntimeInfo> {
  if (isTauri()) {
    return invoke<AiRuntimeInfo>('save_ai_settings', { settings });
  }

  setLocalSettings(settings);
  return {
    settings,
    mcp_url: '',
    mcp_running: false,
    tools: [],
  };
}

export async function analyzeSessionWithAi(
  payload: AnalyzeSessionPayload
): Promise<AiAnalysisResponse> {
  if (!isTauri()) {
    throw new Error('AI analysis is only available in the Tauri desktop app.');
  }

  return invoke<AiAnalysisResponse>('analyze_session_with_ai', { request: payload });
}
