<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import type { Bill, BillCategory, BillsWindowTotal } from '../../../../types/bills'
import type { BillsChartJumpPayload } from '../../../../types/bills'
import {
  aggregateRecords,
  averageDailyExpense,
  averageMonthlyExpense,
  buildDailyAxis,
  formatCents,
  formatPlainCents,
  lastRecordedDateOfMonth,
  resolveCategory,
} from '../../../../shared/bills-logic'

echarts.use([BarChart, LineChart, PieChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

const props = defineProps<{
  records: Bill[]
  categories: BillCategory[]
  scope: 'month' | 'year'
  selectedMonth: string
  scopeYear: string
  windowTotals: BillsWindowTotal[]
}>()

const emit = defineEmits<{
  'jump-to-detail': [payload: BillsChartJumpPayload]
}>()

const ringEl = ref<HTMLElement | null>(null)
const barEl = ref<HTMLElement | null>(null)
const lineEl = ref<HTMLElement | null>(null)
const windowEl = ref<HTMLElement | null>(null)
let ringChart: echarts.ECharts | null = null
let barChart: echarts.ECharts | null = null
let lineChart: echarts.ECharts | null = null
let windowChart: echarts.ECharts | null = null
let themeObserver: MutationObserver | null = null
let resizeHandler: (() => void) | null = null

const CHART_TEXT = '#6B766D'
const CHART_SPLIT = '#EDF1EC'

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

const periodText = computed(() => {
  if (props.scope === 'year') {
    return `${props.scopeYear}年`
  }
  const [year, month] = props.selectedMonth.split('-')
  return `${year}年${Number(month)}月`
})

const dailyAxis = computed(() => buildDailyAxis(Number(props.scopeYear)))

const averageExpense = computed(() => {
  const expense = aggregateRecords(props.records, props.categories).expense
  if (props.scope === 'month') {
    const [year, month] = props.selectedMonth.split('-').map(Number)
    const now = new Date()
    const todayDay = year === now.getFullYear() && month === now.getMonth() + 1 ? now.getDate() : undefined
    return averageDailyExpense(expense, year, month, todayDay)
  }
  return averageMonthlyExpense(expense)
})

const dailyValues = computed(() =>
  dailyAxis.value.map((date) =>
    Math.round(((dailyExpense.value.get(date) ?? 0) / 100) * 100) / 100,
  ),
)

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

function ensureCharts() {
  if (!ringChart && ringEl.value) {
    ringChart = echarts.init(ringEl.value)
    ringChart.on('click', (params: echarts.ECElementEvent) => {
      const name = params.name
      if (params.componentType !== 'series' || typeof name !== 'string') return
      emit('jump-to-detail', { kind: 'category', category: name })
    })
  }
  if (!barChart && barEl.value) {
    barChart = echarts.init(barEl.value)
    barChart.on('click', (params: echarts.ECElementEvent) => {
      const index = params.dataIndex
      const value = params.value
      if (typeof index !== 'number' || typeof value !== 'number' || value <= 0) return
      if (props.scope === 'month') {
        const day = String(index + 1).padStart(2, '0')
        emit('jump-to-detail', { kind: 'day', date: `${props.selectedMonth}-${day}` })
      } else {
        const month = String(index + 1).padStart(2, '0')
        emit('jump-to-detail', {
          kind: 'monthOfYear',
          month,
          scrollDate: lastRecordedDateOfMonth(props.records, props.scopeYear, month),
        })
      }
    })
  }
  if (!lineChart && lineEl.value) {
    lineChart = echarts.init(lineEl.value)
  }
  if (!windowChart && windowEl.value) {
    windowChart = echarts.init(windowEl.value)
    windowChart.on('click', (params: echarts.ECElementEvent) => {
      const index = params.dataIndex
      const value = params.value
      if (typeof index !== 'number' || typeof value !== 'number' || value <= 0) return
      const period = props.windowTotals[index]?.period
      if (!period) return
      if (props.scope === 'month') {
        emit('jump-to-detail', { kind: 'month', month: period })
      } else {
        emit('jump-to-detail', { kind: 'year', year: period })
      }
    })
  }
}

function renderCharts() {
  ensureCharts()
  if (!ringChart || !barChart) return

  const total = props.records
    .filter((r) => resolveCategory(props.categories, r.amountCents, r.category).type === 'expense')
    .reduce((acc, r) => acc + -r.amountCents, 0)

  if (total > 0) {
    ringChart.setOption({
      tooltip: {
        trigger: 'item',
        textStyle: { fontSize: 13 },
        formatter: (p: { name: string; value: number; percent: number }) => `${p.name}：${p.value.toFixed(2)}（${p.percent}%）`,
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
      title: { text: hasData ? '' : '暂无支出数据', left: 'center', top: '42%', textStyle: { fontSize: 15, ...textStyle() } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, textStyle: { fontSize: 13 }, formatter: (params: Array<{ name: string; value: number }>) => `${params[0].name}<br/>支出 ${(params[0].value ?? 0).toFixed(2)}` },
      grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: values.map((_, i) => `${i + 1}日`), axisLine: { lineStyle: { color: readCssColor('--color-border', CHART_SPLIT) } }, axisTick: { show: false }, axisLabel: textStyle() },
      yAxis: { type: 'value', splitLine: splitLineStyle(), axisLabel: textStyle() },
      series: [{ type: 'bar', data: values, barWidth: '60%', itemStyle: { color: readCssColor('--color-chart-positive', '#5A9F61'), borderRadius: [4, 4, 0, 0] } }],
    })

    renderWindowChart(
      props.windowTotals.map(({ period }) => {
        const [y, m] = period.split('-')
        return y === props.scopeYear ? `${Number(m)}月` : `${y}年${Number(m)}月`
      }),
      props.windowTotals.map(({ total }) => Math.round((total / 100) * 100) / 100),
    )
  } else {
    const monthValues = Array.from({ length: 12 }, (_, i) => {
      const prefix = `${props.scopeYear}-${String(i + 1).padStart(2, '0')}`
      let sum = 0
      for (const [date, amount] of dailyExpense.value) {
        if (date.startsWith(prefix)) sum += amount
      }
      return Math.round((sum / 100) * 100) / 100
    })
    const hasData = monthValues.some((v) => v > 0)
    barChart.setOption({
      title: { text: hasData ? '' : '暂无支出数据', left: 'center', top: '42%', textStyle: { fontSize: 15, ...textStyle() } },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, textStyle: { fontSize: 13 }, formatter: (params: Array<{ name: string; value: number }>) => `${params[0].name}<br/>支出 ${(params[0].value ?? 0).toFixed(2)}` },
      grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: monthValues.map((_, i) => `${i + 1}月`), axisLine: { lineStyle: { color: readCssColor('--color-border', CHART_SPLIT) } }, axisTick: { show: false }, axisLabel: textStyle() },
      yAxis: { type: 'value', splitLine: splitLineStyle(), axisLabel: textStyle() },
      series: [{ type: 'bar', data: monthValues, barWidth: '60%', itemStyle: { color: readCssColor('--color-chart-positive', '#5A9F61'), borderRadius: [4, 4, 0, 0] } }],
    })

    renderDailyLine()

    renderWindowChart(
      props.windowTotals.map(({ period }) => `${Number(period)}年`),
      props.windowTotals.map(({ total }) => Math.round((total / 100) * 100) / 100),
    )
  }
}

