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
        dailyContextDays: input.dailyContextDays,
        profileRefreshIntervalDays: input.profileRefreshIntervalDays,
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

  async function handleRebuildUserProfile() {
    if (state.isRebuildingProfile.value) {
      return
    }

    if (!state.workspacePath.value) {
      state.profileRebuildMessage.value = '请先选择工作区。'
      return
    }

    const confirmed = window.confirm(
      '将扫描当前工作区的全部日记，按月重新构建用户画像（每个有日记的月份消耗一轮 AI 调用，token 消耗较大）。整理完成前现有画像保持不变，是否继续？',
    )
    if (!confirmed) {
      return
    }

    state.isRebuildingProfile.value = true
    state.isCancellingProfileRebuild.value = false
    state.profileRebuildProgress.value = null
    state.profileRebuildMessage.value = ''

    try {
      const result = await window.dairy.rebuildUserProfile({
        workspacePath: `${state.workspacePath.value}`,
      })

      state.profileRebuildMessage.value =
        result.status === 'completed'
          ? `画像整理完成（共 ${result.totalMonths} 个月）。`
          : '已取消，现有画像未受影响。'
    } catch (error) {
      state.profileRebuildMessage.value = `${
        error instanceof Error ? error.message : '画像整理失败，请稍后重试。'
      }现有画像未受影响。`
    } finally {
      state.isRebuildingProfile.value = false
      state.isCancellingProfileRebuild.value = false
      state.profileRebuildProgress.value = null
    }
  }

  async function handleCancelUserProfileRebuild() {
    if (!state.isRebuildingProfile.value || state.isCancellingProfileRebuild.value) {
      return
    }

    state.isCancellingProfileRebuild.value = true

    try {
      await window.dairy.cancelUserProfileRebuild()
    } catch {
      state.isCancellingProfileRebuild.value = false
    }
  }

  return {
    handleSaveAiConfiguration,
    handleSaveAiContext,
    handleRebuildUserProfile,
    handleCancelUserProfileRebuild,
  }
}
