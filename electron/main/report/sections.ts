import type {
  ReportDailyEntry,
  ReportLocationPatternsSection,
  ReportSectionKey,
  ReportSections,
  ReportSourceSummary,
  ReportStatsSection,
  ReportTagCloudItem,
  ReportTimePatternsSection,
} from '../../../src/types/report'

function countLongestStreak(dailyEntries: ReportDailyEntry[]) {
  let longestStreak = 0
  let currentStreak = 0

  for (const entry of dailyEntries) {
    if (entry.hasEntry) {
      currentStreak += 1
      longestStreak = Math.max(longestStreak, currentStreak)
      continue
    }

    currentStreak = 0
  }

  return longestStreak
}

function countCurrentStreakAtEnd(dailyEntries: ReportDailyEntry[]) {
  let streak = 0

  for (let index = dailyEntries.length - 1; index >= 0; index -= 1) {
    if (!dailyEntries[index].hasEntry) {
      break
    }

    streak += 1
  }

  return streak
}

export function buildSourceSummary(dailyEntries: ReportDailyEntry[]): ReportSourceSummary {
  const entryDays = dailyEntries.filter((entry) => entry.hasEntry)
  const totalWords = entryDays.reduce((sum, entry) => sum + entry.wordCount, 0)

  return {
    totalDays: dailyEntries.length,
    entryDays: entryDays.length,
    missingDays: dailyEntries.length - entryDays.length,
    totalWords,
    averageWords: entryDays.length > 0 ? Math.round(totalWords / entryDays.length) : 0,
    longestStreak: countLongestStreak(dailyEntries),
  }
}

function buildStatsSection(dailyEntries: ReportDailyEntry[]): ReportStatsSection {
  const source = buildSourceSummary(dailyEntries)
  const maxWordEntry = dailyEntries
    .filter((entry) => entry.hasEntry)
    .reduce<ReportDailyEntry | null>((maxEntry, entry) => {
      if (!maxEntry || entry.wordCount > maxEntry.wordCount) {
        return entry
      }

      return maxEntry
    }, null)

  return {
    recordDays: source.entryDays,
    missingDays: source.missingDays,
    totalWords: source.totalWords,
    averageWords: source.averageWords,
    maxWordsInOneDay: maxWordEntry?.wordCount ?? 0,
    maxWordsDate: maxWordEntry?.date ?? null,
    longestStreak: source.longestStreak,
    currentStreakAtEnd: countCurrentStreakAtEnd(dailyEntries),
  }
}

export function buildTagCloudItems(dailyEntries: ReportDailyEntry[]): ReportTagCloudItem[] {
  const tagCounter = new Map<string, number>()

  for (const entry of dailyEntries) {
    for (const tag of entry.tags) {
      tagCounter.set(tag, (tagCounter.get(tag) ?? 0) + 1)
    }
  }

  return [...tagCounter.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, 'zh-Hans-CN'))
    .slice(0, 30)
}

function buildLocationPatternsSection(
  dailyEntries: ReportDailyEntry[],
): ReportLocationPatternsSection {
  const locationMap = new Map<string, { count: number; totalWords: number }>()

  for (const entry of dailyEntries) {
    if (!entry.hasEntry || !entry.location.trim()) {
      continue
    }

    const location = entry.location.trim()
    const currentValue = locationMap.get(location) ?? { count: 0, totalWords: 0 }
    locationMap.set(location, {
      count: currentValue.count + 1,
      totalWords: currentValue.totalWords + entry.wordCount,
    })
  }

  const ranking = [...locationMap.entries()]
    .map(([name, value]) => ({
      name,
      count: value.count,
      totalWords: value.totalWords,
    }))
    .sort((left, right) => right.count - left.count || right.totalWords - left.totalWords)

  const topLocation = ranking[0]
    ? {
        name: ranking[0].name,
        count: ranking[0].count,
      }
    : null

  const maxAverageWords = Math.max(...ranking.map((item) => item.totalWords / item.count), 1)
  const uniqueCandidate = ranking.reduce<{
    name: string
    count: number
    score: number
  } | null>((best, item) => {
    const rarityScore = 1 / item.count
    const averageWords = item.totalWords / item.count
    const intensityScore = averageWords / maxAverageWords
    const score = Number((rarityScore * 0.62 + intensityScore * 0.38).toFixed(2))

    if (!best || score > best.score) {
      return {
        name: item.name,
        count: item.count,
        score,
      }
    }

    return best
  }, null)

  return {
    topLocation,
    uniqueLocation: uniqueCandidate
      ? {
          name: uniqueCandidate.name,
          count: uniqueCandidate.count,
        }
      : null,
    ranking: ranking.map((item) => ({
      name: item.name,
      count: item.count,
    })),
  }
}

