import { AI_ERROR_CODES, type AiChatClient } from './provider-factory'

export function isRetryableAiError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code
  return (
    code === AI_ERROR_CODES.TIMEOUT ||
    code === AI_ERROR_CODES.NETWORK ||
    code === AI_ERROR_CODES.HTTP5XX ||
    code === AI_ERROR_CODES.EMPTY
  )
}

export interface WithAiRetryOptions {
  minTimeoutMs: number
  maxAttempts?: number
  timeoutIncrementMs?: number
  label?: string
}

/**
 * 递增超时重试：每次失败按超时 + 递增时长重新发起请求，
 * 仅对超时/网络/5xx 类错误重试，其余错误立即抛出。
 */
export async function withAiRetry<T>(
  createClient: (timeoutMs: number) => AiChatClient,
  task: (client: AiChatClient) => Promise<T>,
  options: WithAiRetryOptions,
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3
  const incrementMs = options.timeoutIncrementMs ?? 60_000
  const label = options.label ?? 'AI 调用'

  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const timeoutMs = options.minTimeoutMs + attempt * incrementMs

    try {
      const client = createClient(timeoutMs)
      return await task(client)
    } catch (err) {
      lastError = err

      if (!isRetryableAiError(err) || attempt === maxAttempts - 1) {
        throw err
      }

      console.warn(
        `[ai] ${label}第 ${attempt + 1} 次尝试失败（超时 ${timeoutMs}ms），将加大超时自动重试。`,
        err,
      )
    }
  }

  throw lastError
}
