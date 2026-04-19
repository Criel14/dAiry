import type { AppTheme } from '../types/dairy'

const SYSTEM_DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

export function resolveThemePreference(theme: AppTheme): 'light' | 'dark' {
  if (theme === 'light' || theme === 'dark') {
    return theme
  }

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light'
  }

  return window.matchMedia(SYSTEM_DARK_MEDIA_QUERY).matches ? 'dark' : 'light'
}

export function applyThemePreference(theme: AppTheme) {
  if (typeof document === 'undefined') {
    return
  }

  const resolvedTheme = resolveThemePreference(theme)
  document.documentElement.dataset.themePreference = theme
  document.documentElement.dataset.theme = resolvedTheme
}

export function observeSystemThemeChange(listener: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {}
  }

  const mediaQuery = window.matchMedia(SYSTEM_DARK_MEDIA_QUERY)
  const handleChange = () => listener()

  if (typeof mediaQuery.addEventListener === 'function') {
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }

  mediaQuery.addListener(handleChange)
  return () => mediaQuery.removeListener(handleChange)
}
