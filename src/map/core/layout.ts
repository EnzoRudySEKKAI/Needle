import type { Archetype, BuildingSize, Footprint, OntologyNode, VisualNode } from '../../domain/types'
import { footprintsOverlap } from './iso'

export function deriveArchetype(node: OntologyNode): Archetype {
  if (node.archetypeOverride) return node.archetypeOverride
  return { xs: 'low-slab', s: 'cube', m: 'podium-tower', l: 'tower', xl: 'slab-stack' }[node.size] as Archetype
}

const SIZE_PROFILES: Record<BuildingSize, { footprint: number; height: number }> = {
  xs: { footprint: 0.68, height: 0.8 },
  s: { footprint: 0.84, height: 1.25 },
  m: { footprint: 1, height: 1.9 },
  l: { footprint: 1.22, height: 2.9 },
  xl: { footprint: 1.48, height: 4.2 },
}

const HEIGHT_FACTOR: Record<Archetype, number> = {
  cube: 1,
  tower: 1.35,
  'low-slab': 0.48,
  'slab-stack': 0.92,
  'fin-row': 0.72,
  'podium-tower': 1.15,
  'twin-towers': 1.25,
  courtyard: 0.68,
  bridge: 0.75,
  'stepped-pyramid': 0.9,
  'server-rack': 1.45,
  monitor: 0.78,
  camera: 0.68,
  database: 0.78,
}

export function deriveHeight(size: BuildingSize, archetype: Archetype): number {
  if (archetype === 'monitor') {
    const heights: Record<BuildingSize, number> = { xs: 1.02, s: 1.32, m: 1.68, l: 2.35, xl: 3.27 }
    return heights[size]
  }
  return SIZE_PROFILES[size].height * HEIGHT_FACTOR[archetype]
}

export function deriveSize(node: OntologyNode, archetype: Archetype): { w: number; d: number } {
  const base = archetype === 'fin-row' ? { w: Math.max(3, Math.min(7, node.properties.length + 1)), d: 2 }
    : archetype === 'slab-stack' ? { w: 3.5, d: 3 }
      : archetype === 'tower' ? { w: 2.2, d: 2.2 }
        : archetype === 'low-slab' ? { w: 3, d: 2 }
          : archetype === 'podium-tower' ? { w: 3.2, d: 2.8 }
            : archetype === 'twin-towers' ? { w: 3.5, d: 2.5 }
              : archetype === 'courtyard' ? { w: 3.5, d: 3.2 }
                : archetype === 'bridge' ? { w: 3.5, d: 2.4 }
                  : archetype === 'stepped-pyramid' ? { w: 3.5, d: 3.2 }
                    : archetype === 'server-rack' ? { w: 1.9, d: 2.1 }
                      : archetype === 'monitor' ? { w: 2.55, d: 1.75 }
                        : archetype === 'camera' ? { w: 2.1, d: 1.9 }
                        : archetype === 'database' ? { w: 2.0, d: 2.0 }
                          : { w: 2.6, d: 2.2 }
  const scale = SIZE_PROFILES[node.size].footprint
  return { w: base.w * scale, d: base.d * scale }
}

export function visualiseNodes(nodes: readonly OntologyNode[]): VisualNode[] {
  return nodes.map((node) => {
    const archetype = deriveArchetype(node)
    const size = deriveSize(node, archetype)
    return {
      ...node,
      archetype,
      height: deriveHeight(node.size, archetype),
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
