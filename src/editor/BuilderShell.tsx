import { useEffect, useState } from 'react'
import { IsoCanvas } from '../map/components/IsoCanvas'
import { toggleFlow } from '../map/stores/flow-clock'
import { Inspector } from './Inspector'
import { LeftRail } from './LeftRail'
import { MapHeader } from './MapHeader'
import { useDocumentStore } from './document-store'

export function BuilderShell({ presentation = false, onExport }: { presentation?: boolean; onExport?: () => void }) {
  const { document, selection, setSelection, commit } = useDocumentStore()
  const [editable, setEditable] = useState(!presentation)
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSelection(null); setActiveFlowId(null) }
      const target = event.target as HTMLElement | null
      const typing = target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')
      if (event.key === ' ' && activeFlowId && !typing) { event.preventDefault(); toggleFlow() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeFlowId, setSelection])

  return <div className={`map-app ${editable ? 'is-editing' : 'is-presenting'}`}>
    <MapHeader activeFlowId={activeFlowId} editable={editable} onEditable={presentation ? undefined : setEditable} onExport={onExport} />
    <main className="map-workspace">
      <LeftRail activeFlowId={activeFlowId} onActiveFlow={setActiveFlowId} editable={editable} />
      <section className="stage-column">
        <IsoCanvas document={document} selection={selection} activeFlowId={activeFlowId} editable={editable} onSelect={setSelection} onMoveNode={(id, gx, gy) => commit((current) => ({ ...current, nodes: current.nodes.map((node) => node.id === id ? { ...node, position: { gx, gy } } : node) }))} />
        <footer className="map-footer"><span className="legend-key flow-key" /> flow <span className="legend-key support-key" /> support <span className="legend-key retry-key" /> retry <span className="payload-key" /> payload <b>{editable ? 'drag buildings · scroll to zoom · drag ground to pan' : 'choose a scenario · space plays · scroll to zoom'}</b></footer>
      </section>
      <Inspector editable={editable} onActiveFlow={setActiveFlowId} />
    </main>
  </div>
}
