import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { FlowDirection } from '../domain/types'

export type RelationPreview = { relationId: string; direction: FlowDirection }

export type RelationCandidateOption = {
  relationId: string
  fromLabel: string
  toLabel: string
  label: string
}

export function RelationCandidatePicker({ label, options, onSelect, onPreview }: { label: string; options: RelationCandidateOption[]; onSelect: (selection: RelationPreview) => void; onPreview: (preview: RelationPreview | null) => void }) {
  const panelId = useId()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const choiceRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [directions, setDirections] = useState<Record<string, FlowDirection>>({})

  const directionAt = (index: number): FlowDirection => directions[options[index]?.relationId ?? ''] ?? 'forward'
  const previewAt = (index: number, direction = directionAt(index)) => {
    const option = options[index]
    setActiveIndex(index)
    onPreview(option ? { relationId: option.relationId, direction } : null)
  }
  const close = (restoreFocus = false) => {
    setOpen(false)
    onPreview(null)
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }
  const toggleDirection = (index: number) => {
    const option = options[index]
    if (!option) return
    const direction = directionAt(index) === 'forward' ? 'reverse' : 'forward'
    setDirections((current) => ({ ...current, [option.relationId]: direction }))
    previewAt(index, direction)
  }
  const moveTo = (index: number) => {
    const next = (index + options.length) % options.length
    previewAt(next)
    choiceRefs.current[next]?.focus()
  }
  const onRowKeyDown = (event: KeyboardEvent, index: number) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveTo(index + (event.key === 'ArrowDown' ? 1 : -1))
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      toggleDirection(index)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(true)
    }
  }

  useLayoutEffect(() => {
    if (open) choiceRefs.current[0]?.focus()
  }, [open])

  useEffect(() => () => onPreview(null), [onPreview])

  return <div className="relation-candidate-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) close() }}>
    <button ref={triggerRef} type="button" className="relation-candidate-trigger" aria-haspopup="dialog" aria-expanded={open} aria-controls={panelId} disabled={options.length === 0} onClick={() => {
      if (open) close()
      else {
        setDirections({})
        setActiveIndex(0)
        onPreview(options[0] ? { relationId: options[0].relationId, direction: 'forward' } : null)
        setOpen(true)
      }
    }}>{label}<span aria-hidden="true">⌄</span></button>
    {open ? <div id={panelId} role="dialog" aria-label={label} className="relation-candidate-list">
      {options.map((option, index) => {
        const direction = directionAt(index)
        const source = direction === 'forward' ? option.fromLabel : option.toLabel
        const target = direction === 'forward' ? option.toLabel : option.fromLabel
        return <div key={option.relationId} className={`relation-candidate-row ${activeIndex === index ? 'is-active' : ''}`} onPointerEnter={() => previewAt(index)} onPointerLeave={() => onPreview(null)}>
          <button ref={(element) => { choiceRefs.current[index] = element }} type="button" className="relation-candidate-choice" onFocus={() => previewAt(index)} onKeyDown={(event) => onRowKeyDown(event, index)} onClick={() => { onSelect({ relationId: option.relationId, direction }); close(true) }}><span>{source} <b aria-hidden="true">→</b> {target}</span><small>{option.label}</small></button>
          <button type="button" className="relation-candidate-direction" aria-label={`Reverse ${option.label}; currently ${source} to ${target}`} title="Reverse direction" onFocus={() => previewAt(index)} onKeyDown={(event) => onRowKeyDown(event, index)} onClick={() => toggleDirection(index)}>⇄</button>
        </div>
      })}
    </div> : null}
  </div>
}
