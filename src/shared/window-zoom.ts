export const DEFAULT_WINDOW_ZOOM_FACTOR = 1

export const WINDOW_ZOOM_PRESET_FACTORS = [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5] as const

export function normalizeWindowZoomFactor(rawValue: unknown) {
  if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
    return DEFAULT_WINDOW_ZOOM_FACTOR
  }

  let closestFactor: number = WINDOW_ZOOM_PRESET_FACTORS[0]
  let closestDistance = Math.abs(rawValue - closestFactor)

  for (const factor of WINDOW_ZOOM_PRESET_FACTORS) {
    const distance = Math.abs(rawValue - factor)
    if (distance < closestDistance) {
      closestFactor = factor
      closestDistance = distance
    }
  }

  return closestFactor
}

export function formatWindowZoomPercent(zoomFactor: number) {
  return `${Math.round(normalizeWindowZoomFactor(zoomFactor) * 100)}%`
}

export function getNextWindowZoomFactor(currentZoomFactor: number, direction: 1 | -1) {
  const normalizedCurrentZoomFactor = normalizeWindowZoomFactor(currentZoomFactor)
  const currentIndex = WINDOW_ZOOM_PRESET_FACTORS.findIndex(
    (factor) => factor === normalizedCurrentZoomFactor,
  )

  if (currentIndex === -1) {
    return DEFAULT_WINDOW_ZOOM_FACTOR
  }

  const nextIndex = Math.min(
    WINDOW_ZOOM_PRESET_FACTORS.length - 1,
    Math.max(0, currentIndex + direction),
  )

  return WINDOW_ZOOM_PRESET_FACTORS[nextIndex]
}
