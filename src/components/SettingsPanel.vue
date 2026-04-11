<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SettingsInfoTip from './SettingsInfoTip.vue'
import StringListEditor from './StringListEditor.vue'
import type { FrontmatterVisibilityConfig } from '../types/dairy'

type SettingsSectionId = 'appearance' | 'display' | 'libraries' | 'workspace'

interface SettingsSectionItem {
  id: SettingsSectionId
  label: string
}

const props = defineProps<{
  workspacePath: string | null
  journalHeatmapEnabled: boolean
  isSavingJournalHeatmap: boolean
  heatmapSaveMessage: string
  frontmatterVisibility: FrontmatterVisibilityConfig
  isSavingFrontmatterVisibility: boolean
  frontmatterVisibilitySaveMessage: string
  workspaceTags: string[]
  workspaceWeatherOptions: string[]
  workspaceLocationOptions: string[]
  isSavingWorkspaceLibraries: boolean
  workspaceLibrariesSaveMessage: string
}>()

defineEmits<{
  'update:journalHeatmapEnabled': [value: boolean]
  'update:frontmatterVisibility': [value: FrontmatterVisibilityConfig]
  saveWorkspaceLibraries: [
    value: {
      tags: string[]
      weatherOptions: string[]
      locationOptions: string[]
    },
  ]
}>()

const settingsSections: SettingsSectionItem[] = [
  { id: 'appearance', label: '外观' },
  { id: 'display', label: '编辑器' },
  { id: 'libraries', label: '词库' },
  { id: 'workspace', label: '工作区' },
]

const activeSectionId = ref<SettingsSectionId>('appearance')
const draftTags = ref<string[]>([])
const draftWeatherOptions = ref<string[]>([])
const draftLocationOptions = ref<string[]>([])

watch(
  () => props.workspaceTags,
  (value) => {
    draftTags.value = [...value]
  },
  { immediate: true },
)

watch(
  () => props.workspaceWeatherOptions,
  (value) => {
    draftWeatherOptions.value = [...value]
  },
  { immediate: true },
)

watch(
  () => props.workspaceLocationOptions,
  (value) => {
    draftLocationOptions.value = [...value]
  },
  { immediate: true },
)

const hasWorkspace = computed(() => Boolean(props.workspacePath))
const isWorkspaceLibrariesDirty = computed(() => {
  return (
    JSON.stringify(draftTags.value) !== JSON.stringify(props.workspaceTags) ||
    JSON.stringify(draftWeatherOptions.value) !== JSON.stringify(props.workspaceWeatherOptions) ||
    JSON.stringify(draftLocationOptions.value) !== JSON.stringify(props.workspaceLocationOptions)
  )
})
</script>

