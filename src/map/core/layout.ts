import type { Archetype, Footprint, OntologyNode, VisualNode } from '../../domain/types'
import { footprintsOverlap } from './iso'

export function deriveArchetype(node: OntologyNode): Archetype {
  if (node.archetypeOverride) return node.archetypeOverride
  if (node.metric <= 8) return 'low-slab'
  if (node.properties.length >= 4) return 'fin-row'
  if (node.metric >= 160) return 'slab-stack'
  if (node.metric >= 80 && node.properties.length <= 2) return 'tower'
  return 'cube'
}

export function deriveHeight(metric: number, archetype: Archetype): number {
  if (archetype === 'low-slab') return 0.65
  const steps = Math.log2(Math.max(0, metric) / 12 + 1) * 1.3
  return Math.max(1.2, Math.min(6, Math.round(steps * 2) / 2))
}

export function deriveSize(node: OntologyNode, archetype: Archetype): { w: number; d: number } {
  if (archetype === 'fin-row') return { w: Math.max(3, Math.min(7, node.properties.length + 1)), d: 2 }
  if (archetype === 'slab-stack') return { w: 3.5, d: 3 }
  if (archetype === 'tower') return { w: 2.2, d: 2.2 }
  if (archetype === 'low-slab') return { w: 3, d: 2 }
  if (archetype === 'podium-tower') return { w: 3.2, d: 2.8 }
  if (archetype === 'twin-towers') return { w: 3.5, d: 2.5 }
  if (archetype === 'courtyard') return { w: 3.5, d: 3.2 }
  if (archetype === 'bridge') return { w: 3.5, d: 2.4 }
  if (archetype === 'stepped-pyramid') return { w: 3.5, d: 3.2 }
  return node.metric > 50 ? { w: 3, d: 2 } : { w: 2.2, d: 2 }
}

export function visualiseNodes(nodes: readonly OntologyNode[]): VisualNode[] {
  return nodes.map((node) => {
    const archetype = deriveArchetype(node)
    const size = deriveSize(node, archetype)
    return {
      ...node,
      archetype,
      height: deriveHeight(node.metric, archetype),
      footprint: { ...node.position, ...size },
    }
  })
}

export function nextFreePosition(nodes: readonly OntologyNode[], groupId: string): { gx: number; gy: number } {
  const visuals = visualiseNodes(nodes)
  const members = visuals.filter((node) => node.groupId === groupId)
  if (members.length === 0) {
    const rightmost = visuals.reduce((max, node) => Math.max(max, node.footprint.gx + node.footprint.w), -4)
    return { gx: rightmost + 6, gy: 0 }
  }
  const baseX = Math.min(...members.map((node) => node.footprint.gx))
  const baseY = Math.min(...members.map((node) => node.footprint.gy))
  const candidate: Footprint = { gx: baseX, gy: baseY, w: 2.2, d: 2 }
  for (let row = 0; row < 12; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      candidate.gx = baseX + column * 4.5
      candidate.gy = baseY + row * 4
      if (!visuals.some((node) => footprintsOverlap(candidate, node.footprint, 0.8))) return { gx: candidate.gx, gy: candidate.gy }
    }
  }
  return { gx: baseX, gy: baseY + 52 }
}
