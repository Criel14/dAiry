<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import type {
  GenerateRangeReportInput,
  RangeReport,
  ReportListItem,
  ReportPreset,
  ReportSectionKey,
} from '../../types/dairy'

const props = defineProps<{
  workspacePath: string | null
}>()

const preset = ref<ReportPreset>('month')
const monthValue = ref(dayjs().format('YYYY-MM'))
const yearValue = ref(dayjs().format('YYYY'))
const customStartDate = ref(dayjs().startOf('month').format('YYYY-MM-DD'))
const customEndDate = ref(dayjs().endOf('month').format('YYYY-MM-DD'))
const selectedSections = ref<ReportSectionKey[]>([
  'stats',
  'heatmap',
  'moodTrend',
  'tagCloud',
  'highlights',
  'locationPatterns',
  'timePatterns',
])
const reportList = ref<ReportListItem[]>([])
const activeReport = ref<RangeReport | null>(null)
const selectedReportId = ref<string | null>(null)
const isLoadingList = ref(false)
const isLoadingReport = ref(false)
const isGenerating = ref(false)
const statusMessage = ref('')

const sectionOptions: Array<{ key: ReportSectionKey; label: string; description: string }> = [
  { key: 'stats', label: '基础统计', description: '记录天数、总字数、连续记录等' },
  { key: 'heatmap', label: '字数热力图', description: '按日期查看区间内写作分布' },
  { key: 'moodTrend', label: '情绪变化', description: '按日期查看心情分布与均值' },
  { key: 'tagCloud', label: '标签词云', description: '汇总高频标签，便于看主题集中度' },
  { key: 'highlights', label: '重点事件', description: '从区间内挑出更值得回看的几天' },
  { key: 'locationPatterns', label: '地点分析', description: '汇总区间内最常写作和最独特的地点' },
  { key: 'timePatterns', label: '时间段分析', description: '查看写作主要集中在一天中的哪个时间段' },
]

const hasWorkspace = computed(() => Boolean(props.workspacePath))
const activeStats = computed(() => activeReport.value?.sections.stats ?? null)
const activeHeatmapPoints = computed(() => activeReport.value?.sections.heatmap?.points ?? [])
const activeMoodPoints = computed(() => activeReport.value?.sections.moodTrend?.points ?? [])
const activeTagItems = computed(() => activeReport.value?.sections.tagCloud?.items ?? [])
const activeHighlights = computed(() => activeReport.value?.sections.highlights?.events ?? [])
const activeLocationPatterns = computed(() => activeReport.value?.sections.locationPatterns ?? null)
const activeTimePatterns = computed(() => activeReport.value?.sections.timePatterns ?? null)

watch(
  () => props.workspacePath,
  () => {
    void handleWorkspaceChange()
  },
  { immediate: true },
)

async function handleWorkspaceChange() {
  reportList.value = []
  activeReport.value = null
  selectedReportId.value = null
  statusMessage.value = ''

  if (!props.workspacePath) {
    return
  }

  await loadReportList()
}

async function loadReportList() {
  if (!props.workspacePath) {
    reportList.value = []
    return
  }

  isLoadingList.value = true

  try {
    const nextReports = await window.dairy.listRangeReports(props.workspacePath)
    reportList.value = nextReports

    const nextSelectedReportId =
      selectedReportId.value && nextReports.some((item) => item.reportId === selectedReportId.value)
        ? selectedReportId.value
        : nextReports[0]?.reportId ?? null

    selectedReportId.value = nextSelectedReportId

    if (nextSelectedReportId) {
      await loadReport(nextSelectedReportId)
      return
    }

    activeReport.value = null
  } catch (error) {
    reportList.value = []
    activeReport.value = null
    statusMessage.value = error instanceof Error ? error.message : '读取报告列表失败，请稍后重试。'
  } finally {
    isLoadingList.value = false
  }
}

async function loadReport(reportId: string) {
  if (!props.workspacePath) {
    return
  }

  isLoadingReport.value = true
  statusMessage.value = ''

  try {
    activeReport.value = await window.dairy.getRangeReport({
      workspacePath: props.workspacePath,
      reportId,
    })
    selectedReportId.value = reportId
  } catch (error) {
    activeReport.value = null
    statusMessage.value = error instanceof Error ? error.message : '读取报告详情失败，请稍后重试。'
  } finally {
    isLoadingReport.value = false
  }
}

