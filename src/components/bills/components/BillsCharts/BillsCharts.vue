<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { Bill, BillCategory } from '../../../../types/bills'
import { aggregateRecords, formatPlainCents, resolveCategory } from '../../../../shared/bills-logic'

echarts.use([BarChart, PieChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const props = defineProps<{
  records: Bill[]
  categories: BillCategory[]
  scope: 'month' | 'year'
  selectedMonth: string
}>()

const ringEl = ref<HTMLElement | null>(null)
const barEl = ref<HTMLElement | null>(null)
const windowEl = ref<HTMLElement | null>(null)
let ringChart: echarts.ECharts | null = null
let barChart: echarts.ECharts | null = null
let windowChart: echarts.ECharts | null = null
let themeObserver: MutationObserver | null = null
let resizeHandler: (() => void) | null = null

const CHART_TEXT = '#6B766D'
const CHART_SPLIT = '#EDF1EC'

const monthWindow = computed(() => {
  const [year, month] = props.selectedMonth.split('-').map(Number)
  const list: Array<[number, number]> = []
  let y = year
  let m = month
  for (let i = 0; i < 6; i++) {
    list.unshift([y, m])
    m -= 1
    if (m === 0) {
      m = 12
      y -= 1
    }
  }
  return list
})

const categoryExpense = computed(() => {
  const map = new Map<string, number>()
  for (const record of props.records) {
    const resolved = resolveCategory(props.categories, record.amountCents, record.category)
    if (resolved.type !== 'expense') continue
    const key = record.category
    map.set(key, (map.get(key) ?? 0) + -record.amountCents)
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
})

const dailyExpense = computed(() => {
  const map = new Map<string, number>()
  for (const record of props.records) {
    const resolved = resolveCategory(props.categories, record.amountCents, record.category)
    if (resolved.type !== 'expense') continue
    map.set(record.date, (map.get(record.date) ?? 0) + -record.amountCents)
  }
  return map
})

function colorForCategory(name: string): string {
  const category = props.categories.find((c) => c.name === name)
  return category?.color ?? '#8B948E'
}

function readCssColor(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function textStyle() {
  return {
    color: readCssColor('--color-text-subtle', CHART_TEXT),
    fontFamily: '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif',
  }
}

function splitLineStyle() {
  return { lineStyle: { color: readCssColor('--color-border-soft', CHART_SPLIT) } }
}

function ensureWindowChart() {
  if (!windowChart && windowEl.value) {
    windowChart = echarts.init(windowEl.value)
  }
}

function renderCharts() {
  ensureWindowChart()
  if (!ringChart || !barChart) return

  const total = props.records
    .filter((r) => resolveCategory(props.categories, r.amountCents, r.category).type === 'expense')
    .reduce((acc, r) => acc + -r.amountCents, 0)

  if (total > 0) {
    const ringTitle =
      props.scope === 'year'
        ? `${props.selectedMonth.slice(0, 4)}年分类支出占比`
        : `${props.selectedMonth.slice(0, 4)}年${props.selectedMonth.slice(5, 7)}月分类支出占比`
    ringChart.setOption({
      title: { text: ringTitle, left: 'center', top: 10, textStyle: { fontSize: 16, ...textStyle() } },
      tooltip: {
        trigger: 'item',
        textStyle: { fontSize: 13 },
        formatter: (p: { name: string; value: number; percent: number }) => `${p.name}：${(p.value / 100).toFixed(2)}（${p.percent}%）`,
      },
      legend: { bottom: 0, icon: 'circle', itemWidth: 12, itemHeight: 12, textStyle: { fontSize: 13, ...textStyle() } },
      series: [{
        type: 'pie',
        radius: ['50%', '78%'],
        center: ['50%', '52%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: readCssColor('--color-surface-elevated', '#FFFFFF'), borderWidth: 2, borderRadius: 4 },
        label: { show: true, formatter: '{b} {d}%', fontSize: 12, color: readCssColor('--color-text-main', '#37433A') },
        labelLine: { length: 10, length2: 8 },
        emphasis: { scaleSize: 4, label: { show: true, formatter: '{b} {d}%', fontSize: 12 } },
        data: categoryExpense.value.map((d) => ({ name: d.name, value: Math.round((d.value / 100) * 100) / 100, itemStyle: { color: colorForCategory(d.name) } })),
      }],
    })
  } else {
    ringChart.setOption({ title: { text: '暂无支出数据', left: 'center', top: '42%', textStyle: { fontSize: 15, ...textStyle() } } })
  }

  if (props.scope === 'month') {
    const dayCount = new Date(Number(props.selectedMonth.slice(0, 4)), Number(props.selectedMonth.slice(5, 7)), 0).getDate()
    const values: number[] = []
    for (let d = 1; d <= dayCount; d++) {
      const key = `${props.selectedMonth}-${String(d).padStart(2, '0')}`
      values.push(Math.round(((dailyExpense.value.get(key) ?? 0) / 100) * 100) / 100)
    }
    const hasData = values.some((v) => v > 0)
    barChart.setOption({
      title: { text: hasData ? `${props.selectedMonth.slice(0, 4)}年${props.selectedMonth.slice(5, 7)}月每日支出` : '暂无支出数据', left: 'center', top: 4, textStyle: { fontSize: 16, ...textStyle() } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, textStyle: { fontSize: 13 }, formatter: (params: Array<{ name: string; value: number }>) => `${params[0].name}<br/>支出 ${(params[0].value ?? 0).toFixed(2)}` },
      grid: { left: 8, right: 8, top: 42, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: values.map((_, i) => `${i + 1}日`), axisLine: { lineStyle: { color: readCssColor('--color-border', CHART_SPLIT) } }, axisTick: { show: false }, axisLabel: textStyle() },
      yAxis: { type: 'value', splitLine: splitLineStyle(), axisLabel: textStyle() },
      series: [{ type: 'bar', data: values, barWidth: '60%', itemStyle: { color: readCssColor('--color-chart-positive', '#5A9F61'), borderRadius: [4, 4, 0, 0] } }],
    })

    const windowValues = monthWindow.value.map(([y, m]) => {
      const prefix = `${y}-${String(m).padStart(2, '0')}`
      let sum = 0
      for (const [date, amount] of dailyExpense.value) {
        if (date.startsWith(prefix)) sum += amount
      }
      return Math.round((sum / 100) * 100) / 100
    })
    const windowLabels = monthWindow.value.map(([y, m]) => (y === Number(props.selectedMonth.slice(0, 4)) ? '' : `${y}年`) + `${m}月`)
    const windowHasData = windowValues.some((v) => v > 0)
    windowChart?.setOption({
      title: { text: windowHasData ? '近6个月支出对比' : '暂无支出数据', left: 'center', top: 4, textStyle: { fontSize: 16, ...textStyle() } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, textStyle: { fontSize: 13 }, formatter: (params: Array<{ name: string; value: number }>) => `${params[0].name}<br/>支出 ${(params[0].value ?? 0).toFixed(2)}` },
      grid: { left: 8, right: 8, top: 42, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: windowLabels, axisLine: { lineStyle: { color: readCssColor('--color-border', CHART_SPLIT) } }, axisTick: { show: false }, axisLabel: textStyle() },
      yAxis: { type: 'value', splitLine: splitLineStyle(), axisLabel: textStyle() },
      series: [{ type: 'bar', data: windowValues, barWidth: '60%', itemStyle: { color: readCssColor('--color-chart-positive', '#5A9F61'), borderRadius: [4, 4, 0, 0] } }],
    })
  } else {
    const monthValues = Array.from({ length: 12 }, (_, i) => {
      const prefix = `${props.selectedMonth.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`
      let sum = 0
      for (const [date, amount] of dailyExpense.value) {
        if (date.startsWith(prefix)) sum += amount
      }
      return Math.round((sum / 100) * 100) / 100
    })
    const hasData = monthValues.some((v) => v > 0)
    barChart.setOption({
      title: { text: hasData ? `${props.selectedMonth.slice(0, 4)}年月度支出` : '暂无支出数据', left: 'center', top: 4, textStyle: { fontSize: 16, ...textStyle() } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, textStyle: { fontSize: 13 }, formatter: (params: Array<{ name: string; value: number }>) => `${params[0].name}<br/>支出 ${(params[0].value ?? 0).toFixed(2)}` },
      grid: { left: 8, right: 8, top: 42, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: monthValues.map((_, i) => `${i + 1}月`), axisLine: { lineStyle: { color: readCssColor('--color-border', CHART_SPLIT) } }, axisTick: { show: false }, axisLabel: textStyle() },
      yAxis: { type: 'value', splitLine: splitLineStyle(), axisLabel: textStyle() },
      series: [{ type: 'bar', data: monthValues, barWidth: '60%', itemStyle: { color: readCssColor('--color-chart-positive', '#5A9F61'), borderRadius: [4, 4, 0, 0] } }],
    })
    windowChart?.setOption({ title: { text: '', left: 'center', top: '42%', textStyle: { fontSize: 15, ...textStyle() } } })
  }
}

watch(() => [props.records, props.categories, props.scope, props.selectedMonth], async () => {
  if (props.scope === 'year') {
    windowChart?.dispose()
    windowChart = null
  }
  await nextTick()
  ensureWindowChart()
  renderCharts()
})

onMounted(() => {
  if (ringEl.value) ringChart = echarts.init(ringEl.value)
  if (barEl.value) barChart = echarts.init(barEl.value)
  if (windowEl.value) windowChart = echarts.init(windowEl.value)

  resizeHandler = () => {
    ringChart?.resize()
    barChart?.resize()
    windowChart?.resize()
  }
  window.addEventListener('resize', resizeHandler)

  themeObserver = new MutationObserver(() => renderCharts())
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

  renderCharts()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeHandler ?? (() => {}))
  themeObserver?.disconnect()
  ringChart?.dispose()
  barChart?.dispose()
  windowChart?.dispose()
  ringChart = null
  barChart = null
  windowChart = null
})
</script>

<template>
  <div class="charts-stack">
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-label">总支出</div>
        <div class="stat-value stat-expense">{{ formatPlainCents(aggregateRecords(props.records, props.categories).expense) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">总收入</div>
        <div class="stat-value stat-income">{{ formatPlainCents(aggregateRecords(props.records, props.categories).income) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">结余</div>
        <div class="stat-value stat-net">{{ formatPlainCents(aggregateRecords(props.records, props.categories).net) }}</div>
      </div>
    </div>

    <div class="chart-box"><div ref="ringEl" class="chart chart--ring"></div></div>
    <div class="chart-box"><div ref="barEl" class="chart"></div></div>
    <div v-if="props.scope === 'month'" class="chart-box"><div ref="windowEl" class="chart"></div></div>
  </div>
</template>

<style scoped src="./BillsCharts.css"></style>
