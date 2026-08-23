import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react'

export type ShortcutHelpProps = { open: boolean; onClose: () => void }

const SHORTCUTS: { keys: ReactNode; label: string }[] = [
  { keys: <><kbd>Cmd</kbd><span>+</span><kbd>K</kbd></>, label: 'Open command palette' },
  { keys: <><kbd>Cmd</kbd><span>+</span><kbd>Z</kbd></>, label: 'Undo' },
  { keys: <><kbd>Shift</kbd><span>+</span><kbd>Cmd</kbd><span>+</span><kbd>Z</kbd></>, label: 'Redo' },
  { keys: <kbd>Delete</kbd>, label: 'Delete selection' },
  { keys: <kbd>Space</kbd>, label: 'Play or pause the active scenario' },
  { keys: <><kbd>Left</kbd><span>/</span><kbd>Right</kbd></>, label: 'Previous or next step in presentation' },
  { keys: <kbd>[</kbd>, label: 'Toggle left rail' },
  { keys: <kbd>]</kbd>, label: 'Toggle inspector' },
  { keys: <kbd>H</kbd>, label: 'Toggle header' },
  { keys: <kbd>?</kbd>, label: 'Open keyboard shortcut help' },
  { keys: <><kbd>Alt</kbd><span>+</span><kbd>Up</kbd><span>/</span><kbd>Down</kbd></>, label: 'Move between floors' },
  { keys: <><kbd>Alt</kbd><span>+</span><kbd>Home</kbd><span>/</span><kbd>End</kbd></>, label: 'Go to first or last floor' },
]

export function ShortcutHelp({ open, onClose }: ShortcutHelpProps) {
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
      <div className="dialog-heading"><h2 id={titleId}>Keyboard shortcuts</h2><button ref={closeRef} type="button" onClick={onClose} aria-label="Close keyboard shortcuts">x</button></div>
      <dl>{SHORTCUTS.map((shortcut, index) => <div key={index}><dt>{shortcut.keys}</dt><dd>{shortcut.label}</dd></div>)}</dl>
      <p>Floor navigation shortcuts are ignored while typing in a field.</p>
    </section>
  </div>
}