function toggleSection(sectionKey: ReportSectionKey) {
  if (selectedSections.value.includes(sectionKey)) {
    if (selectedSections.value.length === 1) {
      return
    }

    selectedSections.value = selectedSections.value.filter((item) => item !== sectionKey)
    return
  }

  selectedSections.value = [...selectedSections.value, sectionKey]
}

function createReportInput(): GenerateRangeReportInput | null {
  if (!props.workspacePath) {
    statusMessage.value = '请先选择一个工作区。'
    return null
  }

  if (preset.value === 'month') {
    const monthDate = dayjs(`${monthValue.value}-01`)
    if (!monthDate.isValid()) {
      statusMessage.value = '请选择有效的月份。'
      return null
    }

    return {
      workspacePath: props.workspacePath,
      preset: 'month',
      startDate: monthDate.startOf('month').format('YYYY-MM-DD'),
      endDate: monthDate.endOf('month').format('YYYY-MM-DD'),
      requestedSections: [...selectedSections.value],
    }
  }

  if (preset.value === 'year') {
    const yearDate = dayjs(`${yearValue.value}-01-01`)
    if (!yearDate.isValid()) {
      statusMessage.value = '请选择有效的年份。'
      return null
    }

    return {
      workspacePath: props.workspacePath,
      preset: 'year',
      startDate: yearDate.startOf('year').format('YYYY-MM-DD'),
      endDate: yearDate.endOf('year').format('YYYY-MM-DD'),
      requestedSections: [...selectedSections.value],
    }
  }

  if (!customStartDate.value || !customEndDate.value) {
    statusMessage.value = '请选择完整的开始和结束日期。'
    return null
  }

  const startDate = dayjs(customStartDate.value)
  const endDate = dayjs(customEndDate.value)

  if (!startDate.isValid() || !endDate.isValid()) {
    statusMessage.value = '自定义区间无效。'
    return null
  }

  if (endDate.isBefore(startDate, 'day')) {
    statusMessage.value = '结束日期不能早于开始日期。'
    return null
  }

  return {
    workspacePath: props.workspacePath,
    preset: 'custom',
    startDate: startDate.format('YYYY-MM-DD'),
    endDate: endDate.format('YYYY-MM-DD'),
    requestedSections: [...selectedSections.value],
  }
}

async function handleGenerateReport() {
  const input = createReportInput()
  if (!input) {
    return
  }

  isGenerating.value = true
  statusMessage.value = ''

  try {
    const report = await window.dairy.generateRangeReport(input)
    activeReport.value = report
    selectedReportId.value = report.reportId
    statusMessage.value = '报告已生成并保存到工作区。'
    await loadReportList()
  } catch (error) {
    statusMessage.value = error instanceof Error ? error.message : '生成报告失败，请稍后重试。'
  } finally {
    isGenerating.value = false
  }
}

function formatDateTime(value: string) {
  return dayjs(value).isValid() ? dayjs(value).format('YYYY-MM-DD HH:mm') : value
}

function formatPreset(presetValue: ReportPreset) {
  if (presetValue === 'month') {
    return '月度'
  }

  if (presetValue === 'year') {
    return '年度'
  }

  return '自定义'
}

function getHeatLevel(value: number) {
  if (value >= 700) {
    return 4
  }

  if (value >= 400) {
    return 3
  }

  if (value >= 150) {
    return 2
  }

  if (value > 0) {
    return 1
  }

  return 0
}

function getTagSize(value: number) {
  if (value >= 8) {
    return 'tag-chip--lg'
  }

  if (value >= 4) {
    return 'tag-chip--md'
  }

  return 'tag-chip--sm'
}

function formatPercentScore(score: number) {
  return `${Math.round(score * 100)} 分`
}
</script>

