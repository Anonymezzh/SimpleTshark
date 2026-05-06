import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Collapse,
  Empty,
  Grid,
  Input,
  Message,
  Space,
  Spin,
  Tag,
  Typography,
} from '@arco-design/web-react';
import {
  AiAnalysisResponse,
  AiRuntimeInfo,
  AiSettings,
  analyzeSessionWithAi,
  getAiRuntimeInfo,
  saveAiSettings,
} from '@/services/aiService';
import { isTauri } from '@/utils/tauri';

const { Text, Paragraph, Title } = Typography;
const { TextArea } = Input;
const { Row, Col } = Grid;

interface Props {
  sessionId: number;
  record?: Record<string, any> | null;
}

const defaultQuestion =
  '请结合当前会话概览、关键数据包、数据流样本和必要的包详情，分析这条会话的行为特征，判断是否存在异常、失败握手、重传、可疑内容或敏感数据传输，并给出依据与建议。';

const quickQuestions = [
  '先给我一个整体结论，说明这条会话是否正常。',
  '重点排查是否有失败握手、RST、重传或超时。',
  '重点判断是否存在可疑流量、异常端口或异常协议组合。',
  '如果这是业务故障，请结合关键包推断最可能的原因。',
];

const defaultSettings: AiSettings = {
  base_url: '',
  api_key: '',
  model: '',
  system_prompt: '',
};

