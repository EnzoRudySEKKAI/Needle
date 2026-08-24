import type { OntologyDocument } from '../../domain/types'
import { useI18n } from '../../i18n/useI18n'
import { FloorMiniPlan } from './FloorMiniPlan'

type Props = {
  document: OntologyDocument
  floorId: string
  width?: number
  height?: number
  showHeader?: boolean
  actionLabel?: string
  onAction?: () => void
}

export function FloorPreviewCard({ document, floorId, width = 320, height = 190, showHeader = true, actionLabel, onAction }: Props) {
  const { t, formatNumber } = useI18n()
  const floor = document.floors.find((candidate) => candidate.id === floorId)
  if (!floor) return null
  const index = document.floors.findIndex((candidate) => candidate.id === floorId)
  const count = document.nodes.filter((node) => node.floorId === floorId).length
  return (
    <div className="floor-preview-card" aria-live="polite">
      {showHeader ? (
        <div className="floor-preview-card-header">
          <span className="floor-preview-card-index">{t('shell.structure.floorIndex', { number: String(index + 1).padStart(2, '0') })}</span>
          <strong className="floor-preview-card-name">{floor.name}</strong>
          <span className="floor-preview-card-count">{t(count === 1 ? 'shell.structure.oneConcept' : 'shell.structure.manyConcepts', { count: formatNumber(count) })}</span>
        </div>
      ) : null}
      <div className="floor-preview-card-map">
        <FloorMiniPlan document={document} floorId={floorId} x={0} y={0} width={width} height={height} />
      </div>
      {actionLabel && onAction ? (
        <button type="button" className="floor-preview-card-action" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

export function useFloorMeta(document: OntologyDocument, floorId: string | null) {
  if (!floorId) return null
  const floor = document.floors.find((candidate) => candidate.id === floorId) ?? null
  if (!floor) return null
  const index = document.floors.findIndex((candidate) => candidate.id === floorId)
  const count = document.nodes.filter((node) => node.floorId === floorId).length
  return { floor, index, count }
}
