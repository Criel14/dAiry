<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import SettingsInfoTip from '../components/SettingsInfoTip/SettingsInfoTip.vue'
import TagInput from '../../form/components/TagInput/TagInput.vue'
import type {
  TagLibraryValue,
  WeatherLocationLibrariesValue,
} from '../config/config'

const props = defineProps<{
  workspacePath: string | null
  workspaceTags: string[]
  workspaceWeatherOptions: string[]
  workspaceLocationOptions: string[]
  isSavingWeatherLocationLibraries: boolean
  weatherLocationLibrariesSaveMessage: string
  isSavingTagLibrary: boolean
  tagLibrarySaveMessage: string
}>()

const emit = defineEmits<{
  saveTagLibrary: [value: TagLibraryValue]
  saveWeatherLocationLibraries: [value: WeatherLocationLibrariesValue]
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

const isWeatherLocationLibrariesDirty = computed(() => {
  return (
    JSON.stringify(draftWeatherOptions.value) !== JSON.stringify(props.workspaceWeatherOptions) ||
    JSON.stringify(draftLocationOptions.value) !== JSON.stringify(props.workspaceLocationOptions)
  )
})

const isTagLibraryDirty = computed(() => {
  return JSON.stringify(draftTags.value) !== JSON.stringify(props.workspaceTags)
})
</script>

<template>
  <div class="settings-section">
    <template v-if="hasWorkspace">
      <section class="settings-card library-card">
        <div class="panel-heading">
          <span class="panel-label">天气与地点</span>
          <SettingsInfoTip text="词库保存在当前日记目录中，删除目录将丢失词库数据" />
        </div>
        <p class="panel-description">维护天气与地点候选词，让元数据输入更方便。</p>

        <div class="library-grid">
          <div class="library-item">
            <div class="setting-title-row">
              <strong class="panel-value">天气词库</strong>
            </div>
            <TagInput
              v-model="draftWeatherOptions"
              :suggestions="[]"
              :disabled="isSavingWeatherLocationLibraries"
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
              :disabled="isSavingWeatherLocationLibraries"
              placeholder="输入地点后回车"
              add-button-aria-label="添加地点"
              remove-aria-label-prefix="删除地点"
            />
          </div>

          <div class="library-actions">
            <button
              class="save-button"
              type="button"
              :disabled="!isWeatherLocationLibrariesDirty || isSavingWeatherLocationLibraries"
              @click="
                emit('saveWeatherLocationLibraries', {
                  weatherOptions: draftWeatherOptions,
                  locationOptions: draftLocationOptions,
                })
              "
            >
              {{ isSavingWeatherLocationLibraries ? '正在保存' : '保存' }}
            </button>
          </div>
        </div>

        <p v-if="weatherLocationLibrariesSaveMessage" class="setting-feedback">
          {{ weatherLocationLibrariesSaveMessage }}
        </p>
      </section>

      <section class="settings-card library-card">
        <div class="panel-heading">
          <span class="panel-label">标签词库</span>
          <SettingsInfoTip text="标签按英文或拼音首字母 A–Z 自动分组，无法归类的归入 # 组" />
        </div>
        <p class="panel-description">维护标签候选词；标签较多时，按首字母分组浏览更清晰。</p>

        <div class="library-grid">
          <TagInput
            v-model="draftTags"
            :suggestions="[]"
            :disabled="isSavingTagLibrary"
            placeholder="输入标签后回车"
            add-button-aria-label="添加标签"
            remove-aria-label-prefix="删除标签"
            group-by-letter
          />

          <div class="library-actions">
            <button
              class="save-button"
              type="button"
              :disabled="!isTagLibraryDirty || isSavingTagLibrary"
              @click="emit('saveTagLibrary', { tags: draftTags })"
            >
              {{ isSavingTagLibrary ? '正在保存' : '保存' }}
            </button>
          </div>
        </div>

        <p v-if="tagLibrarySaveMessage" class="setting-feedback">
          {{ tagLibrarySaveMessage }}
        </p>
      </section>
    </template>

    <section v-else class="settings-card">
      <p class="panel-description">请先选择工作区目录，再维护候选词库。</p>
    </section>
  </div>
</template>
