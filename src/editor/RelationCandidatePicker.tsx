import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { FlowDirection } from '../domain/types'

export type RelationPreview = { relationId: string; direction: FlowDirection }

export type RelationCandidateOption = RelationPreview & {
  id: string
  label: string
}

export function RelationCandidatePicker({ label, options, onSelect, onPreview }: { label: string; options: RelationCandidateOption[]; onSelect: (option: RelationCandidateOption) => void; onPreview: (preview: RelationPreview | null) => void }) {
  const listId = useId()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  useLayoutEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])

  useEffect(() => () => onPreview(null), [onPreview])

  const previewAt = (index: number) => {
    const option = options[index]
    setActiveIndex(index)
    onPreview(option ? { relationId: option.relationId, direction: option.direction } : null)
  }
  const close = (restoreFocus = false) => {
    setOpen(false)
    onPreview(null)
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }
  const choose = (option: RelationCandidateOption) => {
    onSelect(option)
    close(true)
  }

  return <div className="relation-candidate-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) close() }}>
    <button ref={triggerRef} type="button" className="relation-candidate-trigger" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} disabled={options.length === 0} onClick={() => { if (open) close(); else { previewAt(0); setOpen(true) } }}>{label}<span aria-hidden="true">⌄</span></button>
    {open ? <div ref={listRef} id={listId} role="listbox" tabIndex={0} aria-label={label} aria-activedescendant={`${listId}-${activeIndex}`} className="relation-candidate-list" onKeyDown={(event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const offset = event.key === 'ArrowDown' ? 1 : -1
        previewAt((activeIndex + offset + options.length) % options.length)
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        const option = options[activeIndex]
        if (option) choose(option)
      } else if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close(true)
      }
    }}>
      {options.map((option, index) => <div key={option.id} id={`${listId}-${index}`} role="option" aria-selected={activeIndex === index} className={activeIndex === index ? 'is-active' : ''} onPointerEnter={() => previewAt(index)} onPointerLeave={() => onPreview(null)} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}>{option.label}</div>)}
    </div> : null}
  </div>
}
