import { useEffect, useRef, useState } from 'react'
import type { Selection } from '../domain/types'
import { useI18n } from '../i18n/useI18n'

export type PresenceEntry = {
  id: string
  name: string
  color: string
  avatarUrl?: string
  floorId?: string
  floorName?: string
  selection?: Selection | null
  presenting?: boolean
  isCurrentUser?: boolean
}

export type PresenceBarProps = {
  entries: PresenceEntry[]
  followingId?: string | null
  onFollow: (presenceId: string | null) => void
}

export function PresenceBar({ entries, followingId = null, onFollow }: PresenceBarProps) {
  const { t, formatNumber } = useI18n()
  const rootRef = useRef<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  const collaborators = entries.filter((entry) => !entry.isCurrentUser)
  const expandedWidth = Math.min(540, 10 + collaborators.length * 152)
  const expanded = open || hovered

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (collaborators.length === 0) return null
  const count = formatNumber(collaborators.length)
  return <section ref={rootRef} className={`presence-bar ${expanded ? 'is-open' : ''}`} style={{ width: expanded ? expandedWidth : 72 }} aria-label={t('shell.presence.people')} onPointerEnter={() => setHovered(true)} onPointerLeave={() => setHovered(false)}>
    {!expanded ? <button type="button" className="presence-trigger" aria-expanded="false" aria-controls="presence-members" aria-label={t(collaborators.length === 1 ? 'shell.presence.showOne' : 'shell.presence.showMany', { count })} onClick={() => setOpen(true)}>
      <span className="presence-avatars" aria-hidden="true">
        {collaborators.slice(0, 3).map((entry) => entry.avatarUrl ? <img key={entry.id} className={followingId === entry.id ? 'is-following' : ''} src={entry.avatarUrl} alt="" /> : <span key={entry.id} className={`presence-initials ${followingId === entry.id ? 'is-following' : ''}`} style={{ backgroundColor: entry.color }}>{initials(entry.name)}</span>)}
      </span>
      {collaborators.length > 3 ? <span className="presence-count" aria-hidden="true">+{formatNumber(collaborators.length - 3)}</span> : null}
    </button> : null}
    <div id="presence-members" className="presence-members" role="group" aria-label={t('shell.presence.connected')} aria-hidden={!expanded}>
      {collaborators.map((entry) => {
        const following = followingId === entry.id
        const location = entry.floorName ?? entry.floorId ?? t('shell.presence.structureView')
        const activity = entry.presenting ? t('shell.presence.presenting', { location }) : location
        const toggleFollow = () => onFollow(following ? null : entry.id)
        return <button key={entry.id} type="button" tabIndex={expanded ? 0 : -1} className={`presence-person ${following ? 'is-following' : ''}`} aria-pressed={following} aria-label={t(following ? 'shell.presence.stopFollowing' : 'shell.presence.follow', { name: entry.name, activity })} onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); event.stopPropagation(); toggleFollow() }} onClick={(event) => { if (event.detail === 0) toggleFollow() }}>
          {entry.avatarUrl ? <img src={entry.avatarUrl} alt="" /> : <span className="presence-initials" aria-hidden="true" style={{ backgroundColor: entry.color }}>{initials(entry.name)}</span>}
          <span><strong>{entry.name}</strong><small>{following ? t('shell.presence.following') : activity}</small></span>
        </button>
      })}
    </div>
  </section>
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase() ?? '').join('') || '?'
}
