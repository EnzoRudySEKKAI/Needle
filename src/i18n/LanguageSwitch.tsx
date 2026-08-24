import { useI18n } from './useI18n'

export function LanguageSwitch({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useI18n()
  return <div className={`language-switch ${className}`} role="group" aria-label={t('language.label')}>
    <button type="button" className={locale === 'en' ? 'is-active' : ''} aria-pressed={locale === 'en'} aria-label={t('language.english')} onClick={() => setLocale('en')}>ENG</button>
    <button type="button" className={locale === 'zh-CN' ? 'is-active' : ''} aria-pressed={locale === 'zh-CN'} aria-label={t('language.chinese')} onClick={() => setLocale('zh-CN')}>中文</button>
  </div>
}