<template>
  <section class="settings-panel">
    <aside class="settings-nav">
      <div class="settings-nav-header">
        <h3 class="settings-nav-title">设置</h3>
      </div>

      <nav class="settings-nav-list" aria-label="设置分组">
        <button
          v-for="section in settingsSections"
          :key="section.id"
          class="settings-nav-item"
          :class="{ 'settings-nav-item--active': activeSectionId === section.id }"
          type="button"
          @click="activeSectionId = section.id"
        >
          <span class="settings-nav-item-label">{{ section.label }}</span>
        </button>
      </nav>
    </aside>

    <div class="settings-content">
      <div v-if="activeSectionId === 'appearance'" class="settings-section">
        <section class="settings-card">
          <div class="panel-heading">
            <span class="panel-label">日历显示</span>
          </div>

          <div class="setting-row">
            <div class="setting-copy">
              <div class="setting-title-row">
                <strong class="panel-value">字数热力图</strong>
                <SettingsInfoTip text="按照以下的字数划分等级: 0, 1~149, 151~399, 400~699, 700+, 颜色由浅到深" />
              </div>
              <p class="panel-description">开启后，月历会按当天日记字数显示深浅变化。</p>
            </div>

            <button
              class="switch-button"
              :class="{ 'switch-button--active': journalHeatmapEnabled }"
              type="button"
              :disabled="isSavingJournalHeatmap"
              :aria-pressed="journalHeatmapEnabled"
              :aria-label="journalHeatmapEnabled ? '关闭字数热力图' : '开启字数热力图'"
              @click="$emit('update:journalHeatmapEnabled', !journalHeatmapEnabled)"
            >
              <span class="switch-track" aria-hidden="true">
                <span class="switch-thumb" />
              </span>
            </button>
          </div>

          <p v-if="heatmapSaveMessage" class="setting-feedback">
            {{ heatmapSaveMessage }}
          </p>
        </section>
      </div>

      <div v-else-if="activeSectionId === 'display'" class="settings-section">
        <section class="settings-card">
          <div class="panel-heading">
            <span class="panel-label">日记信息展示</span>
            <SettingsInfoTip text="通过 markdown 的 frontmatter 实现每个日记文件的元数据管理" />
          </div>
          <p class="panel-description">调整日记所包含的基础信息。</p>

          <div class="settings-grid">
            <div class="setting-row setting-row--compact">
              <div class="setting-copy">
                <div class="setting-title-row">
                  <strong class="panel-value">天气</strong>
                  <SettingsInfoTip text="本应用无法直接获取天气信息" />
                </div>
                <p class="panel-description">记录你写日记时的天气情况。</p>
              </div>

              <button
                class="switch-button"
                :class="{ 'switch-button--active': frontmatterVisibility.weather }"
                type="button"
                :disabled="isSavingFrontmatterVisibility"
                :aria-pressed="frontmatterVisibility.weather"
                aria-label="切换天气显示"
                @click="
                  $emit('update:frontmatterVisibility', {
                    ...frontmatterVisibility,
                    weather: !frontmatterVisibility.weather,
                  })
                "
              >
                <span class="switch-track" aria-hidden="true">
                  <span class="switch-thumb" />
                </span>
              </button>
            </div>

            <div class="setting-row setting-row--compact">
              <div class="setting-copy">
                <div class="setting-title-row">
                  <strong class="panel-value">地点</strong>
                  <SettingsInfoTip text="本应用无法直接获取定位信息" />
                </div>
                <p class="panel-description">记录你写日记时所在的地点。</p>
              </div>

              <button
                class="switch-button"
                :class="{ 'switch-button--active': frontmatterVisibility.location }"
                type="button"
                :disabled="isSavingFrontmatterVisibility"
                :aria-pressed="frontmatterVisibility.location"
                aria-label="切换地点显示"
                @click="
                  $emit('update:frontmatterVisibility', {
                    ...frontmatterVisibility,
                    location: !frontmatterVisibility.location,
                  })
                "
              >
                <span class="switch-track" aria-hidden="true">
                  <span class="switch-thumb" />
                </span>
              </button>
            </div>

            <div class="setting-row setting-row--compact">
              <div class="setting-copy">
                <div class="setting-title-row">
                  <strong class="panel-value">一句话总结</strong>
                </div>
                <p class="panel-description">为每天的日记生成一份简短总结，方便后续做月度和年度整理。</p>
              </div>

              <button
                class="switch-button"
                :class="{ 'switch-button--active': frontmatterVisibility.summary }"
                type="button"
                :disabled="isSavingFrontmatterVisibility"
                :aria-pressed="frontmatterVisibility.summary"
                aria-label="切换总结显示"
                @click="
                  $emit('update:frontmatterVisibility', {
                    ...frontmatterVisibility,
                    summary: !frontmatterVisibility.summary,
                  })
                "
              >
                <span class="switch-track" aria-hidden="true">
                  <span class="switch-thumb" />
                </span>
              </button>
            </div>

            <div class="setting-row setting-row--compact">
              <div class="setting-copy">
                <div class="setting-title-row">
                  <strong class="panel-value">标签</strong>
                </div>
                <p class="panel-description">为每天的日记补上关键词，方便后续筛选和总结。</p>
              </div>

              <button
                class="switch-button"
                :class="{ 'switch-button--active': frontmatterVisibility.tags }"
                type="button"
                :disabled="isSavingFrontmatterVisibility"
                :aria-pressed="frontmatterVisibility.tags"
                aria-label="切换标签显示"
                @click="
                  $emit('update:frontmatterVisibility', {
                    ...frontmatterVisibility,
                    tags: !frontmatterVisibility.tags,
                  })
                "
              >
                <span class="switch-track" aria-hidden="true">
                  <span class="switch-thumb" />
                </span>
              </button>
            </div>
          </div>

          <p v-if="frontmatterVisibilitySaveMessage" class="setting-feedback">
            {{ frontmatterVisibilitySaveMessage }}
          </p>
        </section>
      </div>

      <div v-else-if="activeSectionId === 'libraries'" class="settings-section">
        <section class="settings-card">
          <div class="panel-heading">
            <span class="panel-label">候选词库</span>
            <SettingsInfoTip text="词库保存在当前日记目录中，删除目录将丢失词库数据" />
          </div>
          <p class="panel-description">维护天气、地点和标签候选词，让元数据输入更方便。</p>

          <div v-if="hasWorkspace" class="library-grid">
            <div class="library-item">
              <div class="setting-title-row">
                <strong class="panel-value">天气词库</strong>
              </div>
              <StringListEditor
                v-model="draftWeatherOptions"
                :disabled="isSavingWorkspaceLibraries"
                placeholder="输入天气后回车"
                empty-text="还没有天气候选词，点击添加开始维护。"
              />
            </div>

            <div class="library-item">
              <div class="setting-title-row">
                <strong class="panel-value">地点词库</strong>
              </div>
              <StringListEditor
                v-model="draftLocationOptions"
                :disabled="isSavingWorkspaceLibraries"
                placeholder="输入地点后回车"
                empty-text="还没有地点候选词，点击添加开始维护。"
              />
            </div>

            <div class="library-item">
              <div class="setting-title-row">
                <strong class="panel-value">标签词库</strong>
              </div>
              <StringListEditor
                v-model="draftTags"
                :disabled="isSavingWorkspaceLibraries"
                placeholder="输入标签后回车"
                empty-text="还没有标签候选词，点击添加开始维护。"
              />
            </div>

            <div class="library-actions">
              <button
                class="save-button"
                type="button"
                :disabled="!isWorkspaceLibrariesDirty || isSavingWorkspaceLibraries"
                @click="
                  $emit('saveWorkspaceLibraries', {
                    tags: draftTags,
                    weatherOptions: draftWeatherOptions,
                    locationOptions: draftLocationOptions,
                  })
                "
              >
                {{ isSavingWorkspaceLibraries ? '正在保存词库' : '保存词库' }}
              </button>
            </div>
          </div>

          <p v-else class="panel-description">请先选择工作区目录，再维护候选词库。</p>

          <p v-if="workspaceLibrariesSaveMessage" class="setting-feedback">
            {{ workspaceLibrariesSaveMessage }}
          </p>
        </section>
      </div>

      <div v-else class="settings-section">
        <section class="settings-card">
          <div class="panel-heading">
            <span class="panel-label">当前工作区</span>
            <SettingsInfoTip text="工作区是你选择的日记根目录，日记文件和工作区相关配置都会围绕它组织" />
          </div>

          <div class="workspace-summary">
            <div class="workspace-summary-copy">
              <strong class="panel-value">{{ workspacePath ?? '暂未选择工作区' }}</strong>
              <p class="panel-description">
                {{
                  workspacePath
                    ? '当前目录已接入日记读写流程。'
                    : '先选择一个工作区目录，后续工作区级设置才能真正生效。'
                }}
              </p>
            </div>

            <span class="workspace-status" :class="{ 'workspace-status--ready': hasWorkspace }">
              {{ hasWorkspace ? '已连接' : '未连接' }}
            </span>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings-panel {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 1rem;
  align-content: start;
  min-height: 0;
  max-height: 100%;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fffef9;
  overflow: hidden;
  isolation: isolate;
}

