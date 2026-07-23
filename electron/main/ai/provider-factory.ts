import type { AiSettings } from '../../../src/types/ai'

interface ChatCompletionMessage {
  role: 'system' | 'user'
  content: string
}

interface ChatCompletionRequest {
  messages: ChatCompletionMessage[]
}

interface ChatCompletionTextRequest extends ChatCompletionRequest {
  temperature?: number
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            type?: string
            text?: string
          }>
    }
  }>
  error?: {
    message?: string
  }
}

function normalizeBaseURL(baseURL: string) {
  return baseURL.trim().replace(/\/+$/, '')
}

function resolveEndpoint(baseURL: string) {
  return `${normalizeBaseURL(baseURL)}/chat/completions`
}

function extractResponseText(response: ChatCompletionResponse) {
  const content = response.choices?.[0]?.message?.content

  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => (item.type === 'text' && typeof item.text === 'string' ? item.text : ''))
      .join('')
  }

  return ''
}

export interface AiChatClient {
  completeJson: (input: ChatCompletionRequest) => Promise<string>
  completeText: (input: ChatCompletionTextRequest) => Promise<string>
}

export function createAiChatClient(settings: AiSettings, apiKey: string, timeoutMs?: number): AiChatClient {
  const effectiveTimeout = timeoutMs ?? settings.timeoutMs
  const supportsJsonMode =
    settings.providerType === 'openai' || settings.providerType === 'openai-compatible'

  async function requestChatCompletion(body: Record<string, unknown>) {
    const response = await fetch(resolveEndpoint(settings.baseURL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(effectiveTimeout),
    })

    let rawBody: string
    let bodyReadFailed = false
    try {
      rawBody = await response.text()
    } catch {
      rawBody = ''
      bodyReadFailed = true
    }

    let payload: ChatCompletionResponse | null = null
    try {
      payload = JSON.parse(rawBody) as ChatCompletionResponse
    } catch {
      payload = null
    }

    if (!response.ok) {
      throw new Error(payload?.error?.message || `AI 请求失败（${response.status}）。`)
    }

    if (bodyReadFailed) {
      throw new Error('读取大模型响应超时，请检查网络或适当增大超时时间。')
    }

    const content = payload ? extractResponseText(payload) : ''
    if (!content.trim()) {
      console.warn('[ai] 大模型返回空内容，原始响应：', rawBody.slice(0, 500))
      throw new Error('AI 没有返回可用内容，请稍后重试。')
    }

    return content
  }

  return {
    async completeJson(input) {
      return requestChatCompletion({
        model: settings.model,
        temperature: 0.2,
        ...(supportsJsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages: input.messages,
      })
    },
    async completeText(input) {
      return requestChatCompletion({
        model: settings.model,
        temperature: input.temperature ?? 0.3,
        messages: input.messages,
      })
    },
  }
}