<template>
  <section v-if="!hasWorkspace" class="report-empty-state">
    <h2>请先选择一个工作区</h2>
    <p>区间总结会扫描工作区里的日记文件，并把结果缓存到 `reports/` 目录。</p>
  </section>

  <section v-else class="reports-panel">
    <header class="reports-header">
      <div class="reports-heading">
        <p class="reports-kicker">Reports</p>
        <h2 class="reports-title">区间总结</h2>
        <p class="reports-description">先做稳定的事实层总结，再逐步补齐更完整的 AI 文案和图表。</p>
      </div>

      <p v-if="statusMessage" class="reports-status">{{ statusMessage }}</p>
    </header>

    <div class="reports-layout">
      <aside class="reports-sidebar">
        <section class="panel-card">
          <h3 class="panel-title">生成报告</h3>

          <div class="preset-tabs">
            <button
              class="preset-tab"
              :class="{ 'preset-tab--active': preset === 'month' }"
              type="button"
              @click="preset = 'month'"
            >
              本月
            </button>
            <button
              class="preset-tab"
              :class="{ 'preset-tab--active': preset === 'year' }"
              type="button"
              @click="preset = 'year'"
            >
              本年
            </button>
            <button
              class="preset-tab"
              :class="{ 'preset-tab--active': preset === 'custom' }"
              type="button"
              @click="preset = 'custom'"
            >
              自定义
            </button>
          </div>

          <div class="field-group">
            <label v-if="preset === 'month'" class="field-label">
              月份
              <input v-model="monthValue" class="field-input" type="month" />
            </label>

            <label v-else-if="preset === 'year'" class="field-label">
              年份
              <input v-model="yearValue" class="field-input" type="number" min="2000" max="2100" />
            </label>

            <template v-else>
              <label class="field-label">
                开始日期
                <input v-model="customStartDate" class="field-input" type="date" />
              </label>

              <label class="field-label">
                结束日期
                <input v-model="customEndDate" class="field-input" type="date" />
              </label>
            </template>
          </div>

          <div class="field-group">
            <span class="field-title">勾选模块</span>

            <label
              v-for="option in sectionOptions"
              :key="option.key"
              class="check-row"
            >
              <input
                :checked="selectedSections.includes(option.key)"
                type="checkbox"
                @change="toggleSection(option.key)"
              />
              <span>
                <strong>{{ option.label }}</strong>
                <small>{{ option.description }}</small>
              </span>
            </label>
          </div>

          <button
            class="primary-button"
            type="button"
            :disabled="isGenerating"
            @click="handleGenerateReport"
          >
            {{ isGenerating ? '正在生成...' : '生成并保存报告' }}
          </button>
        </section>

        <section class="panel-card report-list-card">
          <div class="panel-title-row">
            <h3 class="panel-title">历史报告</h3>
            <span class="panel-meta">{{ isLoadingList ? '读取中...' : `${reportList.length} 份` }}</span>
          </div>

          <div v-if="reportList.length === 0" class="empty-inline">
            还没有已保存的区间总结。
          </div>

          <div v-else class="report-list">
            <button
              v-for="item in reportList"
              :key="item.reportId"
              class="report-list-item"
              :class="{ 'report-list-item--active': item.reportId === selectedReportId }"
              type="button"
              @click="loadReport(item.reportId)"
            >
              <span class="report-list-tag">{{ formatPreset(item.preset) }}</span>
              <strong>{{ item.label }}</strong>
              <small>{{ formatDateTime(item.generatedAt) }}</small>
            </button>
          </div>
        </section>
      </aside>

      <section class="report-content">
        <div v-if="isLoadingReport" class="report-empty-state">
          <h3>正在读取报告</h3>
          <p>稍等一下，正在加载你之前生成的区间总结。</p>
        </div>

        <div v-else-if="!activeReport" class="report-empty-state">
          <h3>还没有打开任何报告</h3>
          <p>你可以先生成一份月度、年度或自定义区间总结。</p>
        </div>

        <article v-else class="report-article">
          <header class="report-hero">
            <div>
              <p class="report-label">{{ formatPreset(activeReport.preset) }}</p>
              <h3 class="report-title">{{ activeReport.period.label }}</h3>
              <p class="report-subtitle">
                {{ activeReport.period.startDate }} 至 {{ activeReport.period.endDate }} ·
                生成于 {{ formatDateTime(activeReport.period.generatedAt) }}
              </p>
            </div>

            <div class="report-meta-box">
              <span>报告 ID</span>
              <strong>{{ activeReport.reportId }}</strong>
              <small>
                复用 {{ activeReport.generation.reusedEntryInsightCount }} 天，补做
                {{ activeReport.generation.generatedEntryInsightCount }} 天
              </small>
            </div>
          </header>

          <section class="summary-card">
            <h4>区间概览</h4>
            <p>{{ activeReport.summary.text }}</p>

            <div
              v-if="
                activeReport.summary.themes.length ||
                activeReport.summary.progress.length ||
                activeReport.summary.blockers.length ||
                activeReport.summary.memorableMoments.length
              "
              class="summary-groups"
            >
              <div v-if="activeReport.summary.themes.length" class="summary-group">
                <span>主题</span>
                <div class="tag-cloud tag-cloud--compact">
                  <span v-for="item in activeReport.summary.themes" :key="item" class="tag-chip tag-chip--sm">
                    {{ item }}
                  </span>
                </div>
              </div>

              <div v-if="activeReport.summary.progress.length" class="summary-group">
                <span>推进</span>
                <ul class="summary-list">
                  <li v-for="item in activeReport.summary.progress" :key="item">{{ item }}</li>
                </ul>
              </div>

              <div v-if="activeReport.summary.blockers.length" class="summary-group">
                <span>阻塞</span>
                <ul class="summary-list">
                  <li v-for="item in activeReport.summary.blockers" :key="item">{{ item }}</li>
                </ul>
              </div>

              <div v-if="activeReport.summary.memorableMoments.length" class="summary-group">
                <span>值得记住</span>
                <ul class="summary-list">
                  <li v-for="item in activeReport.summary.memorableMoments" :key="item">{{ item }}</li>
                </ul>
              </div>
            </div>
          </section>

          <section
            v-if="activeReport.generation.warnings.length > 0"
            class="content-card content-card--warning"
          >
            <div class="content-card-header">
              <h4>生成提示</h4>
              <span>{{ activeReport.generation.warnings.length }} 条</span>
            </div>

            <ul class="summary-list">
              <li v-for="warning in activeReport.generation.warnings" :key="warning">
                {{ warning }}
              </li>
            </ul>
          </section>

          <section class="stats-grid">
            <article class="stat-card">
              <span>记录天数</span>
              <strong>{{ activeReport.source.entryDays }}</strong>
            </article>
            <article class="stat-card">
              <span>缺失天数</span>
              <strong>{{ activeReport.source.missingDays }}</strong>
            </article>
            <article class="stat-card">
              <span>总字数</span>
              <strong>{{ activeReport.source.totalWords }}</strong>
            </article>
            <article class="stat-card">
              <span>最长连续记录</span>
              <strong>{{ activeReport.source.longestStreak }}</strong>
            </article>
          </section>

          <section v-if="activeStats" class="content-card">
            <div class="content-card-header">
              <h4>基础统计</h4>
              <span>阶段一</span>
            </div>

            <div class="detail-grid">
              <div>
                <span>平均字数</span>
                <strong>{{ activeStats.averageWords }}</strong>
              </div>
              <div>
                <span>单日最高</span>
                <strong>{{ activeStats.maxWordsInOneDay }}</strong>
              </div>
              <div>
                <span>最高日期</span>
                <strong>{{ activeStats.maxWordsDate ?? '暂无' }}</strong>
              </div>
              <div>
                <span>区间末连续</span>
                <strong>{{ activeStats.currentStreakAtEnd }}</strong>
              </div>
            </div>
          </section>

          <section v-if="activeHeatmapPoints.length > 0" class="content-card">
            <div class="content-card-header">
              <h4>字数热力图</h4>
              <span>{{ activeHeatmapPoints.length }} 天</span>
            </div>

            <div class="heatmap-grid">
              <div
                v-for="point in activeHeatmapPoints"
                :key="point.date"
                class="heatmap-cell"
                :class="`heatmap-cell--level-${getHeatLevel(point.value)}`"
                :title="`${point.date} · ${point.value} 字`"
              >
                <span>{{ dayjs(point.date).date() }}</span>
              </div>
            </div>
          </section>

          <section v-if="activeMoodPoints.length > 0" class="content-card">
            <div class="content-card-header">
              <h4>情绪变化</h4>
              <span>
                平均心情
                {{ activeReport.sections.moodTrend?.averageMood ?? '暂无' }}
              </span>
            </div>

            <div class="mood-list">
              <div
                v-for="point in activeMoodPoints"
                :key="point.date"
                class="mood-row"
              >
                <span>{{ point.date }}</span>
                <div class="mood-bar-track">
                  <div
                    class="mood-bar-fill"
                    :style="{
                      width: `${((point.value ?? 0) + 5) * 10}%`,
                    }"
                  />
                </div>
                <strong>{{ point.value ?? '空' }}</strong>
              </div>
            </div>
          </section>

          <section v-if="activeTagItems.length > 0" class="content-card">
            <div class="content-card-header">
              <h4>标签词云</h4>
              <span>前 {{ activeTagItems.length }} 项</span>
            </div>

            <div class="tag-cloud">
              <span
                v-for="item in activeTagItems"
                :key="item.label"
                class="tag-chip"
                :class="getTagSize(item.value)"
              >
                {{ item.label }} · {{ item.value }}
              </span>
            </div>
          </section>

          <section v-if="activeHighlights.length > 0" class="content-card">
            <div class="content-card-header">
              <h4>重点事件</h4>
              <span>{{ activeHighlights.length }} 条</span>
            </div>

            <div class="highlight-list">
              <article
                v-for="event in activeHighlights"
                :key="`${event.date}-${event.title}`"
                class="highlight-card"
              >
                <div class="highlight-head">
                  <strong>{{ event.title }}</strong>
                  <span>{{ event.date }} · {{ formatPercentScore(event.score) }}</span>
                </div>
                <p>{{ event.summary }}</p>
                <div v-if="event.tags.length > 0" class="tag-cloud tag-cloud--compact">
                  <span v-for="tag in event.tags" :key="tag" class="tag-chip tag-chip--sm">
                    {{ tag }}
                  </span>
                </div>
              </article>
            </div>
          </section>

          <section v-if="activeLocationPatterns" class="content-card">
            <div class="content-card-header">
              <h4>地点分析</h4>
              <span>{{ activeLocationPatterns.ranking.length }} 个地点</span>
            </div>

            <div class="pattern-grid">
              <article class="pattern-card">
                <span>最常地点</span>
                <strong>{{ activeLocationPatterns.topLocation?.name ?? '暂无' }}</strong>
                <small>
                  {{
                    activeLocationPatterns.topLocation
                      ? `出现 ${activeLocationPatterns.topLocation.count} 次`
                      : '这个区间还没有可用地点数据'
                  }}
                </small>
              </article>

              <article class="pattern-card">
                <span>最独特点</span>
                <strong>{{ activeLocationPatterns.uniqueLocation?.name ?? '暂无' }}</strong>
                <small>{{ activeLocationPatterns.uniqueLocation?.reason ?? '这个区间还没有可用地点数据' }}</small>
              </article>
            </div>

            <div v-if="activeLocationPatterns.ranking.length > 0" class="ranking-list">
              <div v-for="item in activeLocationPatterns.ranking" :key="item.name" class="ranking-row">
                <span>{{ item.name }}</span>
                <strong>{{ item.count }}</strong>
              </div>
            </div>
          </section>

          <section v-if="activeTimePatterns" class="content-card">
            <div class="content-card-header">
              <h4>时间段分析</h4>
              <span>{{ activeTimePatterns.buckets.length }} 个时间段</span>
            </div>

            <div class="pattern-grid">
              <article class="pattern-card">
                <span>最常时间段</span>
                <strong>{{ activeTimePatterns.topTimeBucket?.label ?? '暂无' }}</strong>
                <small>
                  {{
                    activeTimePatterns.topTimeBucket
                      ? `出现 ${activeTimePatterns.topTimeBucket.count} 次`
                      : '这个区间还没有可用写作时间数据'
                  }}
                </small>
              </article>

              <article class="pattern-card">
                <span>最独特时间段</span>
                <strong>{{ activeTimePatterns.uniqueTimeBucket?.label ?? '暂无' }}</strong>
                <small>{{ activeTimePatterns.uniqueTimeBucket?.reason ?? '这个区间还没有可用写作时间数据' }}</small>
              </article>
            </div>

            <div v-if="activeTimePatterns.buckets.length > 0" class="ranking-list">
              <div
                v-for="item in activeTimePatterns.buckets"
                :key="item.label"
                class="ranking-row"
              >
                <span>{{ item.label }}</span>
                <strong>{{ item.count }}</strong>
              </div>
            </div>
          </section>
        </article>
      </section>
    </div>
  </section>
