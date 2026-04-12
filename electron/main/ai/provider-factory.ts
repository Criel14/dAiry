import type { AiSettings } from '../../../src/types/dairy'

interface ChatCompletionMessage {
  role: 'system' | 'user'
  content: string
}

interface ChatCompletionRequest {
  messages: ChatCompletionMessage[]
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
}

export function createAiChatClient(settings: AiSettings, apiKey: string): AiChatClient {
  const supportsJsonMode =
    settings.providerType === 'openai' || settings.providerType === 'openai-compatible'

  return {
    async completeJson(input) {
      const response = await fetch(resolveEndpoint(settings.baseURL), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: settings.model,
          temperature: 0.2,
          ...(supportsJsonMode ? { response_format: { type: 'json_object' } } : {}),
          messages: input.messages,
        }),
        signal: AbortSignal.timeout(settings.timeoutMs),
      })

      const payload = (await response.json().catch(() => null)) as ChatCompletionResponse | null
      if (!response.ok) {
        throw new Error(payload?.error?.message || `AI 请求失败（${response.status}）。`)
      }

      const content = payload ? extractResponseText(payload) : ''
      if (!content.trim()) {
        throw new Error('AI 没有返回可用内容，请稍后重试。')
      }

      return content
    },
  }
}