function renderDailyLine() {
  if (!lineChart) return
  const hasData = dailyValues.value.some((v) => v > 0)
  const lineColor = readCssColor('--color-chart-positive', '#5A9F61')
  lineChart.setOption({
    title: { text: hasData ? '' : '暂无支出数据', left: 'center', top: '42%', textStyle: { fontSize: 15, ...textStyle() } },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      textStyle: { fontSize: 13 },
      formatter: (params: Array<{ axisValue: string; value: number }>) => `${params[0].axisValue}<br/>支出 ${(params[0].value ?? 0).toFixed(2)}`,
    },
    grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: dailyAxis.value,
      boundaryGap: false,
      axisLine: { lineStyle: { color: readCssColor('--color-border', CHART_SPLIT) } },
      axisTick: { show: false },
      axisLabel: {
        interval: (index: number, value: string) =>
          index === 0 || index === dailyAxis.value.length - 1 || value.endsWith('-01'),
        formatter: (value: string) => `${Number(value.slice(5, 7))}/${Number(value.slice(8, 10))}`,
        ...textStyle(),
      },
    },
    yAxis: { type: 'value', splitLine: splitLineStyle(), axisLabel: textStyle() },
    series: [{
      type: 'line',
      data: dailyValues.value,
      smooth: false,
      symbol: 'none',
      lineStyle: { width: 2, color: lineColor },
      areaStyle: { opacity: 0.12, color: lineColor },
    }],
  })
}