</template>

<style scoped>
.reports-panel {
  display: grid;
  gap: 1rem;
  min-height: 0;
}

.reports-header {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
}

.reports-heading {
  display: grid;
  gap: 0.35rem;
}

.reports-kicker,
.report-label {
  margin: 0;
  font-size: 0.78rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-subtle);
}

.reports-title,
.report-title {
  margin: 0;
  color: var(--color-text-main);
}

.reports-title {
  font-size: 1.9rem;
}

.reports-description,
.report-subtitle,
.reports-status,
.empty-inline {
  margin: 0;
  color: var(--color-text-subtle);
  line-height: 1.7;
}

.reports-status {
  max-width: 24rem;
  text-align: right;
}

.reports-layout {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 1rem;
  min-height: 0;
}

.reports-sidebar,
.report-content,
.report-article {
  min-height: 0;
}

.reports-sidebar {
  display: grid;
  gap: 1rem;
  align-content: start;
}

.panel-card,
.summary-card,
.content-card,
.report-empty-state {
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.82);
}

.panel-card,
.summary-card,
.content-card {
  padding: 1rem;
}

.report-empty-state {
  display: grid;
  gap: 0.6rem;
  align-content: center;
  justify-items: start;
  min-height: 100%;
  padding: 1.5rem;
}

