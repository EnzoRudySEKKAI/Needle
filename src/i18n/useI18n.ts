import { use } from 'react'
import { I18nContext, type I18nValue } from './context'

export function useI18n(): I18nValue {
  const context = use(I18nContext)
  if (!context) throw new Error('useI18n must be used within I18nProvider.')
  return context
}