function renderWindowChart(labels: string[], values: number[]) {
  if (!windowChart) return
  const hasData = values.some((v) => v > 0)
  windowChart.setOption({
    title: { text: hasData ? '' : '暂无支出数据', left: 'center', top: '42%', textStyle: { fontSize: 15, ...textStyle() } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, textStyle: { fontSize: 13 }, formatter: (params: Array<{ name: string; value: number }>) => `${params[0].name}<br/>支出 ${(params[0].value ?? 0).toFixed(2)}` },
    grid: { left: 8, right: 8, top: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: labels, axisLine: { lineStyle: { color: readCssColor('--color-border', CHART_SPLIT) } }, axisTick: { show: false }, axisLabel: textStyle() },
    yAxis: { type: 'value', splitLine: splitLineStyle(), axisLabel: textStyle() },
    series: [{ type: 'bar', data: values, barWidth: '60%', itemStyle: { color: readCssColor('--color-chart-positive', '#5A9F61'), borderRadius: [4, 4, 0, 0] } }],
  })
}

watch(
  () => [props.records, props.categories, props.scope, props.selectedMonth, props.scopeYear, props.windowTotals],
  async () => {
    if (props.scope === 'month') {
      lineChart?.dispose()
      lineChart = null
    }
    await nextTick()
    ensureCharts()
    renderCharts()
  },
)

onMounted(() => {
  ensureCharts()

  resizeHandler = () => {
    ringChart?.resize()
    barChart?.resize()
    lineChart?.resize()
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
  lineChart?.dispose()
  windowChart?.dispose()
  ringChart = null
  barChart = null
  lineChart = null
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
        <div class="stat-value stat-net">{{ formatCents(aggregateRecords(props.records, props.categories).net) }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">{{ scope === 'month' ? '每日平均支出' : '每月平均支出' }}</div>
        <div class="stat-value stat-expense">{{ formatPlainCents(averageExpense) }}</div>
      </div>
    </div>

    <div class="chart-box">
      <h3 class="chart-title">{{ periodText }}分类支出占比</h3>
      <div ref="ringEl" class="chart chart--ring"></div>
    </div>
    <div class="chart-box">
      <h3 class="chart-title">{{ periodText }}{{ scope === 'month' ? '每日支出' : '月度支出' }}</h3>
      <div ref="barEl" class="chart"></div>
    </div>
    <div v-if="scope === 'year'" class="chart-box">
      <h3 class="chart-title">{{ periodText }}每日支出</h3>
      <div ref="lineEl" class="chart chart--line"></div>
    </div>
    <div class="chart-box">
      <h3 class="chart-title">{{ scope === 'month' ? '近6个月支出对比' : '近6年支出对比' }}</h3>
      <div ref="windowEl" class="chart"></div>
    </div>
  </div>
</template>

<style scoped src="./BillsCharts.css"></style>
