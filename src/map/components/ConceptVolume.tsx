import { memo } from 'react'
import type { VisualNode } from '../../domain/types'
import { buildingFaces } from '../core/archetypes'
import { pointsAttribute } from '../core/iso'

function ConceptVolumeInner({ node, className = '' }: { node: VisualNode; className?: string }) {
  const faces = buildingFaces(node.archetype, node.footprint, node.height, node.properties.length)
  return <g className={`concept-volume ${className}`}>{faces.map((face, index) => <polygon key={index} points={pointsAttribute(face.points)} className={`building-face face-${face.shade} ${node.faceTexture === 'hatched' || (node.faceTexture === 'auto' && face.hatch) ? 'is-hatched' : ''}`} vectorEffect="non-scaling-stroke" />)}</g>
}

export const ConceptVolume = memo(ConceptVolumeInner)
