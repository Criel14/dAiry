// 检查更新用的版本号解析与比较，保持纯函数以便单测

export function normalizeReleaseTag(tag: unknown): string | null {
  if (typeof tag !== 'string') {
    return null
  }

  const normalized = tag.trim().replace(/^v/i, '')

  if (!/^\d+(\.\d+)*$/.test(normalized)) {
    return null
  }

  return normalized
}

function parseVersionSegments(version: string): number[] | null {
  const normalized = normalizeReleaseTag(version)

  if (!normalized) {
    return null
  }

  return normalized.split('.').map((segment) => Number(segment))
}

export function isRemoteVersionNewer(remoteVersion: string, localVersion: string): boolean {
  const remoteSegments = parseVersionSegments(remoteVersion)
  const localSegments = parseVersionSegments(localVersion)

  if (!remoteSegments || !localSegments) {
    return false
  }

  const segmentCount = Math.max(remoteSegments.length, localSegments.length)

  for (let index = 0; index < segmentCount; index += 1) {
    const remoteSegment = remoteSegments[index] ?? 0
    const localSegment = localSegments[index] ?? 0

    if (remoteSegment !== localSegment) {
      return remoteSegment > localSegment
    }
  }

  return false
}
