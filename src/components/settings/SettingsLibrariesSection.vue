<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SettingsInfoTip from './SettingsInfoTip.vue'
import TagInput from '../form/TagInput.vue'
import type { WorkspaceLibrariesValue } from './config'

const props = defineProps<{
  workspacePath: string | null
  workspaceTags: string[]
  workspaceWeatherOptions: string[]
  workspaceLocationOptions: string[]
  isSavingWorkspaceLibraries: boolean
  workspaceLibrariesSaveMessage: string
}>()

const emit = defineEmits<{
  saveWorkspaceLibraries: [value: WorkspaceLibrariesValue]
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
  <div class="settings-section">
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
          <TagInput
            v-model="draftWeatherOptions"
            :suggestions="[]"
            :disabled="isSavingWorkspaceLibraries"
            placeholder="输入天气后回车"
            add-button-aria-label="添加天气"
            remove-aria-label-prefix="删除天气"
          />
        </div>

        <div class="library-item">
          <div class="setting-title-row">
            <strong class="panel-value">地点词库</strong>
          </div>
          <TagInput
            v-model="draftLocationOptions"
            :suggestions="[]"
            :disabled="isSavingWorkspaceLibraries"
            placeholder="输入地点后回车"
            add-button-aria-label="添加地点"
            remove-aria-label-prefix="删除地点"
          />
        </div>

        <div class="library-item">
          <div class="setting-title-row">
            <strong class="panel-value">标签词库</strong>
          </div>
          <TagInput
            v-model="draftTags"
            :suggestions="[]"
            :disabled="isSavingWorkspaceLibraries"
            placeholder="输入标签后回车"
            add-button-aria-label="添加标签"
            remove-aria-label-prefix="删除标签"
          />
        </div>

        <div class="library-actions">
          <button
            class="save-button"
            type="button"
            :disabled="!isWorkspaceLibrariesDirty || isSavingWorkspaceLibraries"
            @click="
              emit('saveWorkspaceLibraries', {
                tags: draftTags,
                weatherOptions: draftWeatherOptions,
                locationOptions: draftLocationOptions,
              })
            "
          >
            {{ isSavingWorkspaceLibraries ? '正在保存' : '保存' }}
          </button>
        </div>
      </div>

      <p v-else class="panel-description">请先选择工作区目录，再维护候选词库。</p>

      <p v-if="workspaceLibrariesSaveMessage" class="setting-feedback">
        {{ workspaceLibrariesSaveMessage }}
      </p>
    </section>
  </div>
</template>
