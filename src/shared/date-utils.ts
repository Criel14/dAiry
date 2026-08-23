import dayjs from 'dayjs'

export function getJournalDateText(hour: number, baseDate = dayjs()) {
  return baseDate.subtract(hour, 'hour').format('YYYY-MM-DD')
}
