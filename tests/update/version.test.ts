import { describe, expect, it } from 'vitest'
import { isRemoteVersionNewer, normalizeReleaseTag } from '../../electron/main/update/version'

describe('normalizeReleaseTag', () => {
  it('strips a leading v from release tags', () => {
    expect(normalizeReleaseTag('v1.8.0')).toBe('1.8.0')
    expect(normalizeReleaseTag('V1.8.0')).toBe('1.8.0')
  })

  it('keeps plain dotted versions as is', () => {
    expect(normalizeReleaseTag('1.8.0')).toBe('1.8.0')
    expect(normalizeReleaseTag('1.8')).toBe('1.8')
  })

  it('rejects tags that are not dotted versions', () => {
    expect(normalizeReleaseTag('release-2026')).toBeNull()
    expect(normalizeReleaseTag('1.8.0-beta.1')).toBeNull()
    expect(normalizeReleaseTag('')).toBeNull()
    expect(normalizeReleaseTag(undefined)).toBeNull()
    expect(normalizeReleaseTag(123)).toBeNull()
  })
})

describe('isRemoteVersionNewer', () => {
  it('compares versions segment by segment as numbers', () => {
    expect(isRemoteVersionNewer('1.10.0', '1.9.0')).toBe(true)
    expect(isRemoteVersionNewer('2.0.0', '1.99.99')).toBe(true)
    expect(isRemoteVersionNewer('1.8.1', '1.8.0')).toBe(true)
  })

  it('treats equal versions as not newer', () => {
    expect(isRemoteVersionNewer('1.8.0', '1.8.0')).toBe(false)
    expect(isRemoteVersionNewer('1.8', '1.8.0')).toBe(false)
  })

  it('treats an older remote version as not newer', () => {
    expect(isRemoteVersionNewer('1.8.0', '1.8.1')).toBe(false)
    expect(isRemoteVersionNewer('1.8', '1.10')).toBe(false)
  })

  it('returns false when a version cannot be parsed', () => {
    expect(isRemoteVersionNewer('not-a-version', '1.8.0')).toBe(false)
    expect(isRemoteVersionNewer('1.9.0', 'not-a-version')).toBe(false)
  })
})
