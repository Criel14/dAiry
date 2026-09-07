import { pinyin } from 'pinyin-pro'

export interface TagGroup {
  letter: string
  items: string[]
}

export const FALLBACK_GROUP_LETTER = '#'

const A_Z_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

const ASCII_LETTER_RE = /^[a-zA-Z]/

const LEADING_CJK_RE = /^[\u3400-\u9fff\uf900-\ufaff]+/

export function resolveGroupLetter(tag: string): string {
  const trimmed = tag.trim()
  if (!trimmed) {
    return FALLBACK_GROUP_LETTER
  }

  const firstCharacter = Array.from(trimmed)[0]
  if (!firstCharacter) {
    return FALLBACK_GROUP_LETTER
  }

  if (ASCII_LETTER_RE.test(firstCharacter)) {
    return firstCharacter.toUpperCase()
  }

  const leadingCjkMatch = trimmed.match(LEADING_CJK_RE)
  if (leadingCjkMatch) {
    const leadingCjkText = leadingCjkMatch[0]
    const pinyinSyllables = pinyin(leadingCjkText, {
      toneType: 'none',
      type: 'array',
    })

    for (const syllable of pinyinSyllables) {
      const firstLetter = Array.from(syllable)[0]
      if (firstLetter && ASCII_LETTER_RE.test(firstLetter)) {
        return firstLetter.toUpperCase()
      }
    }
  }

  return FALLBACK_GROUP_LETTER
}

export function groupTagsByLetter(tags: string[]): TagGroup[] {
  const groupsByLetter = new Map<string, TagGroup>()

  for (const tag of tags) {
    const letter = resolveGroupLetter(tag)

    let group = groupsByLetter.get(letter)
    if (!group) {
      group = { letter, items: [] }
      groupsByLetter.set(letter, group)
    }

    group.items.push(tag)
  }

  const orderedLetters = [...A_Z_LETTERS]
  if (groupsByLetter.has(FALLBACK_GROUP_LETTER)) {
    orderedLetters.push(FALLBACK_GROUP_LETTER)
  }

  return orderedLetters
    .filter((letter) => groupsByLetter.has(letter))
    .map((letter) => groupsByLetter.get(letter) as TagGroup)
}
