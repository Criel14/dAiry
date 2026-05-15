import { Notification } from 'electron'
import nodemailer from 'nodemailer'
import type { NotificationConfig } from '../../src/types/app'
import { APP_ICON_PATH, DEFAULT_NOTIFICATION_CONFIG } from './constants'
import { readEmailNotificationAuthCode } from './ai-secrets'
import { canSendDiaryReminder, navigateMainPanel } from './window'

let reminderTimer: NodeJS.Timeout | null = null
let currentNotificationConfig: NotificationConfig = {
  ...DEFAULT_NOTIFICATION_CONFIG,
}
let lastReminderDateKey = ''
const REPOSITORY_URL = 'https://github.com/Criel14/dAiry'

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

function formatEmailDateTime(date = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function buildDiaryReminderEmailHtml(config: NotificationConfig) {
  const sentAt = formatEmailDateTime()

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>来自 dAiry 的写日记提醒</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f1ec;color:#2f2a24;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',Arial,sans-serif;">
    <div style="padding:32px 16px;">
      <div style="max-width:560px;margin:0 auto;border:1px solid #e4d9ca;border-radius:14px;background:#fffaf3;overflow:hidden;">
        <div style="padding:24px 28px 18px;border-bottom:1px solid #eadfce;background:#fff7ec;">
          <div style="font-size:13px;line-height:1.4;color:#8b6f4e;letter-spacing:.08em;text-transform:uppercase;font-weight:700;">dAiry</div>
          <h1 style="margin:10px 0 0;font-size:24px;line-height:1.35;color:#2f2a24;font-weight:700;">该写今天的日记了</h1>
        </div>
        <div style="padding:24px 28px 22px;">
          <p style="margin:0;font-size:16px;line-height:1.8;color:#4b4035;">是时候写几句话记录今日的生活了。</p>
          <p style="margin:14px 0 0;font-size:14px;line-height:1.7;color:#75685b;">当前提醒时间：每天 ${config.reminderTime}</p>
          <div style="margin-top:22px;padding-top:18px;border-top:1px solid #eee3d4;">
            <a href="${REPOSITORY_URL}" style="color:#9a6a36;font-size:14px;font-weight:600;text-decoration:none;">打开 dAiry 代码仓库</a>
          </div>
        </div>
        <div style="padding:15px 28px;background:#f7efe4;color:#8a7b6b;font-size:12px;line-height:1.7;">
          本提醒由本地运行的 dAiry 发送。发送时间：${sentAt}
        </div>
      </div>
    </div>
  </body>
</html>`
}

function isEmailNotificationReady(config: NotificationConfig) {
  return Boolean(
    config.email.smtpHost &&
      config.email.smtpPort &&
      config.email.username &&
      config.email.fromEmail &&
      config.email.recipientEmail,
  )
}

async function sendDiaryReminderEmail(config: NotificationConfig) {
  if (!config.emailEnabled || !isEmailNotificationReady(config)) {
    return
  }

  const authCode = await readEmailNotificationAuthCode()
  if (!authCode) {
    return
  }

  const transporter = nodemailer.createTransport({
    host: config.email.smtpHost,
    port: config.email.smtpPort,
    secure: config.email.secure,
    auth: {
      user: config.email.username,
      pass: authCode,
    },
  })

  await transporter.sendMail({
    from: config.email.fromEmail,
    to: config.email.recipientEmail,
    subject: '来自 dAiry 的写日记提醒',
    text: `该写今天的日记了。\n\n是时候写几句话记录今日的生活了。\n\n当前提醒时间：每天 ${config.reminderTime}\n代码仓库：${REPOSITORY_URL}`,
    html: buildDiaryReminderEmailHtml(config),
  })
}

async function sendDiaryReminder(config: NotificationConfig) {
  if (config.systemEnabled) {
    showDiaryReminder()
  }

  try {
    await sendDiaryReminderEmail(config)
  } catch (error) {
    console.error('发送写日记提醒邮件失败：', error)
  }
}

function scheduleNextReminder() {
  clearReminderTimer()

  if (!currentNotificationConfig.systemEnabled && !currentNotificationConfig.emailEnabled) {
    return
  }

  const nextReminderDate = getNextReminderDate(currentNotificationConfig)
  const delay = Math.max(nextReminderDate.getTime() - Date.now(), 1_000)

  reminderTimer = setTimeout(() => {
    reminderTimer = null

    const now = new Date()
    const todayKey = formatDateKey(now)

    if (lastReminderDateKey !== todayKey && canSendDiaryReminder()) {
      void sendDiaryReminder(currentNotificationConfig)
      lastReminderDateKey = todayKey
    }

    scheduleNextReminder()
  }, delay)
}

export function configureDiaryReminder(config: NotificationConfig) {
  currentNotificationConfig = {
    systemEnabled: config.systemEnabled === true,
    emailEnabled: config.emailEnabled === true,
    reminderTime: config.reminderTime,
    email: {
      ...config.email,
    },
  }

  scheduleNextReminder()
}

export function disposeDiaryReminder() {
  clearReminderTimer()
}
