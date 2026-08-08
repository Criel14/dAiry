import type { AiSettings } from '../../../src/types/ai'
import { createAiChatClient } from './provider-factory'
import { withAiRetry } from './retry'

export interface RangeReportChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface RangeReportChatOptions {
  thinking?: boolean
  label?: string
}

const THINKING_TIMEOUT_FLOOR_MS = 180_000
const NORMAL_TIMEOUT_FLOOR_MS = 60_000

/**
 * 区间报告多轮总结会话。
 * 主进程内维护单次报告的 messages 数组，每轮一次 API 请求；
 * 每轮包 withAiRetry 递增重试，thinking 轮超时下限单独放大。
 */
export function createRangeReportChat(
  settings: AiSettings,
  apiKey: string,
  systemPrompt: string,
) {
  const messages: RangeReportChatMessage[] = [{ role: 'system', content: systemPrompt }]

  return {
    messages,

    /** 追加一轮历史往返（用于把上一轮的 AI 选日结果带入本轮）。 */
    appendRoundTrip(userContent: string, assistantContent: string) {
      messages.push({ role: 'user', content: userContent }, { role: 'assistant', content: assistantContent })
    },

    /** 发送一轮对话，成功后把 AI 回复追加进会话历史；失败回滚本条 user 消息并抛出。 */
    async send(userContent: string, options: RangeReportChatOptions = {}) {
      const thinking = options.thinking ?? false
      const label = options.label ?? '区间总结'
      const minTimeoutMs = thinking
        ? Math.max(settings.timeoutMs, THINKING_TIMEOUT_FLOOR_MS)
        : Math.max(settings.timeoutMs, NORMAL_TIMEOUT_FLOOR_MS)

      messages.push({ role: 'user', content: userContent })

      try {
        const responseText = await withAiRetry(
          (timeoutMs) => createAiChatClient(settings, apiKey, timeoutMs),
          (client) =>
            client.completeJson({
              messages,
              thinking,
            }),
          { minTimeoutMs, label },
        )

        messages.push({ role: 'assistant', content: responseText })
        return responseText
      } catch (error) {
        messages.pop()
        throw error
      }
    },
  }
}

export type RangeReportChat = ReturnType<typeof createRangeReportChat>
