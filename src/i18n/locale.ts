import { messages } from './messages'

export type Locale = 'en' | 'zh-CN'

const LANGUAGE_KEY = 'needle:language'

function isLocale(value: string | null): value is Locale {
  return value === 'en' || value === 'zh-CN'
}

export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY)
    if (isLocale(saved)) return saved
  } catch { /* Storage can be disabled. */ }
  return navigator.languages.some((language) => /^zh(?:-|$)/i.test(language)) ? 'zh-CN' : 'en'
}

export function applyLocale(locale: Locale) {
  document.documentElement.lang = locale
  document.documentElement.dataset.locale = locale
  document.title = messages[locale]['meta.title']
  document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute('content', messages[locale]['meta.description'])
}

export function persistLocale(locale: Locale) {
  try { localStorage.setItem(LANGUAGE_KEY, locale) } catch { /* Storage can be disabled. */ }
}
