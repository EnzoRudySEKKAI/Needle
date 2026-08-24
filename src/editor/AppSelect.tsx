import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../i18n/useI18n'

export type AppSelectOption = {
  value: string
  label: string
  group?: string
  disabled?: boolean
}

type AppSelectProps = {
  value: string
  options: AppSelectOption[]
  onChange: (value: string) => void
  ariaLabel: string
  disabled?: boolean
  className?: string
  compact?: boolean
}

export function AppSelect({ value, options, onChange, ariaLabel, disabled = false, className = '', compact = false }: AppSelectProps) {
  const { t } = useI18n()
  const listId = useId()
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])
  const initialFocusIndex = useRef(0)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [panelStyle, setPanelStyle] = useState({ left: 0, top: 0, width: 0, maxHeight: 240, opensUp: false })
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value && !option.disabled))
  const selected = options.find((option) => option.value === value)
  const compactMenuWidth = compact ? Math.min(180, Math.max(104, ...options.map((option) => option.label.length * 6.5 + 48))) : 0

  const close = (restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus())
  }
  const enabledIndex = (start: number, direction: 1 | -1) => {
    if (options.length === 0) return -1
    for (let offset = 0; offset < options.length; offset += 1) {
      const index = (start + offset * direction + options.length) % options.length
      if (!options[index]?.disabled) return index
    }
    return -1
  }
  const move = (start: number, direction: 1 | -1) => {
    const index = enabledIndex(start, direction)
    if (index < 0) return
    setActiveIndex(index)
    optionRefs.current[index]?.focus()
  }
  const choose = (index: number) => {
    const option = options[index]
    if (!option || option.disabled) return
    onChange(option.value)
    close(true)
  }
  const openMenu = (direction: 1 | -1 = 1) => {
    if (disabled || options.length === 0) return
    const index = enabledIndex(selectedIndex, direction)
    initialFocusIndex.current = index
    setActiveIndex(index)
    setOpen(true)
  }
  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openMenu(event.key === 'ArrowDown' ? 1 : -1)
    }
  }
  const onOptionKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      move(index + (event.key === 'ArrowDown' ? 1 : -1), event.key === 'ArrowDown' ? 1 : -1)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      move(event.key === 'Home' ? 0 : options.length - 1, event.key === 'Home' ? 1 : -1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(index)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close(true)
    } else if (event.key === 'Tab') {
      event.preventDefault()
      close(true)
    }
  }

  useLayoutEffect(() => {
    if (!open) return
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const gap = 7
      const edge = 10
      const width = Math.min(Math.max(rect.width, compactMenuWidth), window.innerWidth - edge * 2)
      const spaceBelow = window.innerHeight - rect.bottom - gap - edge
      const spaceAbove = rect.top - gap - edge
      const opensUp = spaceBelow < 180 && spaceAbove > spaceBelow
      setPanelStyle({
        left: Math.max(edge, Math.min(rect.left, window.innerWidth - width - edge)),
        top: opensUp ? rect.top - gap : rect.bottom + gap,
        width,
        maxHeight: Math.max(120, Math.min(280, (opensUp ? spaceAbove : spaceBelow))),
        opensUp,
      })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [compactMenuWidth, open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) close()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    const frame = requestAnimationFrame(() => optionRefs.current[initialFocusIndex.current]?.focus())
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [open])

  const panel = open ? <div ref={panelRef} id={listId} role="listbox" aria-label={ariaLabel} className={`app-select-menu ${panelStyle.opensUp ? 'opens-up' : ''}`} style={{ left: panelStyle.left, top: panelStyle.top, width: panelStyle.width, maxHeight: panelStyle.maxHeight }}>
    {options.map((option, index) => {
      const showGroup = option.group && options[index - 1]?.group !== option.group
      return <div key={`${option.group ?? ''}:${option.value}`} className="app-select-option-wrap">
        {showGroup ? <span className="app-select-group">{option.group}</span> : null}
        <button ref={(element) => { optionRefs.current[index] = element }} type="button" role="option" aria-selected={option.value === value} disabled={option.disabled} className={`app-select-option ${option.value === value ? 'is-selected' : ''} ${activeIndex === index ? 'is-active' : ''}`} onFocus={() => setActiveIndex(index)} onPointerMove={() => setActiveIndex(index)} onKeyDown={(event) => onOptionKeyDown(event, index)} onClick={() => choose(index)}><span>{option.label}</span>{option.value === value ? <b aria-hidden="true">✓</b> : null}</button>
      </div>
    })}
  </div> : null

  return <div className={`app-select ${compact ? 'is-compact' : ''} ${open ? 'is-open' : ''} ${className}`}>
    <button ref={triggerRef} type="button" className="app-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} disabled={disabled || options.length === 0} onKeyDown={onTriggerKeyDown} onClick={() => open ? close() : openMenu()}><span>{selected?.label ?? t('common.choose')}</span><i aria-hidden="true" /></button>
    {panel ? createPortal(panel, document.body) : null}
  </div>
}

export function SelectField(props: AppSelectProps & { label: string }) {
  const { label, ...selectProps } = props
  return <div className="field app-select-field"><span>{label}</span><AppSelect {...selectProps} /></div>
}
