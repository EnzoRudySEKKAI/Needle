import '@fontsource-variable/inter'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { I18nProvider } from './i18n/I18nProvider'
import { applyLocale, detectLocale } from './i18n/locale'
import './styles/app.css'

const savedTheme = localStorage.getItem('needle:theme')
if (savedTheme === 'dark' || (!savedTheme && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.dataset.theme = 'dark'
const initialLocale = detectLocale()
applyLocale(initialLocale)

createRoot(document.getElementById('root')!).render(<StrictMode><I18nProvider initialLocale={initialLocale}><App /></I18nProvider></StrictMode>)
