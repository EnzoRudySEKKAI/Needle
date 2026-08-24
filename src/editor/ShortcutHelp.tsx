import { useEffect, useId, useRef, type KeyboardEvent } from 'react'
import { useI18n } from '../i18n/useI18n'

export type ShortcutHelpProps = { open: boolean; onClose: () => void }

export function ShortcutHelp({ open, onClose }: ShortcutHelpProps) {
  const { t } = useI18n()
  const titleId = useId()
  const dialogRef = useRef<HTMLElement | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    requestAnimationFrame(() => closeRef.current?.focus())
    return () => previouslyFocused?.focus()
  }, [open])

  if (!open) return null

  const shortcuts = [
    { keys: <><kbd>{t('tools.shortcuts.key.command')}</kbd><span>+</span><kbd>K</kbd></>, label: t('tools.shortcuts.openPalette') },
    { keys: <><kbd>{t('tools.shortcuts.key.command')}</kbd><span>+</span><kbd>Z</kbd></>, label: t('tools.shortcuts.undo') },
    { keys: <><kbd>{t('tools.shortcuts.key.shift')}</kbd><span>+</span><kbd>{t('tools.shortcuts.key.command')}</kbd><span>+</span><kbd>Z</kbd></>, label: t('tools.shortcuts.redo') },
    { keys: <kbd>{t('tools.shortcuts.key.delete')}</kbd>, label: t('tools.shortcuts.deleteSelection') },
    { keys: <kbd>{t('tools.shortcuts.key.space')}</kbd>, label: t('tools.shortcuts.playPause') },
    { keys: <><kbd>{t('tools.shortcuts.key.left')}</kbd><span>/</span><kbd>{t('tools.shortcuts.key.right')}</kbd></>, label: t('tools.shortcuts.previousNext') },
    { keys: <kbd>[</kbd>, label: t('tools.shortcuts.toggleLeftRail') },
    { keys: <kbd>]</kbd>, label: t('tools.shortcuts.toggleInspector') },
    { keys: <kbd>H</kbd>, label: t('tools.shortcuts.toggleHeader') },
    { keys: <kbd>?</kbd>, label: t('tools.shortcuts.openHelp') },
    { keys: <><kbd>{t('tools.shortcuts.key.alt')}</kbd><span>+</span><kbd>{t('tools.shortcuts.key.up')}</kbd><span>/</span><kbd>{t('tools.shortcuts.key.down')}</kbd></>, label: t('tools.shortcuts.moveFloors') },
    { keys: <><kbd>{t('tools.shortcuts.key.alt')}</kbd><span>+</span><kbd>{t('tools.shortcuts.key.home')}</kbd><span>/</span><kbd>{t('tools.shortcuts.key.end')}</kbd></>, label: t('tools.shortcuts.firstLastFloor') },
  ]

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
    if (event.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])')
    if (!focusable?.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }

  return <div className="dialog-backdrop shortcut-help-backdrop" role="presentation" onMouseDown={onClose}>
    <section ref={dialogRef} className="shortcut-help" role="dialog" aria-modal="true" aria-labelledby={titleId} onMouseDown={(event) => event.stopPropagation()} onKeyDown={onKeyDown}>
      <div className="dialog-heading"><h2 id={titleId}>{t('tools.shortcuts.title')}</h2><button ref={closeRef} type="button" onClick={onClose} aria-label={t('tools.shortcuts.closeAria')}>x</button></div>
      <dl>{shortcuts.map((shortcut, index) => <div key={index}><dt>{shortcut.keys}</dt><dd>{shortcut.label}</dd></div>)}</dl>
      <p>{t('tools.shortcuts.typingNote')}</p>
    </section>
  </div>
}
