import { describe, expect, it } from 'vitest'
import {
  FALLBACK_GROUP_LETTER,
  groupTagsByLetter,
  resolveGroupLetter,
} from '../../src/components/form/components/TagInput/tagGrouping'

describe('resolveGroupLetter', () => {
  it('groups English tags by the first letter case-insensitively', () => {
    expect(resolveGroupLetter('ant')).toBe('A')
    expect(resolveGroupLetter('Apple')).toBe('A')
    expect(resolveGroupLetter('Zoo')).toBe('Z')
  })

  it('groups Chinese tags by the pinyin initial of the leading CJK run', () => {
    expect(resolveGroupLetter('北京')).toBe('B')
    expect(resolveGroupLetter('上班')).toBe('S')
    expect(resolveGroupLetter('爱情')).toBe('A')
    expect(resolveGroupLetter('北冰洋')).toBe('B')
  })

  it('resolves polyphonic characters with word-level pinyin', () => {
    expect(resolveGroupLetter('重庆')).toBe('C')
    expect(resolveGroupLetter('长春')).toBe('C')
    expect(resolveGroupLetter('青岛')).toBe('Q')
  })

  it('falls back to # for digits, symbols, and emoji', () => {
    expect(resolveGroupLetter('3D')).toBe(FALLBACK_GROUP_LETTER)
    expect(resolveGroupLetter('@饭搭子')).toBe(FALLBACK_GROUP_LETTER)
    expect(resolveGroupLetter('😀')).toBe(FALLBACK_GROUP_LETTER)
    expect(resolveGroupLetter('123')).toBe(FALLBACK_GROUP_LETTER)
  })

  it('falls back to # for empty input', () => {
    expect(resolveGroupLetter('')).toBe(FALLBACK_GROUP_LETTER)
    expect(resolveGroupLetter('   ')).toBe(FALLBACK_GROUP_LETTER)
  })
})

describe('groupTagsByLetter', () => {
  it('returns no groups for an empty list', () => {
    expect(groupTagsByLetter([])).toEqual([])
  })

  it('keeps the original order inside each group', () => {
    const groups = groupTagsByLetter([
      'banana',
      'bank',
      'backup',
      '背包',
      '宝贝',
      '背景',
      '北京',
      '绷带',
      '北冰洋',
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]).toEqual({
      letter: 'B',
      items: ['banana', 'bank', 'backup', '背包', '宝贝', '背景', '北京', '绷带', '北冰洋'],
    })
  })

  it('orders groups from A to Z and places # last', () => {
    const groups = groupTagsByLetter(['北京', 'apple', '3D', '上班', 'ant', '😀'])

    expect(groups.map((group) => group.letter)).toEqual(['A', 'B', 'S', '#'])
    expect(groups.find((group) => group.letter === 'A')?.items).toEqual(['apple', 'ant'])
  })

  it('merges case variants into a single group', () => {
    const groups = groupTagsByLetter(['Apple', 'ant', 'ANT'])

    expect(groups).toHaveLength(1)
    expect(groups[0].letter).toBe('A')
    expect(groups[0].items).toEqual(['Apple', 'ant', 'ANT'])
  })

  it('spreads Chinese and English tags across multiple groups', () => {
    const groups = groupTagsByLetter(['原神', '工作', 'code', '爱情', 'money'])

    expect(groups.map((group) => group.letter)).toEqual(['A', 'C', 'G', 'M', 'Y'])
  })
})