function getTimeBucketLabel(hour: number) {
  if (hour >= 0 && hour <= 5) {
    return '凌晨 0-5'
  }

  if (hour <= 8) {
    return '早晨 6-8'
  }

  if (hour <= 11) {
    return '上午 9-11'
  }

  if (hour <= 13) {
    return '中午 12-13'
  }

  if (hour <= 17) {
    return '下午 14-17'
  }

  return '晚上 18-23'
}

function buildTimePatternsSection(dailyEntries: ReportDailyEntry[]): ReportTimePatternsSection {
  const bucketMap = new Map<string, { count: number; totalWords: number }>()

  for (const entry of dailyEntries) {
    if (!entry.hasEntry || entry.writingHour === null) {
      continue
    }

    const bucketLabel = getTimeBucketLabel(entry.writingHour)
    const currentValue = bucketMap.get(bucketLabel) ?? { count: 0, totalWords: 0 }
    bucketMap.set(bucketLabel, {
      count: currentValue.count + 1,
      totalWords: currentValue.totalWords + entry.wordCount,
    })
  }

  const buckets = [...bucketMap.entries()]
    .map(([label, value]) => ({
      label,
      count: value.count,
      totalWords: value.totalWords,
    }))
    .sort((left, right) => right.count - left.count || right.totalWords - left.totalWords)

  const topTimeBucket = buckets[0]
    ? {
        label: buckets[0].label,
        count: buckets[0].count,
      }
    : null

  const maxAverageWords = Math.max(...buckets.map((item) => item.totalWords / item.count), 1)
  const uniqueCandidate = buckets.reduce<{
    label: string
    count: number
    score: number
  } | null>((best, item) => {
    const rarityScore = 1 / item.count
    const intensityScore = item.totalWords / item.count / maxAverageWords
    const score = Number((rarityScore * 0.58 + intensityScore * 0.42).toFixed(2))

    if (!best || score > best.score) {
      return {
        label: item.label,
        count: item.count,
        score,
      }
    }

    return best
  }, null)

  return {
    topTimeBucket,
    uniqueTimeBucket: uniqueCandidate
      ? {
          label: uniqueCandidate.label,
          count: uniqueCandidate.count,
        }
      : null,
    buckets: buckets.map((item) => ({
      label: item.label,
      count: item.count,
    })),
  }
}

export function buildSections(
  dailyEntries: ReportDailyEntry[],
  requestedSections: ReportSectionKey[],
): ReportSections {
  const sections: ReportSections = {}

  if (requestedSections.includes('stats')) {
    sections.stats = buildStatsSection(dailyEntries)
  }

  if (requestedSections.includes('heatmap')) {
    sections.heatmap = {
      points: dailyEntries.map((entry) => ({
        date: entry.date,
        value: entry.wordCount,
      })),
    }
  }

  if (requestedSections.includes('moodTrend')) {
    const moodEntries = dailyEntries.filter((entry) => entry.mood !== null)
    const totalMood = moodEntries.reduce((sum, entry) => sum + (entry.mood ?? 0), 0)

    sections.moodTrend = {
      points: dailyEntries.map((entry) => ({
        date: entry.date,
        value: entry.mood,
      })),
      averageMood: moodEntries.length > 0 ? Number((totalMood / moodEntries.length).toFixed(1)) : null,
    }
  }

  if (requestedSections.includes('tagCloud')) {
    sections.tagCloud = {
      items: buildTagCloudItems(dailyEntries),
    }
  }

  if (requestedSections.includes('locationPatterns')) {
    sections.locationPatterns = buildLocationPatternsSection(dailyEntries)
  }

  if (requestedSections.includes('timePatterns')) {
    sections.timePatterns = buildTimePatternsSection(dailyEntries)
  }

  return sections
}