.report-empty-state h2,
.report-empty-state h3,
.summary-card h4,
.content-card h4,
.panel-title {
  margin: 0;
}

.report-empty-state p,
.summary-card p {
  margin: 0;
  color: var(--color-text-subtle);
  line-height: 1.7;
}

.panel-title-row,
.content-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.panel-title-row span,
.content-card-header span,
.panel-meta {
  color: var(--color-text-soft);
  font-size: 0.85rem;
}

.preset-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  margin-top: 1rem;
}

.preset-tab,
.primary-button,
.report-list-item {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fffdf8;
  color: var(--color-text-main);
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease,
    background-color 160ms ease,
    opacity 160ms ease;
}

.preset-tab,
.primary-button {
  min-height: 2.6rem;
  padding: 0 0.95rem;
}

.preset-tab--active,
.primary-button {
  background: #f5ebc3;
  border-color: var(--color-border-strong);
}

.preset-tab:hover,
.primary-button:hover,
.report-list-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 14px rgba(95, 82, 42, 0.08);
}

.primary-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
  transform: none;
  box-shadow: none;
}

.field-group {
  display: grid;
  gap: 0.75rem;
  margin-top: 1rem;
}

.field-title {
  font-size: 0.9rem;
  color: var(--color-text-main);
}

.field-label {
  display: grid;
  gap: 0.4rem;
  color: var(--color-text-subtle);
  font-size: 0.88rem;
}

