// Hilfen für Anhänge: Symbol je Dateityp, Grösse lesbar, Links prüfen.

/** Grenze des Supabase-Speichers (siehe 003_links_and_files.sql) */
export const MAX_FILE_SIZE = 50 * 1024 * 1024

/** Passendes Symbol nach Dateiname bzw. MIME-Typ */
export function fileIcon(name: string, mime?: string | null): string {
  const ext = name.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf' || mime === 'application/pdf') return '📕'
  if (['doc', 'docx', 'odt', 'pages', 'rtf', 'txt'].includes(ext)) return '📝'
  if (['ppt', 'pptx', 'odp', 'key'].includes(ext)) return '📊'
  if (['xls', 'xlsx', 'ods', 'numbers', 'csv'].includes(ext)) return '📈'
  if (mime?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'heic', 'gif', 'webp'].includes(ext)) return '🖼️'
  if (mime?.startsWith('audio/') || ['mp3', 'm4a', 'wav'].includes(ext)) return '🎧'
  if (mime?.startsWith('video/') || ['mp4', 'mov'].includes(ext)) return '🎬'
  return '📎'
}

/** 1536 → "1.5 KB", 2_400_000 → "2.3 MB" */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * Eingegebenen Link prüfen und vervollständigen: "onedrive.live.com/x" → "https://onedrive.live.com/x".
 * Gibt null zurück, wenn es kein gültiger Link ist.
 */
export function normalizeUrl(input: string): string | null {
  const text = input.trim()
  if (!text) return null
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`
  try {
    const url = new URL(withScheme)
    return url.hostname.includes('.') ? url.href : null
  } catch {
    return null
  }
}

/** Anzeigename für einen Link ohne eigenen Namen: "docs.google.com" statt der ganzen Adresse */
export function linkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
