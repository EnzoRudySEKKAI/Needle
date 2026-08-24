import { enCommon, zhCommon } from './common'
import { enContent, zhContent } from './content'
import { enHome, zhHome } from './home'
import { enShell, zhShell } from './shell'
import { enTools, zhTools } from './tools'

export const englishMessages = { ...enCommon, ...enHome, ...enShell, ...enContent, ...enTools }
export type MessageKey = keyof typeof englishMessages

export const messages: Record<'en' | 'zh-CN', Record<MessageKey, string>> = {
  en: englishMessages,
  'zh-CN': { ...zhCommon, ...zhHome, ...zhShell, ...zhContent, ...zhTools },
}
