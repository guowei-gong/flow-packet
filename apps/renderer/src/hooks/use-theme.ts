import { create } from 'zustand'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'flow-packet-theme'

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return 'dark'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

interface ThemeStore {
  theme: Theme
  toggleTheme: () => void
}

export const useTheme = create<ThemeStore>((set, get) => {
  // 初始化时立即应用
  const initial = getInitialTheme()
  applyTheme(initial)

  return {
    theme: initial,
    toggleTheme: () => {
      const next = get().theme === 'dark' ? 'light' : 'dark'
      applyTheme(next)
      localStorage.setItem(STORAGE_KEY, next)
      set({ theme: next })
    },
  }
})
