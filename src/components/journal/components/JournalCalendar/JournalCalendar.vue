<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import dayjs from 'dayjs'
import type { JournalDayActivity } from '../../../../types/dairy'

const props = defineProps<{
  modelValue: string
  todayDate: string
  workspacePath: string | null
  isHeatmapEnabled: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const weekLabels = ['一', '二', '三', '四', '五', '六', '日']
const visibleMonth = ref(dayjs(props.modelValue).startOf('month'))
const isLoadingActivity = ref(false)
const monthActivityMap = ref<Record<string, JournalDayActivity>>({})
let activityLoadSequence = 0

watch(
  () => props.modelValue,
  (value) => {
    const parsedDate = dayjs(value)
    if (!parsedDate.isValid()) {
      return
    }

    const nextVisibleMonth = parsedDate.startOf('month')
    if (!nextVisibleMonth.isSame(visibleMonth.value, 'month')) {
      visibleMonth.value = nextVisibleMonth
    }
  },
  { immediate: true },
)

const monthTitle = computed(() => visibleMonth.value.format('YYYY 年 M 月'))
const selectedDate = computed(() => dayjs(props.modelValue))
const todayDate = computed(() => {
  const parsedDate = dayjs(props.todayDate)
  return parsedDate.isValid() ? parsedDate : dayjs()
})
const visibleMonthKey = computed(() => visibleMonth.value.format('YYYY-MM'))

const calendarDays = computed(() => {
  const monthStart = visibleMonth.value.startOf('month')
  const leadingOffset = (monthStart.day() + 6) % 7
  const gridStart = monthStart.subtract(leadingOffset, 'day')

  return Array.from({ length: 42 }, (_, index) => {
    const currentDate = gridStart.add(index, 'day')
    return {
      key: currentDate.format('YYYY-MM-DD'),
      label: currentDate.date(),
      isCurrentMonth: currentDate.month() === visibleMonth.value.month(),
      isToday: currentDate.isSame(todayDate.value, 'day'),
      isSelected: currentDate.isSame(selectedDate.value, 'day'),
      isWeekend: currentDate.day() === 0 || currentDate.day() === 6,
      activity: monthActivityMap.value[currentDate.format('YYYY-MM-DD')] ?? null,
    }
  })
})

watch(
  [visibleMonthKey, () => props.workspacePath, () => props.isHeatmapEnabled],
  async ([month, workspacePath, heatmapEnabled]) => {
    if (!workspacePath || !heatmapEnabled) {
      monthActivityMap.value = {}
      isLoadingActivity.value = false
      return
    }

    const currentLoad = ++activityLoadSequence
    isLoadingActivity.value = true

    try {
      const result = await window.dairy.getJournalMonthActivity({
        workspacePath,
        month,
      })

      if (currentLoad !== activityLoadSequence) {
        return
      }

      monthActivityMap.value = Object.fromEntries(result.days.map((day) => [day.date, day]))
    } catch {
      if (currentLoad !== activityLoadSequence) {
        return
      }

      monthActivityMap.value = {}
    } finally {
      if (currentLoad === activityLoadSequence) {
        isLoadingActivity.value = false
      }
    }
  },
  { immediate: true },
)

function shiftMonth(amount: number) {
  visibleMonth.value = visibleMonth.value.add(amount, 'month')
}

function shiftYear(amount: number) {
  visibleMonth.value = visibleMonth.value.add(amount, 'year')
}

function selectDate(dateText: string) {
  emit('update:modelValue', dateText)
}

function goToToday() {
  visibleMonth.value = todayDate.value.startOf('month')
  emit('update:modelValue', todayDate.value.format('YYYY-MM-DD'))
}

function getHeatLevel(wordCount: number) {
  if (wordCount >= 700) {
    return 4
  }

  if (wordCount >= 400) {
    return 3
  }

  if (wordCount >= 150) {
    return 2
  }

  if (wordCount > 0) {
    return 1
  }

  return 0
}

function getDayButtonClass(day: {
  isCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
  isWeekend: boolean
  activity: JournalDayActivity | null
}) {
  const heatLevel =
    props.isHeatmapEnabled && day.isCurrentMonth && day.activity
      ? getHeatLevel(day.activity.wordCount)
      : 0

  return {
    'calendar-day': true,
    'calendar-day--outside': !day.isCurrentMonth,
    'calendar-day--today': day.isToday,
    'calendar-day--selected': day.isSelected,
    'calendar-day--weekend': day.isWeekend,
    'calendar-day--heat-1': heatLevel === 1,
    'calendar-day--heat-2': heatLevel === 2,
    'calendar-day--heat-3': heatLevel === 3,
    'calendar-day--heat-4': heatLevel === 4,
  }
}

function getDayAriaLabel(dateText: string, activity: JournalDayActivity | null) {
  const date = dayjs(dateText)
  if (!date.isValid()) {
    return dateText
  }

  if (!props.isHeatmapEnabled || !activity?.hasEntry) {
    return date.format('YYYY 年 M 月 D 日 dddd')
  }

  if (activity.wordCount > 0) {
    return `${date.format('YYYY 年 M 月 D 日 dddd')}，${activity.wordCount} 字`
  }

  return `${date.format('YYYY 年 M 月 D 日 dddd')}，已创建空白日记`
}

function getDayTitle(day: {
  key: string
  isCurrentMonth: boolean
  activity: JournalDayActivity | null
}) {
  if (!props.isHeatmapEnabled || !day.isCurrentMonth) {
    return ''
  }

  const dateText = dayjs(day.key).format('M 月 D 日')

  if (!day.activity?.hasEntry) {
    return `${dateText}：没有日记`
  }

  if (day.activity.wordCount > 0) {
    return `${dateText}：${day.activity.wordCount} 字`
  }

  return `${dateText}：已创建空白日记`
}
</script>

<template>
  <section class="calendar-panel">
    <header class="calendar-toolbar">
      <div class="calendar-switches">
        <button class="toolbar-button" type="button" title="上一年" aria-label="上一年" @click="shiftYear(-1)">
          <Icon class="toolbar-icon" icon="lucide:chevrons-left" aria-hidden="true" />
        </button>
        <button class="toolbar-button" type="button" title="上个月" aria-label="上个月" @click="shiftMonth(-1)">
          <Icon class="toolbar-icon" icon="lucide:chevron-left" aria-hidden="true" />
        </button>
      </div>

      <strong class="calendar-title">{{ monthTitle }}</strong>

      <div class="calendar-switches calendar-switches--end">
        <button class="toolbar-button" type="button" title="下个月" aria-label="下个月" @click="shiftMonth(1)">
          <Icon class="toolbar-icon" icon="lucide:chevron-right" aria-hidden="true" />
        </button>
        <button class="toolbar-button" type="button" title="下一年" aria-label="下一年" @click="shiftYear(1)">
          <Icon class="toolbar-icon" icon="lucide:chevrons-right" aria-hidden="true" />
        </button>
      </div>
    </header>

    <div class="calendar-weekdays">
      <span v-for="label in weekLabels" :key="label" class="calendar-weekday">
        {{ label }}
      </span>
    </div>

    <div class="calendar-grid">
      <button
        v-for="day in calendarDays"
        :key="day.key"
        :class="getDayButtonClass(day)"
        :aria-label="getDayAriaLabel(day.key, day.activity)"
        :title="getDayTitle(day)"
        type="button"
        @click="selectDate(day.key)"
      >
        {{ day.label }}
      </button>
    </div>

    <button class="today-button" type="button" @click="goToToday">
      回到今天
    </button>
  </section>
</template>

<style scoped src="./JournalCalendar.css"></style>

