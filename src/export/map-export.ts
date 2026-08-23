import type { OntologyDocument } from '../domain/types'

export type ExportBackground = 'current' | 'white' | 'transparent'
export type ExportTheme = 'current' | 'light' | 'dark'

function currentSvg(): SVGSVGElement {
  const svg = document.getElementById('ontology-map-svg')
  if (!(svg instanceof SVGSVGElement)) throw new Error('Map canvas is not available.')
  return svg
}

function themeVariables(theme: ExportTheme): Record<string, string> {
  const previous = document.documentElement.dataset.theme
  if (theme === 'dark') document.documentElement.dataset.theme = 'dark'
  if (theme === 'light') delete document.documentElement.dataset.theme
  const computed = getComputedStyle(document.documentElement)
  const variables: Record<string, string> = {}
  for (let index = 0; index < computed.length; index += 1) {
    const property = computed.item(index)
    if (property.startsWith('--')) variables[property] = computed.getPropertyValue(property).trim()
  }
  if (previous) document.documentElement.dataset.theme = previous
  else delete document.documentElement.dataset.theme
  return variables
}

function serializedSvg(theme: ExportTheme = 'current', background: ExportBackground = 'current'): { source: string; width: number; height: number; backgroundColor: string | null } {
  const svg = currentSvg()
  const rect = svg.getBoundingClientRect()
  const clone = svg.cloneNode(true) as SVGSVGElement
  const variables = themeVariables(theme)
  const surface = variables['--surface'] || '#ffffff'
  const backgroundColor = background === 'transparent' ? null : background === 'white' ? '#ffffff' : surface
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(rect.width))
  clone.setAttribute('height', String(rect.height))
  Object.entries(variables).forEach(([property, value]) => clone.style.setProperty(property, value))
  const styles = document.createElement('style')
  styles.textContent = [...document.styleSheets].flatMap((sheet) => {
    try { return [...sheet.cssRules].map((rule) => rule.cssText) } catch { return [] }
  }).join('\n')
  clone.prepend(styles)
  if (backgroundColor) {
    const backdrop = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    backdrop.setAttribute('width', '100%')
    backdrop.setAttribute('height', '100%')
    backdrop.setAttribute('fill', backgroundColor)
    styles.after(backdrop)
  }
  return { source: new XMLSerializer().serializeToString(clone), width: rect.width, height: rect.height, backgroundColor }
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function exportSvg(filename: string, theme: ExportTheme = 'current', background: ExportBackground = 'current') {
  const { source } = serializedSvg(theme, background)
  download(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }), `${filename}.svg`)
}

async function renderPng(scale: number, theme: ExportTheme, background: ExportBackground): Promise<Blob> {
  const { source, width, height, backgroundColor } = serializedSvg(theme, background)
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }))
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas export is unavailable.')
    if (backgroundColor) {
      context.fillStyle = backgroundColor
      context.fillRect(0, 0, canvas.width, canvas.height)
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return await new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG encoding failed.')), 'image/png'))
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function exportPng(filename: string, scale = 2, theme: ExportTheme = 'current', background: ExportBackground = 'current') {
  download(await renderPng(scale, theme, background), `${filename}.png`)
}

export async function exportPdf(filename: string, scale = 3, theme: ExportTheme = 'current', background: ExportBackground = 'current') {
  const [{ jsPDF }, blob] = await Promise.all([import('jspdf'), renderPng(scale, theme, background)])
  const imageUrl = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = imageUrl
    await image.decode()
    const landscape = image.width >= image.height
    const pdf = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'pt', format: 'a4', compress: true })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const ratio = Math.min((pageWidth - 40) / image.width, (pageHeight - 40) / image.height)
    const width = image.width * ratio
    const height = image.height * ratio
    pdf.addImage(image, 'PNG', (pageWidth - width) / 2, (pageHeight - height) / 2, width, height, undefined, 'FAST')
    pdf.save(`${filename}.pdf`)
  } finally {
    URL.revokeObjectURL(imageUrl)
  }
}

function scopedDocument(source: OntologyDocument, activeFloorId?: string): OntologyDocument {
  if (!activeFloorId) return source
  const nodes = source.nodes.filter((node) => node.floorId === activeFloorId)
  const nodeIds = new Set(nodes.map((node) => node.id))
  const groupIds = new Set(nodes.map((node) => node.groupId))
  const relations = source.relations.filter((relation) => nodeIds.has(relation.from) && nodeIds.has(relation.to))
  const relationIds = new Set(relations.map((relation) => relation.id))
  const flows = source.flows.map((flow) => ({
    ...flow,
    stages: flow.stages.map((stage) => ({ ...stage, traversals: stage.traversals.filter((traversal) => relationIds.has(traversal.relationId)) })).filter((stage) => stage.traversals.length > 0),
  })).filter((flow) => flow.stages.length > 0)
  return {
    ...source,
    floors: source.floors.filter((floor) => floor.id === activeFloorId),
    groups: source.groups.filter((group) => groupIds.has(group.id)),
    nodes,
    relations,
    flows,
  }
}

