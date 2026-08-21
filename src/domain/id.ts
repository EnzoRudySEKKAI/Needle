export function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

export function codeFromName(name: string, used: ReadonlySet<string>): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const base = (words.length > 1 ? words.map((word) => word[0]).join('') : name.slice(0, 2))
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 3)
    .toUpperCase() || 'ND'
  if (!used.has(base)) return base
  for (let i = 2; i < 100; i += 1) {
    const candidate = `${base.slice(0, 2)}${i}`
    if (!used.has(candidate)) return candidate
  }
  return base
}
