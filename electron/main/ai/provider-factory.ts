import type { AiSettings } from '../../../src/types/ai'

interface ChatCompletionMessage {
  role: 'system' | 'user'
  content: string
}

interface ChatCompletionRequest {
  messages: ChatCompletionMessage[]
  thinking?: boolean
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
      reasoning_content?: string
    }
  }>
  error?: {
    message?: string
  }
}

interface ClaudeResponse {
  content?: Array<{
    type: string
    text?: string
  }>
  error?: {
    type?: string
    message?: string
  }
}

const THINKING_PARAMS: Record<string, Record<string, unknown>> = {
  deepseek: { thinking: { type: 'enabled' } },
  openai: { reasoning: { effort: 'medium' } },
  alibaba: { enable_thinking: true },
  claude: { thinking: { type: 'enabled', budget_tokens: 4096 } },
  kimi: { enable_thinking: true },
  zhipu: { thinking: { type: 'enabled' } },
}

function normalizeBaseURL(baseURL: string) {
  return baseURL.trim().replace(/\/+$/, '')
}

function resolveOpenAiEndpoint(baseURL: string) {
  return `${normalizeBaseURL(baseURL)}/chat/completions`
}

function resolveClaudeEndpoint(baseURL: string) {
  return `${normalizeBaseURL(baseURL)}/v1/messages`
}

function extractResponseText(response: ChatCompletionResponse) {
  const message = response.choices?.[0]?.message

  if (typeof message?.content === 'string' && message.content.trim()) {
    return message.content
  }

  if (Array.isArray(message?.content)) {
    const joinedText = message.content
      .map((item) => (item.type === 'text' && typeof item.text === 'string' ? item.text : ''))
      .join('')
    if (joinedText.trim()) {
      return joinedText
    }
  }

  return message?.reasoning_content ?? ''
}

function extractClaudeResponseText(response: ClaudeResponse) {
  const content = response.content
  if (!Array.isArray(content)) {
    return ''
  }

  return content
    .filter(
      (block): block is { type: string; text: string } =>
        block.type === 'text' && typeof block.text === 'string',
    )
    .map((block) => block.text)
    .join('')
}

function injectThinking(
  body: Record<string, unknown>,
  thinking: boolean | undefined,
  providerType: string,
) {
  if (!thinking) {
    return body
  }

  const params = THINKING_PARAMS[providerType]
  if (!params) {
    return body
  }

  return { ...body, ...params }
}

function isClaudeProvider(providerType: string) {
  return providerType === 'claude'
}

export const AI_ERROR_CODES = {
  TIMEOUT: 'ai:timeout',
  NETWORK: 'ai:network',
  HTTP4XX: 'ai:http4xx',
  HTTP5XX: 'ai:http5xx',
  EMPTY: 'ai:empty',
} as const

function markAiError(error: unknown, code: string): Error {
  if (error instanceof Error) {
    ;(error as Error & { code?: string }).code = code
    return error
  }

  const wrapped = new Error(String(error))
  ;(wrapped as Error & { code?: string }).code = code
  return wrapped
}

function isTimeoutError(error: unknown) {
  return (
    error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
  )
}

export interface AiChatClient {
  completeJson: (input: ChatCompletionRequest) => Promise<string>
  completeText: (input: ChatCompletionTextRequest) => Promise<string>
}