.field-input {
  min-height: 2.5rem;
  padding: 0 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: #fffef9;
  color: var(--color-text-main);
  outline: none;
}

.check-row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.75rem;
  align-items: start;
  padding: 0.75rem;
  border: 1px solid var(--color-border-soft);
  border-radius: 10px;
  background: #fffef9;
}

.check-row strong,
.check-row small {
  display: block;
}

.check-row small {
  margin-top: 0.2rem;
  color: var(--color-text-soft);
  line-height: 1.6;
}

.report-list-card {
  min-height: 0;
}

.report-list {
  display: grid;
  gap: 0.65rem;
  margin-top: 1rem;
  max-height: 24rem;
  overflow-y: auto;
}

.report-list-item {
  display: grid;
  gap: 0.3rem;
  justify-items: start;
  width: 100%;
  padding: 0.9rem;
  text-align: left;
}

.report-list-item strong,
.report-list-item small,
.report-list-tag {
  display: block;
}

.report-list-item small,
.report-list-tag {
  color: var(--color-text-subtle);
}

.report-list-item--active {
  background: #f9f2dd;
  border-color: var(--color-border-strong);
}

.report-content {
  min-height: 0;
  overflow-y: auto;
}

.report-article {
  display: grid;
  gap: 1rem;
}

.report-hero {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1.2rem 1.25rem;
  border: 1px solid var(--color-border);
  border-radius: 16px;
  background:
    radial-gradient(circle at top left, rgba(245, 235, 195, 0.86), transparent 38%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(250, 246, 234, 0.92));
}

.report-meta-box {
  display: grid;
  gap: 0.3rem;
  min-width: 12rem;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(217, 203, 159, 0.88);
  border-radius: 12px;
  background: rgba(255, 251, 239, 0.9);
}

