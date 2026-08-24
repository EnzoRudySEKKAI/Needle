import { createContext } from 'react'
import type { MessageKey } from './messages'
import type { Locale } from './locale'

export type TranslationValues = Record<string, string | number>

export type I18nValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: MessageKey, values?: TranslationValues) => string
  formatDate: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string
}

export const I18nContext = createContext<I18nValue | null>(null)