.settings-nav {
  position: relative;
  z-index: 0;
  display: grid;
  gap: 0.6rem;
  align-content: start;
  padding: 1.2rem;
  min-height: 0;
  border-right: 1px solid var(--color-border);
}

.settings-nav-header {
  padding-bottom: 0.15rem;
}

.settings-nav-title {
  margin: 0;
  color: var(--color-text-main);
  font-size: 1.2rem;
}

.settings-nav-list {
  display: grid;
  gap: 0.35rem;
}

.settings-nav-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.7rem 0.85rem;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  text-align: left;
  transition:
    transform 160ms ease,
    background-color 160ms ease;
}

.settings-nav-item:hover {
  transform: translateY(-1px);
  background: rgba(245, 235, 195, 0.28);
}

.settings-nav-item--active {
  background: #f4ead1;
}

.settings-nav-item-label {
  color: var(--color-text-main);
  font-size: 0.96rem;
  font-weight: 600;
}

.settings-content {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 1rem;
  align-content: start;
  min-height: 0;
  padding: 1.5rem;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #d8ccb0 transparent;
}

.settings-card {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-surface);
}

.settings-section {
  display: grid;
  gap: 1rem;
}

.panel-heading,
.setting-title-row {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-wrap: wrap;
}

.panel-label {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--color-text-main);
}

