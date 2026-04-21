import { onBeforeUnmount, onMounted, ref } from 'vue'
import { applyThemePreference, observeSystemThemeChange } from '../../../../shared/theme'
import type { AppTheme } from '../../../../types/app'

const EXPORT_LAYOUT_MODE_CLASS = 'report-export-mode'

function setExportLayoutMode(enabled: boolean) {
  const method = enabled ? 'add' : 'remove'

  document.documentElement.classList[method](EXPORT_LAYOUT_MODE_CLASS)
  document.body.classList[method](EXPORT_LAYOUT_MODE_CLASS)
  document.getElementById('app')?.classList[method](EXPORT_LAYOUT_MODE_CLASS)
}

export function useReportExportTheme() {
  const themePreference = ref<AppTheme>('system')
  let removeSystemThemeListener: (() => void) | null = null

  async function syncThemePreference() {
    try {
      themePreference.value = await window.dairy.getThemePreference()
    } catch {
      themePreference.value = 'system'
    }

    applyThemePreference(themePreference.value)
  }

  onMounted(() => {
    setExportLayoutMode(true)
    removeSystemThemeListener = observeSystemThemeChange(() => {
      if (themePreference.value === 'system') {
        applyThemePreference(themePreference.value)
      }
    })
    void syncThemePreference()
  })

  onBeforeUnmount(() => {
    removeSystemThemeListener?.()
    removeSystemThemeListener = null
    setExportLayoutMode(false)
  })
}
