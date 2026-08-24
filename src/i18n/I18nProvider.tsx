import { useEffect, useState, type ReactNode } from 'react'
import { I18nContext, type TranslationValues } from './context'
import { applyLocale, persistLocale, type Locale } from './locale'
import { messages, type MessageKey } from './messages'

function interpolate(message: string, values?: TranslationValues): string {
  if (!values) return message
  return message.replace(/\{(\w+)\}/g, (match, key: string) => values[key] === undefined ? match : String(values[key]))
}

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState(initialLocale)

  useEffect(() => { applyLocale(locale) }, [locale])

  const setLocale = (nextLocale: Locale) => {
    setLocaleState(nextLocale)
    persistLocale(nextLocale)
  }
  const t = (key: MessageKey, values?: TranslationValues) => interpolate(messages[locale][key], values)
  const formatDate = (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, options).format(new Date(value))
  const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => new Intl.NumberFormat(locale, options).format(value)

  return <I18nContext value={{ locale, setLocale, t, formatDate, formatNumber }}>{children}</I18nContext>
}