.report-meta-box span {
  font-size: 0.8rem;
  color: var(--color-text-subtle);
}

.report-meta-box small {
  color: var(--color-text-subtle);
  line-height: 1.6;
}

.stats-grid,
.detail-grid {
  display: grid;
  gap: 0.8rem;
}

.stats-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.detail-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 1rem;
}

.stat-card,
.detail-grid > div {
  display: grid;
  gap: 0.35rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
}

.stat-card span,
.detail-grid span {
  color: var(--color-text-subtle);
  font-size: 0.85rem;
}

.stat-card strong,
.detail-grid strong {
  font-size: 1.35rem;
}

.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(2.4rem, 1fr));
  gap: 0.45rem;
  margin-top: 1rem;
}

.heatmap-cell {
  display: grid;
  place-items: center;
  aspect-ratio: 1 / 1;
  border: 1px solid var(--color-border-soft);
  border-radius: 8px;
  background: #fcfbf6;
  font-size: 0.82rem;
  color: var(--color-text-subtle);
}

.heatmap-cell--level-1 {
  background: #f8f2df;
}

.heatmap-cell--level-2 {
  background: #f3e7c4;
}

.heatmap-cell--level-3 {
  background: #ead89f;
  color: #54472d;
}

.heatmap-cell--level-4 {
  background: #ddc170;
  color: #47391f;
}

.mood-list {
  display: grid;
  gap: 0.6rem;
  margin-top: 1rem;
}

.mood-row {
  display: grid;
  grid-template-columns: 130px minmax(0, 1fr) 3rem;
  gap: 0.75rem;
  align-items: center;
}

.mood-row span {
  color: var(--color-text-subtle);
  font-size: 0.88rem;
}

.mood-bar-track {
  overflow: hidden;
  height: 0.75rem;
  border-radius: 999px;
  background: #efe8d8;
}

.mood-bar-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #d5b569 0%, #8ea7a7 100%);
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
}

.tag-cloud--compact {
  margin-top: 0.55rem;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  min-height: 2.2rem;
  padding: 0 0.9rem;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: #fffdf8;
  color: var(--color-text-main);
}

.tag-chip--sm {
  font-size: 0.86rem;
}

.tag-chip--md {
  font-size: 0.96rem;
  background: #faf3df;
}

.tag-chip--lg {
  font-size: 1.06rem;
  background: #f5ebc3;
}

.summary-groups {
  display: grid;
  gap: 0.85rem;
  margin-top: 1rem;
}

.summary-group {
  display: grid;
  gap: 0.45rem;
}

.summary-group > span {
  color: var(--color-text-subtle);
  font-size: 0.84rem;
}

.summary-list {
  display: grid;
  gap: 0.4rem;
  margin: 0;
  padding-left: 1.15rem;
  color: var(--color-text-main);
}

.summary-list li {
  line-height: 1.7;
}

.content-card--warning {
  background: #fff9eb;
  border-color: #e2d3a8;
}

.highlight-list {
  display: grid;
  gap: 0.8rem;
  margin-top: 1rem;
}

.highlight-card,
.pattern-card {
  display: grid;
  gap: 0.45rem;
  padding: 0.95rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: #fffef9;
}

.highlight-head {
  display: flex;
  gap: 0.75rem;
  align-items: baseline;
  justify-content: space-between;
}

.highlight-head span,
.highlight-card p,
.pattern-card span,
.pattern-card small {
  color: var(--color-text-subtle);
}

.highlight-card p,
.pattern-card small {
  margin: 0;
  line-height: 1.7;
}

.pattern-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.8rem;
  margin-top: 1rem;
}

.ranking-list {
  display: grid;
  gap: 0.55rem;
  margin-top: 1rem;
}

.ranking-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.8rem 0.95rem;
  border: 1px solid var(--color-border-soft);
  border-radius: 10px;
  background: #fffef9;
}

@media (max-width: 1200px) {
  .reports-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .reports-header,
  .report-hero {
    flex-direction: column;
  }

  .reports-status {
    text-align: left;
  }

  .stats-grid,
  .detail-grid {
    grid-template-columns: 1fr 1fr;
  }

  .pattern-grid {
    grid-template-columns: 1fr;
  }

  .mood-row {
    grid-template-columns: 1fr;
  }
}
</style>