.panel-value {
  color: var(--color-text-main);
}

.panel-description {
  margin: 0;
  color: var(--color-text-subtle);
  font-size: 0.9rem;
  line-height: 1.7;
}

.settings-grid,
.library-grid {
  display: grid;
  gap: 0.85rem;
}

.setting-row {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
}

.setting-row--compact {
  padding: 0.85rem 0;
  border-top: 1px solid var(--color-border-soft);
}

.setting-copy,
.library-item,
.workspace-summary-copy {
  display: grid;
  gap: 0.35rem;
}

.library-item {
  padding-top: 0.85rem;
  border-top: 1px solid var(--color-border-soft);
}

.workspace-summary {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
}

.workspace-status {
  display: inline-flex;
  align-items: center;
  min-height: 1.9rem;
  padding: 0 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: #f4efe1;
  color: var(--color-text-subtle);
  font-size: 0.82rem;
  white-space: nowrap;
}

.workspace-status--ready {
  border-color: #d7c68a;
  background: #f8f1d9;
  color: #6b5b38;
}

.library-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 0.5rem;
}

.switch-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3.25rem;
  height: 2rem;
  padding: 0;
  border: 0;
  background: transparent;
  transition:
    transform 160ms ease,
    opacity 160ms ease;
}

.switch-button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.switch-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  transform: none;
}

.switch-track {
  position: relative;
  width: 2.8rem;
  height: 1.6rem;
  border-radius: 999px;
  background: #ddd2b9;
  box-shadow: inset 0 0 0 1px rgba(138, 129, 109, 0.14);
  transition:
    background-color 160ms ease,
    box-shadow 160ms ease;
}

.switch-button--active .switch-track {
  background: #d7c68a;
  box-shadow: inset 0 0 0 1px rgba(120, 101, 52, 0.12);
}

.switch-thumb {
  position: absolute;
  top: 0.16rem;
  left: 0.16rem;
  width: 1.28rem;
  height: 1.28rem;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(61, 56, 45, 0.16);
  transition: transform 160ms ease;
}

.switch-button--active .switch-thumb {
  transform: translateX(1.2rem);
}

.save-button {
  min-height: 2.4rem;
  padding: 0 1rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: #f5ebc3;
  color: #4f4630;
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease,
    opacity 160ms ease;
}

.save-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 14px rgba(95, 82, 42, 0.08);
}

.save-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
  transform: none;
  box-shadow: none;
}

.setting-feedback {
  margin: 0;
  color: var(--color-text-soft);
  font-size: 0.88rem;
}

.settings-content::-webkit-scrollbar {
  width: 10px;
}

.settings-content::-webkit-scrollbar-track {
  background: transparent;
}

.settings-content::-webkit-scrollbar-thumb {
  border: 3px solid transparent;
  border-radius: 999px;
  background: linear-gradient(180deg, #ded3b8 0%, #cec09b 100%);
  background-clip: padding-box;
}

.settings-content::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #d3c5a0 0%, #bda977 100%);
  background-clip: padding-box;
}

.settings-content::-webkit-scrollbar-corner {
  background: transparent;
}

@media (max-width: 1080px) {
  .settings-panel {
    grid-template-columns: 1fr;
    gap: 0;
  }

  .settings-nav-list {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .settings-nav {
    border-right: 0;
    border-bottom: 1px solid var(--color-border);
  }
}

@media (max-width: 768px) {
  .settings-content {
    padding: 1rem;
  }

  .settings-nav-list {
    grid-template-columns: 1fr;
  }

  .setting-row,
  .workspace-summary {
    flex-direction: column;
    align-items: stretch;
  }

  .switch-button,
  .library-actions {
    justify-content: center;
  }
}
</style>
