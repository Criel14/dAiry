import type { AiProviderType, AiSettings } from '../../types/dairy'

export type SettingsSectionId =
  | 'appearance'
  | 'display'
  | 'llm'
  | 'libraries'
  | 'workspace'
  | 'about'

export interface SettingsSectionItem {
  id: SettingsSectionId
  label: string
  description: string
}

export interface AiProviderOption {
  value: AiProviderType
  label: string
}

export interface WorkspaceLibrariesValue {
  tags: string[]
  weatherOptions: string[]
  locationOptions: string[]
}

export const SETTINGS_SECTIONS: SettingsSectionItem[] = [
  {
    id: 'appearance',
    label: '外观',
    description: '控制月历区域的显示方式，让首页信息密度更贴合你的写作习惯。',
  },
  {
    id: 'display',
    label: '编辑器',
    description: '调整写作时间规则和日记信息字段，减少不必要的录入压力。',
  },
  {
    id: 'llm',
    label: '大模型',
    description: '配置自动整理能力所需的 provider、模型参数与 API Key。',
  },
  {
    id: 'libraries',
    label: '词库',
    description: '维护天气、地点和标签候选词，让元数据输入更顺手。',
  },
  {
    id: 'workspace',
    label: '工作区',
    description: '查看当前日记目录的连接状态，确认本地数据落点是否正确。',
  },
  {
    id: 'about',
    label: '关于',
    description: '查看版本信息、项目入口和调试工具，方便排查与反馈。',
  },
]

export const AI_PROVIDER_OPTIONS: AiProviderOption[] = [
  { value: 'openai-compatible', label: 'OpenAI Compatible' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'alibaba', label: '阿里百炼 / Qwen' },
]

export const DAY_START_HOUR_OPTIONS = [0, 1, 2, 3, 4, 5, 6]

export function getAiDefaults(providerType: AiProviderType): AiSettings {
  switch (providerType) {
    case 'openai':
      return {
        providerType,
        baseURL: 'https://api.openai.com/v1',
        model: 'gpt-4.1-mini',
        timeoutMs: 30000,
      }
    case 'deepseek':
      return {
        providerType,
        baseURL: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat',
        timeoutMs: 30000,
      }
    case 'alibaba':
      return {
        providerType,
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: 'qwen-plus',
        timeoutMs: 30000,
      }
    default:
      return {
        providerType,
        baseURL: 'https://api.openai.com/v1',
        model: 'gpt-4.1-mini',
        timeoutMs: 30000,
      }
  }
}
