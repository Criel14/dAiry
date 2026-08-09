import { describe, expect, it } from 'vitest'
import { resolveThemePreference } from '../../src/shared/theme/apply'

describe('resolveThemePreference', () => {
  it('returns pure theme directly', () => {
    expect(resolveThemePreference('pure')).toBe('pure')
  })

  it('returns explicit light and dark directly', () => {
    expect(resolveThemePreference('light')).toBe('light')
    expect(resolveThemePreference('dark')).toBe('dark')
  })

  it('falls back to light for system when no window API exists', () => {
    expect(resolveThemePreference('system')).toBe('light')
  })
})
