function currentSvg(): SVGSVGElement {
  const svg = document.getElementById('ontology-map-svg')
  if (!(svg instanceof SVGSVGElement)) throw new Error('Map canvas is not available.')
  return svg
}

function serializedSvg(): { source: string; width: number; height: number } {
  const svg = currentSvg()
  const rect = svg.getBoundingClientRect()
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(rect.width))
  clone.setAttribute('height', String(rect.height))
  const styles = document.createElement('style')
  styles.textContent = [...document.styleSheets].flatMap((sheet) => {
    try { return [...sheet.cssRules].map((rule) => rule.cssText) } catch { return [] }
  }).join('\n')
  clone.prepend(styles)
  return { source: new XMLSerializer().serializeToString(clone), width: rect.width, height: rect.height }
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function exportSvg(filename: string) {
  const { source } = serializedSvg()
  download(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }), `${filename}.svg`)
}

async function renderPng(scale: number): Promise<Blob> {
  const { source, width, height } = serializedSvg()
  const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }))
  const image = new Image()
  image.src = url
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * scale)
  canvas.height = Math.round(height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas export is unavailable.')
  const surface = getComputedStyle(document.documentElement).getPropertyValue('--surface').trim() || '#ffffff'
  context.fillStyle = surface
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  URL.revokeObjectURL(url)
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('PNG encoding failed.')), 'image/png'))
}

export async function exportPng(filename: string, scale = 2) {
  download(await renderPng(scale), `${filename}.png`)
}

export async function exportPdf(filename: string) {
  const [{ jsPDF }, blob] = await Promise.all([import('jspdf'), renderPng(3)])
  const imageUrl = URL.createObjectURL(blob)
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
  URL.revokeObjectURL(imageUrl)
}