const AIAnalysisPanel: React.FC<Props> = ({ sessionId, record }) => {
  const [runtimeInfo, setRuntimeInfo] = useState<AiRuntimeInfo | null>(null);
  const [settings, setSettings] = useState<AiSettings>(defaultSettings);
  const [question, setQuestion] = useState(defaultQuestion);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [result, setResult] = useState<AiAnalysisResponse | null>(null);
  const panelScrollRef = useRef<HTMLDivElement | null>(null);
  const configCardRef = useRef<HTMLDivElement | null>(null);
  const resultCardRef = useRef<HTMLDivElement | null>(null);

  const sessionTitle = useMemo(() => {
    if (!record) {
      return `会话 #${sessionId}`;
    }
    const proto = record.appProto || record.transProto || 'Unknown';
    return `${record.ip1}:${record.ip1Port} -> ${record.ip2}:${record.ip2Port} (${proto})`;
  }, [record, sessionId]);

  const tools = runtimeInfo?.tools || [];
  const mcpReady = Boolean(runtimeInfo?.mcp_running);
  const isConfigured = Boolean(
    settings.base_url.trim() && settings.model.trim() && settings.api_key.trim()
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!runtimeInfo) {
      return false;
    }

    return (
      runtimeInfo.settings.base_url !== settings.base_url ||
      runtimeInfo.settings.api_key !== settings.api_key ||
      runtimeInfo.settings.model !== settings.model ||
      runtimeInfo.settings.system_prompt !== settings.system_prompt
    );
  }, [runtimeInfo, settings]);

  const loadRuntime = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const info = await getAiRuntimeInfo();
      setRuntimeInfo(info);
      setSettings(info.settings);
    } catch (error) {
      Message.error(`读取 AI 配置失败: ${String(error)}`);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    const container = panelScrollRef.current;
    const target = ref.current;
    if (!container || !target) {
      return;
    }

    const nextTop =
      container.scrollTop +
      target.getBoundingClientRect().top -
      container.getBoundingClientRect().top -
      8;

    container.scrollTo({
      top: Math.max(nextTop, 0),
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    void loadRuntime();
  }, []);

  useEffect(() => {
    setResult(null);
    setQuestion(defaultQuestion);
  }, [sessionId]);

  useEffect(() => {
    if (!result) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      scrollToSection(resultCardRef);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [result]);

  const updateSetting = (key: keyof AiSettings, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const validateSettings = () => {
    const missingFields: string[] = [];
    if (!settings.base_url.trim()) {
      missingFields.push('API Base URL');
    }
    if (!settings.model.trim()) {
      missingFields.push('Model');
    }
    if (!settings.api_key.trim()) {
      missingFields.push('API Key');
    }
    return missingFields;
  };

  const handleSave = async () => {
    const missingFields = validateSettings();
    if (missingFields.length > 0) {
      Message.warning(`请先补全: ${missingFields.join(' / ')}`);
      return;
    }

    setSaving(true);
    try {
      const info = await saveAiSettings(settings);
      setRuntimeInfo(info);
      setSettings(info.settings);
      Message.success('AI 配置已保存');
    } catch (error) {
      Message.error(`保存 AI 配置失败: ${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAnalyze = async () => {
    if (!isTauri()) {
      Message.error('AI 分析仅支持在 Tauri 桌面应用中运行');
      return;
    }

    const missingFields = validateSettings();
    if (missingFields.length > 0) {
      Message.warning(`请先补全: ${missingFields.join(' / ')}`);
      return;
    }

    if (!question.trim()) {
      Message.warning('请先输入你希望 AI 分析的问题');
      return;
    }

    if (!mcpReady) {
      Message.warning('本地 MCP 服务尚未就绪，请先刷新状态');
      return;
    }

    setAnalyzing(true);
    setResult(null);

    try {
      const info = await saveAiSettings(settings);
      setRuntimeInfo(info);
      setSettings(info.settings);

      const response = await analyzeSessionWithAi({
        session_id: sessionId,
        question: question.trim(),
        session_context: record || undefined,
      });

      setResult(response);
      Message.success('AI 分析已完成');
    } catch (error) {
      Message.error(`AI 分析失败: ${String(error)}`);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Spin loading={loading}>
      <div
        ref={panelScrollRef}
        style={{
          height: 'calc(100vh - 195px)',
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '0 20px 88px 20px',
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Card bordered={false}>
            <Space direction="vertical" size="medium" style={{ width: '100%' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 16,
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: '1 1 520px', minWidth: 320 }}>
                  <Title heading={6} style={{ marginBottom: 8 }}>
                    当前分析目标
                  </Title>
                  <Paragraph style={{ marginBottom: 10 }}>{sessionTitle}</Paragraph>
                  <Space wrap>
                    <Tag color={mcpReady ? 'green' : 'orange'}>
                      {mcpReady ? 'MCP 已启动' : 'MCP 未就绪'}
                    </Tag>
                    <Tag color={isConfigured ? 'arcoblue' : 'gray'}>
                      {isConfigured ? '模型配置已填写' : '模型配置未完成'}
                    </Tag>
                    <Tag color="purple">可调用工具 {tools.length} 个</Tag>
                  </Space>
                </div>

                <div style={{ flexShrink: 0 }}>
                  <Space wrap>
                    <Button onClick={() => void loadRuntime()} disabled={loading || saving || analyzing}>
                      刷新状态
                    </Button>
                    <Button
                      loading={saving}
                      onClick={handleSave}
                      type={hasUnsavedChanges ? 'primary' : 'secondary'}
                    >
                      保存配置
                    </Button>
                    <Button
                      type="primary"
                      loading={analyzing}
                      onClick={handleAnalyze}
                      disabled={!isConfigured || !mcpReady || !question.trim()}
                    >
                      开始 AI 分析
                    </Button>
                  </Space>
                </div>
              </div>

              <Alert
                type={mcpReady ? 'success' : 'warning'}
                showIcon
                content={
                  <div>
                    <div>使用方式：1. 输入问题 2. 填写或确认模型配置 3. 点击“开始 AI 分析”。</div>
                    <div style={{ marginTop: 4 }}>
                      {runtimeInfo?.mcp_url
                        ? `本地 MCP 地址：${runtimeInfo.mcp_url}`
                        : '本地 MCP 地址尚未获取到。'}
                    </div>
                  </div>
                }
              />
            </Space>
          </Card>

          <Card title="分析问题" bordered={false}>
            <Space direction="vertical" size="medium" style={{ width: '100%' }}>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                在这里直接输入你想让 AI 重点回答的问题。分析完成后，页面会自动滚动到结果区。
              </Paragraph>

              <div>
                <div style={{ marginBottom: 6 }}>
                  <Text type="secondary">问题输入</Text>
                </div>
                <TextArea
                  autoSize={{ minRows: 5, maxRows: 8 }}
                  value={question}
                  onChange={setQuestion}
                  placeholder="例如：这条会话是否正常？有没有失败握手、重传、RST 或可疑载荷？"
                />
              </div>

              <div>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary">常用问题</Text>
                </div>
                <Space wrap>
                  {quickQuestions.map((item) => (
                    <Button key={item} size="small" onClick={() => setQuestion(item)}>
                      {item}
                    </Button>
                  ))}
                  <Button size="small" type="outline" onClick={() => setQuestion(defaultQuestion)}>
                    恢复默认问题
                  </Button>
                </Space>
              </div>

              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                问题越具体，AI 调用工具后的结论通常越有针对性。你也可以先用默认问题跑一遍，再追问细节。
              </Paragraph>
            </Space>
          </Card>

          <div ref={configCardRef}>
            <Card title="连接配置" bordered={false}>
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <div style={{ marginBottom: 6 }}>
                      <Text type="secondary">API Base URL</Text>
                    </div>
                    <Input
                      placeholder="例如：https://api.openai.com/v1"
                      value={settings.base_url}
                      onChange={(value) => updateSetting('base_url', value)}
                    />
                  </Col>
                  <Col span={12}>
                    <div style={{ marginBottom: 6 }}>
                      <Text type="secondary">Model</Text>
                    </div>
                    <Input
                      placeholder="例如：gpt-4.1-mini / deepseek-chat"
                      value={settings.model}
                      onChange={(value) => updateSetting('model', value)}
                    />
                  </Col>
                </Row>

                <div>
                  <div style={{ marginBottom: 6 }}>
                    <Text type="secondary">API Key</Text>
                  </div>
                  <Input.Password
                    placeholder="输入你的 API Key"
                    value={settings.api_key}
                    onChange={(value) => updateSetting('api_key', value)}
                  />
                </div>

                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <Text type="secondary">高级设置</Text>
                    <Button
                      type="text"
                      size="small"
                      onClick={() => setShowSystemPrompt((prev) => !prev)}
                    >
                      {showSystemPrompt ? '收起 System Prompt' : '展开 System Prompt（可选）'}
                    </Button>
                  </div>
                  {showSystemPrompt ? (
                    <TextArea
                      autoSize={{ minRows: 5, maxRows: 10 }}
                      placeholder="可选：不填写时会使用内置的网络流量分析提示词。"
                      value={settings.system_prompt}
                      onChange={(value) => updateSetting('system_prompt', value)}
                    />
                  ) : (
                    <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      默认即可。不填写时会使用应用内置的网络流量分析提示词。
                    </Paragraph>
                  )}
                </div>

                <div>
                  <Text type="secondary">当前可调用工具</Text>
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {tools.length > 0 ? (
                      tools.map((tool) => (
                        <Tag key={tool.name} bordered color="arcoblue">
                          {tool.name}
                        </Tag>
                      ))
                    ) : (
                      <Tag color="gray">暂无工具信息</Tag>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                    flexWrap: 'wrap',
                  }}
                >
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    配置保存在当前桌面应用本地。保存后仍可继续修改，改完再次点击“保存配置”即可生效。
                  </Paragraph>
                  <Button
                    loading={saving}
                    onClick={handleSave}
                    type={hasUnsavedChanges ? 'primary' : 'secondary'}
                  >
                    保存配置
                  </Button>
                </div>
              </Space>
            </Card>
          </div>

          <div ref={resultCardRef}>
            <Card title="分析结果" bordered={false}>
              {analyzing ? (
                <div style={{ padding: '16px 0' }}>
                  <Space direction="vertical" size="medium" style={{ width: '100%' }}>
                    <Spin />
                    <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                      正在调用模型和本地工具分析当前会话，完成后会自动滚动到这里。
                    </Paragraph>
                  </Space>
                </div>
              ) : result ? (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                      <Tag color="arcoblue">模型：{result.model}</Tag>
                      {result.mcp_url ? <Tag color="green">MCP：{result.mcp_url}</Tag> : null}
                      <Tag color="purple">工具调用：{result.tool_calls?.length || 0} 次</Tag>
                    </div>
                    <Button type="secondary" onClick={() => scrollToSection(configCardRef)}>
                      返回修改配置
                    </Button>
                  </div>

                  <div>
                    <Title heading={6} style={{ marginBottom: 12 }}>
                      结论
                    </Title>
                    <div
                      style={{
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.8,
                        padding: 16,
                        borderRadius: 12,
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                      }}
                    >
                      {result.answer}
                    </div>
                  </div>

                  {result.tool_calls?.length ? (
                    <div>
                      <Title heading={6} style={{ marginBottom: 12 }}>
                        工具调用轨迹
                      </Title>
                      <Collapse defaultActiveKey={['trace-0']}>
                        {result.tool_calls.map((trace, index) => (
                          <Collapse.Item
                            key={`trace-${index}`}
                            name={`trace-${index}`}
                            header={`${trace.name}${trace.is_error ? '（失败）' : ''}`}
                          >
                            <Space direction="vertical" size="small" style={{ width: '100%' }}>
                              <div>
                                <Text bold>参数</Text>
                                <pre
                                  style={{
                                    marginTop: 8,
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    background: 'rgba(0, 0, 0, 0.18)',
                                    padding: 12,
                                    borderRadius: 8,
                                  }}
                                >
                                  {JSON.stringify(trace.arguments, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <Text bold>返回摘要</Text>
                                <pre
                                  style={{
                                    marginTop: 8,
                                    whiteSpace: 'pre-wrap',
                                    wordBreak: 'break-word',
                                    background: 'rgba(0, 0, 0, 0.18)',
                                    padding: 12,
                                    borderRadius: 8,
                                  }}
                                >
                                  {trace.result_preview}
                                </pre>
                              </div>
                            </Space>
                          </Collapse.Item>
                        ))}
                      </Collapse>
                    </div>
                  ) : null}
                </Space>
              ) : (
                <Empty description="先输入问题并点击“开始 AI 分析”，结果会显示在这里。" />
              )}
            </Card>
          </div>
        </Space>
      </div>
    </Spin>
  );
};

export default AIAnalysisPanel;
