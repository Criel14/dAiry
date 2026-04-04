<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const weekLabels = ['一', '二', '三', '四', '五', '六', '日']
const visibleMonth = ref(dayjs(props.modelValue).startOf('month'))

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

const calendarDays = computed(() => {
  const monthStart = visibleMonth.value.startOf('month')
  // dayjs 的 day() 里周日是 0，这里转成“周一开头”的月历布局。
  const leadingOffset = (monthStart.day() + 6) % 7
  const gridStart = monthStart.subtract(leadingOffset, 'day')

  // 固定生成 6 行 * 7 列，布局稳定，切月时不会因为行数变化跳动。
  return Array.from({ length: 42 }, (_, index) => {
    const currentDate = gridStart.add(index, 'day')
    return {
      key: currentDate.format('YYYY-MM-DD'),
      label: currentDate.date(),
      isCurrentMonth: currentDate.month() === visibleMonth.value.month(),
      isToday: currentDate.isSame(dayjs(), 'day'),
      isSelected: currentDate.isSame(selectedDate.value, 'day'),
      isWeekend: currentDate.day() === 0 || currentDate.day() === 6,
    }
  })
})

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
  const today = dayjs()
  visibleMonth.value = today.startOf('month')
  emit('update:modelValue', today.format('YYYY-MM-DD'))
}

function getDayButtonClass(day: {
  isCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
  isWeekend: boolean
}) {
  return {
    'calendar-day': true,
    'calendar-day--outside': !day.isCurrentMonth,
    'calendar-day--today': day.isToday,
    'calendar-day--selected': day.isSelected,
    'calendar-day--weekend': day.isWeekend,
  }
}

function getDayAriaLabel(dateText: string) {
  const date = dayjs(dateText)
  return date.isValid() ? date.format('YYYY 年 M 月 D 日 dddd') : dateText
}
</script>

<template>
  <section class="calendar-panel">
    <header class="calendar-toolbar">
      <div class="calendar-switches">
        <button class="toolbar-button" type="button" title="上一年" @click="shiftYear(-1)">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M11.8 5.5 7.3 10l4.5 4.5M16 5.5 11.5 10 16 14.5" />
          </svg>
        </button>
        <button class="toolbar-button" type="button" title="上个月" @click="shiftMonth(-1)">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="M12.5 5.5 8 10l4.5 4.5" />
          </svg>
        </button>
      </div>

      <strong class="calendar-title">{{ monthTitle }}</strong>

      <div class="calendar-switches calendar-switches--end">
        <button class="toolbar-button" type="button" title="下个月" @click="shiftMonth(1)">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m7.5 5.5 4.5 4.5-4.5 4.5" />
          </svg>
        </button>
        <button class="toolbar-button" type="button" title="下一年" @click="shiftYear(1)">
          <svg viewBox="0 0 20 20" aria-hidden="true">
            <path d="m4 5.5 4.5 4.5L4 14.5M8.2 5.5l4.5 4.5-4.5 4.5" />
          </svg>
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
        :aria-label="getDayAriaLabel(day.key)"
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

<style scoped>
.calendar-panel {
  display: grid;
  gap: 1rem;
}

.calendar-toolbar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0.5rem;
  align-items: center;
}

.calendar-switches {
  display: flex;
  gap: 0.5rem;
}

.calendar-switches--end {
  justify-content: flex-end;
}

.calendar-title {
  font-size: 1rem;
  text-align: center;
  color: var(--color-text-main);
}

.toolbar-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-subtle);
  transition:
    transform 160ms ease,
    color 160ms ease,
    opacity 160ms ease;
}

.toolbar-button:hover {
  color: var(--color-text-main);
  opacity: 0.9;
  transform: translateY(-1px);
}

.toolbar-button svg {
  width: 1rem;
  height: 1rem;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.8;
  fill: none;
}

.today-button {
  min-height: 2.25rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-subtle);
  font-size: 0.88rem;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease;
}

.today-button:hover {
  color: var(--color-text-main);
  border-color: var(--color-border-strong);
  box-shadow: 0 6px 14px rgba(95, 82, 42, 0.08);
  transform: translateY(-1px);
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.45rem;
}

.calendar-weekday {
  text-align: center;
  font-size: 0.8rem;
  color: var(--color-text-subtle);
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.45rem;
}

.calendar-day {
  aspect-ratio: 1 / 1;
  min-height: 2.65rem;
  padding: 0;
  border: 1px solid var(--color-border-soft);
  border-radius: 8px;
  background: var(--color-surface);
  color: var(--color-text-main);
  font-size: 0.92rem;
  transition:
    transform 160ms ease,
    background-color 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.calendar-day:hover {
  border-color: var(--color-border-strong);
  background: var(--color-surface-muted);
  box-shadow: 0 8px 14px rgba(95, 82, 42, 0.06);
  transform: translateY(-1px);
}

.calendar-day--outside {
  color: rgba(107, 119, 128, 0.48);
  background: #fcfbf6;
}

.calendar-day--weekend {
  color: #628190;
}

.calendar-day--today {
  border-color: #d8c991;
}

.calendar-day--selected {
  background: #f3e8bf;
  border-color: #d7c68a;
  color: #4f4630;
  box-shadow: none;
}

.today-button {
  justify-self: start;
  padding: 0 1rem;
}

@media (max-width: 640px) {
  .calendar-toolbar {
    grid-template-columns: 1fr;
  }

  .calendar-switches,
  .calendar-switches--end {
    justify-content: center;
    flex-wrap: wrap;
  }
}
</style>
