<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import StringListEditor from './StringListEditor.vue'
import type { FrontmatterVisibilityConfig } from '../types/dairy'

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
    <section class="settings-card">
      <span class="panel-label">日历显示</span>
      <div class="setting-row">
        <div class="setting-copy">
          <strong class="panel-value">字数热力图</strong>
          <p class="panel-description">开启后，月历会按当天日记字数显示深浅变化</p>
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

    <section class="settings-card">
      <span class="panel-label">日记信息展示</span>
      <p class="panel-description">调整日记所包含的基础信息</p>

      <div class="settings-grid">
        <div class="setting-row setting-row--compact">
          <div class="setting-copy">
            <strong class="panel-value">天气</strong>
            <p class="panel-description">记录你写日记时的天气情况</p>
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
            <strong class="panel-value">地点</strong>
            <p class="panel-description">记录你写日记时所在的地点</p>
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
            <strong class="panel-value">一句话总结</strong>
            <p class="panel-description">为每天的日记写一份简单的总结，便于做月度和年度总结</p>
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
            <strong class="panel-value">标签</strong>
            <p class="panel-description">为每天的日记写上关键词，便于做月度和年度总结</p>
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

    <section class="settings-card">
      <span class="panel-label">候选词库</span>
      <p class="panel-description">
        编辑天气、地点、标签的常用候选项，方便快速选择
      </p>

      <div v-if="hasWorkspace" class="library-grid">
        <div class="library-item">
          <strong class="panel-value">天气库</strong>
          <StringListEditor
            v-model="draftWeatherOptions"
            :disabled="isSavingWorkspaceLibraries"
            placeholder="输入天气后回车"
            empty-text="还没有天气候选，点击添加开始维护。"
          />
        </div>

        <div class="library-item">
          <strong class="panel-value">地点库</strong>
          <StringListEditor
            v-model="draftLocationOptions"
            :disabled="isSavingWorkspaceLibraries"
            placeholder="输入地点后回车"
            empty-text="还没有地点候选，点击添加开始维护。"
          />
        </div>

        <div class="library-item">
          <strong class="panel-value">标签库</strong>
          <StringListEditor
            v-model="draftTags"
            :disabled="isSavingWorkspaceLibraries"
            placeholder="输入标签后回车"
            empty-text="还没有标签候选，点击添加开始维护。"
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
  </section>
</template>

<style scoped>
.settings-panel {
  display: grid;
  gap: 1rem;
  align-content: start;
  min-height: 0;
  max-height: 100%;
  padding: 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fffef9;
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

.panel-label {
  margin: 0;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-subtle);
}

.panel-value {
  color: var(--color-text-main);
}

.panel-description {
  margin: 0;
  color: var(--color-text-subtle);
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
.library-item {
  display: grid;
  gap: 0.35rem;
}

.library-item {
  padding-top: 0.85rem;
  border-top: 1px solid var(--color-border-soft);
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

.settings-panel::-webkit-scrollbar {
  width: 10px;
}

.settings-panel::-webkit-scrollbar-track {
  background: transparent;
}

.settings-panel::-webkit-scrollbar-thumb {
  border: 3px solid transparent;
  border-radius: 999px;
  background: linear-gradient(180deg, #ded3b8 0%, #cec09b 100%);
  background-clip: padding-box;
}

.settings-panel::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, #d3c5a0 0%, #bda977 100%);
  background-clip: padding-box;
}

.settings-panel::-webkit-scrollbar-corner {
  background: transparent;
}

@media (max-width: 768px) {
  .setting-row {
    flex-direction: column;
    align-items: stretch;
  }

  .switch-button,
  .library-actions {
    justify-content: center;
  }
}
</style>
