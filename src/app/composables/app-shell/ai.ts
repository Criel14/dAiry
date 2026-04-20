import type { AiSettings } from '../../../types/ai'
import type { AppShellState } from './state'

export function useAppShellAi(state: AppShellState) {
  async function handleSaveAiConfiguration(
    input: AiSettings & {
      apiKey: string
    },
  ) {
    state.isSavingAiConfig.value = true
    state.aiSaveMessage.value = ''

    try {
      const settingsStatus = await window.dairy.saveAiSettings({
        providerType: input.providerType,
        baseURL: input.baseURL,
        model: input.model,
        timeoutMs: input.timeoutMs,
      })
      state.aiSettingsStatus.value = settingsStatus

      const apiKey = input.apiKey.trim()
      if (!apiKey) {
        state.aiSaveMessage.value = '大模型配置已保存。'
        return
      }

      try {
        const nextStatus = await window.dairy.saveAiApiKey({
          providerType: input.providerType,
          apiKey,
        })
        state.aiSettingsStatus.value = nextStatus
        state.aiSaveMessage.value = '大模型配置和 API Key 已保存。'
      } catch (error) {
        state.aiSaveMessage.value = `大模型配置已保存，但 API Key 保存失败：${
          error instanceof Error ? error.message : '请稍后重试。'
        }`
      }
    } catch (error) {
      state.aiSaveMessage.value =
        error instanceof Error ? error.message : '保存大模型配置失败，请稍后重试。'
    } finally {
      state.isSavingAiConfig.value = false
    }
  }

  async function handleSaveAiContext(content: string) {
    state.isSavingAiContext.value = true
    state.aiContextSaveMessage.value = ''

    try {
      const nextDocument = await window.dairy.saveAiContext({ content })
      state.aiContextDocument.value = nextDocument
      state.aiContextSaveMessage.value = '补充知识已保存。'
    } catch (error) {
      state.aiContextSaveMessage.value =
        error instanceof Error ? error.message : '保存补充知识失败，请稍后重试。'
    } finally {
      state.isSavingAiContext.value = false
    }
  }

  return {
    handleSaveAiConfiguration,
    handleSaveAiContext,
  }
}
