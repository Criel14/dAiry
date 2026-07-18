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

export function createAiChatClient(settings: AiSettings, apiKey: string): AiChatClient {
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
      signal: AbortSignal.timeout(settings.timeoutMs),
    })

    let rawBody = ''
    try {
      rawBody = await response.text()
    } catch {
      console.warn(
        '[provider] 读取响应 body 失败，status=%d statusText=%s contentType=%s',
        response.status,
        response.statusText,
        response.headers.get('content-type') ?? '(无)',
      )
      rawBody = ''
    }

    let payload: ChatCompletionResponse | null = null
    try {
      payload = JSON.parse(rawBody) as ChatCompletionResponse
    } catch {
      console.warn('[provider] JSON 解析失败，status=%d body 前 300 字：%s', response.status, rawBody.slice(0, 300))
    }

    if (!response.ok) {
      throw new Error(payload?.error?.message || `AI 请求失败（${response.status}）。`)
    }

    const content = payload ? extractResponseText(payload) : ''
    if (!content.trim()) {
      console.warn('[provider] AI 返回为空，payload：', JSON.stringify(payload).slice(0, 500))
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
