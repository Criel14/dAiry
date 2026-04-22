import { Notification } from 'electron'
import type { NotificationConfig } from '../../src/types/app'
import { APP_ICON_PATH, DEFAULT_NOTIFICATION_CONFIG } from './constants'
import { canSendDiaryReminder, navigateMainPanel } from './window'

let reminderTimer: NodeJS.Timeout | null = null
let currentNotificationConfig: NotificationConfig = {
  ...DEFAULT_NOTIFICATION_CONFIG,
}
let lastReminderDateKey = ''

function clearReminderTimer() {
  if (!reminderTimer) {
    return
  }

  clearTimeout(reminderTimer)
  reminderTimer = null
}

function formatDateKey(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseReminderTime(reminderTime: string) {
  const matched = reminderTime.match(/^(\d{2}):(\d{2})$/)

  if (!matched) {
    return {
      hour: 21,
      minute: 30,
    }
  }

  return {
    hour: Number(matched[1]),
    minute: Number(matched[2]),
  }
}

function getNextReminderDate(config: NotificationConfig, now = new Date()) {
  const { hour, minute } = parseReminderTime(config.reminderTime)
  const nextReminderDate = new Date(now)

  nextReminderDate.setHours(hour, minute, 0, 0)

  if (nextReminderDate.getTime() <= now.getTime()) {
    nextReminderDate.setDate(nextReminderDate.getDate() + 1)
  }

  return nextReminderDate
}

function showDiaryReminder() {
  if (!Notification.isSupported()) {
    return
  }

  const notification = new Notification({
    title: 'dAiry 提醒你',
    body: '是时候写几句话记录今日的生活了',
    icon: APP_ICON_PATH,
    silent: false,
  })

  notification.on('click', () => {
    navigateMainPanel('journal')
  })

  notification.show()
}

function scheduleNextReminder() {
  clearReminderTimer()

  if (!currentNotificationConfig.enabled) {
    return
  }

  const nextReminderDate = getNextReminderDate(currentNotificationConfig)
  const delay = Math.max(nextReminderDate.getTime() - Date.now(), 1_000)

  reminderTimer = setTimeout(() => {
    reminderTimer = null

    const now = new Date()
    const todayKey = formatDateKey(now)

    if (lastReminderDateKey !== todayKey && canSendDiaryReminder()) {
      showDiaryReminder()
      lastReminderDateKey = todayKey
    }

    scheduleNextReminder()
  }, delay)
}

export function configureDiaryReminder(config: NotificationConfig) {
  currentNotificationConfig = {
    enabled: config.enabled === true,
    reminderTime: config.reminderTime,
  }

  scheduleNextReminder()
}

export function disposeDiaryReminder() {
  clearReminderTimer()
}
