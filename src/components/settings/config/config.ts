import type { AiProviderType, AiSettings } from '../../../types/ai'
import type { AppTheme, WindowCloseBehavior } from '../../../types/app'
import {
  WINDOW_ZOOM_PRESET_FACTORS,
  formatWindowZoomPercent,
} from '../../../shared/window-zoom'

export type SettingsSectionId =
  | 'appearance'
  | 'display'
  | 'notifications'
  | 'shortcuts'
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

export interface ThemeOption {
  value: AppTheme
  label: string
}

export interface WindowCloseBehaviorOption {
  value: WindowCloseBehavior
  label: string
}

export interface WorkspaceLibrariesValue {
  tags: string[]
  weatherOptions: string[]
  locationOptions: string[]
}

export interface ShortcutItem {
  id: string
  label: string
  description: string
  bindings: ShortcutBinding[]
}

export interface ShortcutBinding {
  id: string
  keys: string[]
}

export interface ShortcutGroup {
  id: string
  label?: string
  description?: string
  items: ShortcutItem[]
}

export const SETTINGS_SECTIONS: SettingsSectionItem[] = [
  {
    id: 'appearance',
    label: '外观',
    description: '调整整体界面缩放和月历显示方式，让布局密度更贴合你的写作习惯。',
  },
  {
    id: 'display',
    label: '编辑器',
    description: '调整写作时间规则、关闭窗口行为和日记信息字段，减少不必要的录入压力。',
  },
  {
    id: 'notifications',
    label: '通知',
    description: '设置每日写日记提醒时间；应用运行时都可提醒，直接关闭应用后则不会继续通知。',
  },
  {
    id: 'shortcuts',
    label: '快捷键',
    description: '暂不支持自定义或修改快捷键。',
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
    description: '',
  },
]

export const AI_PROVIDER_OPTIONS: AiProviderOption[] = [
  { value: 'openai-compatible', label: 'OpenAI Compatible' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'alibaba', label: '阿里百炼 / Qwen' },
]

export const DAY_START_HOUR_OPTIONS = [0, 1, 2, 3, 4, 5, 6]

export const WINDOW_CLOSE_BEHAVIOR_OPTIONS: WindowCloseBehaviorOption[] = [
  { value: 'tray', label: '最小化到托盘' },
  { value: 'quit', label: '直接关闭应用' },
]

export const WINDOW_ZOOM_OPTIONS = WINDOW_ZOOM_PRESET_FACTORS.map((value) => ({
  value,
  label: formatWindowZoomPercent(value),
}))

export const THEME_OPTIONS: ThemeOption[] = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
]

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    id: 'editor-actions',
    items: [
      {
        id: 'save-entry',
        label: '保存当前内容',
        description: '保存正文和已修改的日记信息。',
        bindings: [
          {
            id: 'default',
            keys: ['Ctrl', 'S'],
          },
        ],
      },
      {
        id: 'zoom-in',
        label: '放大界面',
        description: '提升整个应用界面的显示比例。',
        bindings: [
          {
            id: 'default',
            keys: ['Ctrl', '=/+'],
          },
        ],
      },
      {
        id: 'zoom-out',
        label: '缩小界面',
        description: '降低整个应用界面的显示比例。',
        bindings: [
          {
            id: 'default',
            keys: ['Ctrl', '-'],
          },
        ],
      },
      {
        id: 'zoom-reset',
        label: '重置界面缩放',
        description: '将整体缩放恢复到默认的 100%。',
        bindings: [
          {
            id: 'default',
            keys: ['Ctrl', '0'],
          },
        ],
      },
    ],
  },
]

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
        baseURL: 'https://api.deepseek.com',
        model: 'deepseek-v4-flash',
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
