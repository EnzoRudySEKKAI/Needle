import type { Selection } from '../domain/types'

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
  const collaborators = entries.filter((entry) => !entry.isCurrentUser)
  if (collaborators.length === 0) return null
  return <section className="presence-bar" aria-label="People in this map">
    <div className="presence-avatars" role="list">
      {collaborators.map((entry) => {
        const following = followingId === entry.id
        const location = entry.floorName ?? entry.floorId ?? 'Structure view'
        const activity = entry.presenting ? `Presenting on ${location}` : `On ${location}`
        return <div key={entry.id} role="listitem" className={`${following ? 'is-following' : ''} ${entry.presenting ? 'is-presenting' : ''}`}>
          <button type="button" aria-pressed={following} aria-label={`${following ? 'Stop following' : 'Follow'} ${entry.name}. ${activity}.`} title={`${entry.name} - ${activity}`} onClick={() => onFollow(following ? null : entry.id)}>
            {entry.avatarUrl ? <img src={entry.avatarUrl} alt="" /> : <span className="presence-initials" aria-hidden="true" style={{ backgroundColor: entry.color }}>{initials(entry.name)}</span>}
            <span className="presence-name">{entry.name}</span>
            {entry.presenting ? <span className="presence-status">Presenting</span> : <span className="presence-status">{location}</span>}
          </button>
        </div>
      })}
    </div>
    {followingId ? <button type="button" className="presence-stop-following" onClick={() => onFollow(null)}>Stop following</button> : null}
  </section>
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase() ?? '').join('') || '?'
}