export function createAiChatClient(
  settings: AiSettings,
  apiKey: string,
  timeoutMs?: number,
): AiChatClient {
  const effectiveTimeout = timeoutMs ?? settings.timeoutMs
  const supportsJsonMode =
    settings.providerType === 'openai' || settings.providerType === 'openai-compatible'

  async function requestOpenAiChatCompletion(body: Record<string, unknown>) {
    let response: Response
    try {
      response = await fetch(resolveOpenAiEndpoint(settings.baseURL), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(effectiveTimeout),
      })
    } catch (err) {
      if (isTimeoutError(err)) {
        throw markAiError(err, AI_ERROR_CODES.TIMEOUT)
      }
      throw markAiError(err, AI_ERROR_CODES.NETWORK)
    }

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
      const code =
        response.status >= 500 ? AI_ERROR_CODES.HTTP5XX : AI_ERROR_CODES.HTTP4XX
      throw markAiError(
        new Error(payload?.error?.message || `AI 请求失败（${response.status}）。`),
        code,
      )
    }

    if (bodyReadFailed) {
      throw markAiError(
        new Error('读取大模型响应超时，请检查网络或适当增大超时时间。'),
        AI_ERROR_CODES.TIMEOUT,
      )
    }

    const content = payload ? extractResponseText(payload) : ''
    if (!content.trim()) {
      console.warn('[ai] 大模型返回空内容，原始响应：', rawBody.slice(0, 500))
      throw markAiError(new Error('AI 没有返回可用内容，请稍后重试。'), AI_ERROR_CODES.EMPTY)
    }

    return content
  }

  async function requestClaudeChatCompletion(body: Record<string, unknown>) {
    let response: Response
    try {
      response = await fetch(resolveClaudeEndpoint(settings.baseURL), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(effectiveTimeout),
      })
    } catch (err) {
      if (isTimeoutError(err)) {
        throw markAiError(err, AI_ERROR_CODES.TIMEOUT)
      }
      throw markAiError(err, AI_ERROR_CODES.NETWORK)
    }

    let rawBody: string
    let bodyReadFailed = false
    try {
      rawBody = await response.text()
    } catch {
      rawBody = ''
      bodyReadFailed = true
    }

    let payload: ClaudeResponse | null = null
    try {
      payload = JSON.parse(rawBody) as ClaudeResponse
    } catch {
      payload = null
    }

    if (!response.ok) {
      const code =
        response.status >= 500 ? AI_ERROR_CODES.HTTP5XX : AI_ERROR_CODES.HTTP4XX
      throw markAiError(
        new Error(payload?.error?.message || `AI 请求失败（${response.status}）。`),
        code,
      )
    }

    if (bodyReadFailed) {
      throw markAiError(
        new Error('读取大模型响应超时，请检查网络或适当增大超时时间。'),
        AI_ERROR_CODES.TIMEOUT,
      )
    }

    const content = payload ? extractClaudeResponseText(payload) : ''
    if (!content.trim()) {
      console.warn('[ai] Claude 返回空内容，原始响应：', rawBody.slice(0, 500))
      throw markAiError(new Error('AI 没有返回可用内容，请稍后重试。'), AI_ERROR_CODES.EMPTY)
    }

    return content
  }

  function buildClaudeBody(messages: ChatCompletionMessage[]) {
    const systemMsg = messages.find((m) => m.role === 'system')
    const userMsgs = messages.filter((m) => m.role !== 'system')

    const body: Record<string, unknown> = {
      model: settings.model,
      max_tokens: 4096,
      messages: userMsgs,
    }

    if (systemMsg) {
      body.system = systemMsg.content
    }

    return body
  }

  if (isClaudeProvider(settings.providerType)) {
    return {
      async completeJson(input) {
        const body = buildClaudeBody(input.messages)
        return requestClaudeChatCompletion(
          injectThinking(body, input.thinking, settings.providerType),
        )
      },
      async completeText(input) {
        const body = buildClaudeBody(input.messages)
        return requestClaudeChatCompletion(
          injectThinking(body, input.thinking, settings.providerType),
        )
      },
    }
  }

  return {
    async completeJson(input) {
      return requestOpenAiChatCompletion(
        injectThinking(
          {
            model: settings.model,
            temperature: 0.2,
            ...(supportsJsonMode ? { response_format: { type: 'json_object' } } : {}),
            messages: input.messages,
          },
          input.thinking,
          settings.providerType,
        ),
      )
    },
    async completeText(input) {
      return requestOpenAiChatCompletion(
        injectThinking(
          {
            model: settings.model,
            temperature: input.temperature ?? 0.3,
            messages: input.messages,
          },
          input.thinking,
          settings.providerType,
        ),
      )
    },
  }
}