function csvCell(value: unknown): string {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function csv(rows: unknown[][]): Blob {
  return new Blob([`\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`], { type: 'text/csv;charset=utf-8' })
}

export function exportJson(source: OntologyDocument, filename: string, activeFloorId?: string) {
  download(new Blob([`${JSON.stringify(scopedDocument(source, activeFloorId), null, 2)}\n`], { type: 'application/json;charset=utf-8' }), `${filename}.json`)
}

export function exportNodeCsv(source: OntologyDocument, filename: string, activeFloorId?: string) {
  const value = scopedDocument(source, activeFloorId)
  const floors = new Map(value.floors.map((floor) => [floor.id, floor.name]))
  const groups = new Map(value.groups.map((group) => [group.id, group.name]))
  const rows: unknown[][] = [['id', 'code', 'name', 'floor_id', 'floor', 'neighborhood_id', 'neighborhood', 'size', 'what_it_does', 'how_its_built', 'properties']]
  value.nodes.forEach((node) => rows.push([node.id, node.code, node.name, node.floorId, floors.get(node.floorId), node.groupId, groups.get(node.groupId), node.size, node.whatItDoes, node.howItsBuilt, node.properties.map((property) => `${property.key}=${property.value}`).join('; ')]))
  download(csv(rows), `${filename}-nodes.csv`)
}

export function exportRelationCsv(source: OntologyDocument, filename: string, activeFloorId?: string) {
  const value = scopedDocument(source, activeFloorId)
  const nodes = new Map(value.nodes.map((node) => [node.id, node.name]))
  const rows: unknown[][] = [['id', 'from_id', 'from', 'to_id', 'to', 'kind', 'label']]
  value.relations.forEach((relation) => rows.push([relation.id, relation.from, nodes.get(relation.from), relation.to, nodes.get(relation.to), relation.kind, relation.label]))
  download(csv(rows), `${filename}-relations.csv`)
}

function mermaidId(id: string): string {
  return `n_${[...id].map((character) => character.codePointAt(0)?.toString(16)).join('_')}`
}

function mermaidText(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', ' ')
}

export function exportMermaid(source: OntologyDocument, filename: string, activeFloorId?: string) {
  const value = scopedDocument(source, activeFloorId)
  const lines = ['flowchart LR']
  value.floors.forEach((floor) => {
    lines.push(`  subgraph floor_${mermaidId(floor.id)}["${mermaidText(floor.name)}"]`)
    value.nodes.filter((node) => node.floorId === floor.id).forEach((node) => lines.push(`    ${mermaidId(node.id)}["${mermaidText(node.name)}"]`))
    lines.push('  end')
  })
  value.relations.forEach((relation) => {
    const arrow = relation.kind === 'dotted' ? '-.->' : '-->'
    lines.push(`  ${mermaidId(relation.from)} ${arrow}|"${mermaidText(relation.label || relation.kind)}"| ${mermaidId(relation.to)}`)
  })
  download(new Blob([`${lines.join('\n')}\n`], { type: 'text/plain;charset=utf-8' }), `${filename}.mmd`)
}

export async function exportAllFloorsPdf(source: OntologyDocument, filename: string) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true })
  const margin = 44
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const nodeById = new Map(source.nodes.map((node) => [node.id, node]))
  let pageStarted = false
  let y = margin

  const newPage = () => {
    if (pageStarted) pdf.addPage()
    pageStarted = true
    y = margin
  }
  const write = (text: string, size = 10, indent = 0, gap = 5) => {
    pdf.setFontSize(size)
    const lines = pdf.splitTextToSize(text || '-', pageWidth - (margin * 2) - indent) as string[]
    const lineHeight = size * 1.3
    if (y + (lines.length * lineHeight) > pageHeight - margin) newPage()
    pdf.text(lines, margin + indent, y)
    y += (lines.length * lineHeight) + gap
  }

  source.floors.forEach((floor, floorIndex) => {
    newPage()
    write(source.name, 9, 0, 8)
    write(`${floorIndex + 1}. ${floor.name}`, 22, 0, 7)
    write(`${source.version} | ${source.structureType} | ${source.nodes.filter((node) => node.floorId === floor.id).length} concepts`, 9, 0, 18)
    const floorNodes = source.nodes.filter((node) => node.floorId === floor.id)
    const groupIds = new Set(floorNodes.map((node) => node.groupId))
    write('NEIGHBORHOODS AND CONCEPTS', 10, 0, 10)
    source.groups.filter((group) => groupIds.has(group.id)).forEach((group) => {
      write(group.name, 13, 0, 3)
      if (group.description) write(group.description, 9, 0, 6)
      floorNodes.filter((node) => node.groupId === group.id).forEach((node) => write(`${node.code ? `${node.code} - ` : ''}${node.name}: ${node.whatItDoes || 'No description.'}`, 9, 12, 4))
      y += 5
    })
    write('RELATIONS', 10, 0, 10)
    const relations = source.relations.filter((relation) => nodeById.get(relation.from)?.floorId === floor.id || nodeById.get(relation.to)?.floorId === floor.id)
    if (relations.length === 0) write('No relations touch this floor.', 9, 12, 4)
    relations.forEach((relation) => write(`${nodeById.get(relation.from)?.name ?? relation.from} -> ${nodeById.get(relation.to)?.name ?? relation.to} [${relation.kind}]${relation.label ? `: ${relation.label}` : ''}`, 9, 12, 4))
  })
  pdf.setProperties({ title: `${source.name} - all floors`, subject: source.description, creator: 'Needle' })
  pdf.save(`${filename}.pdf`)
}
