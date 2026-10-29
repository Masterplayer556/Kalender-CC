import { describe, expect, it } from 'vitest'
import { fileIcon, formatSize, linkLabel, normalizeUrl, officeViewerUrl } from '../src/lib/files'
import { safeFileName } from '../src/data/api'

describe('Anhänge', () => {
  it('Symbol nach Dateityp', () => {
    expect(fileIcon('Lernziele.pdf')).toBe('📕')
    expect(fileIcon('Lernziele WW1.DOCX')).toBe('📝')
    expect(fileIcon('Vortrag.pptx')).toBe('📊')
    expect(fileIcon('IMG_0001.HEIC')).toBe('🖼️')
    expect(fileIcon('irgendwas', 'image/png')).toBe('🖼️')
    expect(fileIcon('archiv.zip')).toBe('📎')
  })

  it('Office-Dateien über den Office-Viewer', () => {
    const file = 'https://x.supabase.co/storage/v1/object/sign/attachments/a/b.docx?token=abc&x=1'
    expect(officeViewerUrl(file, 'Sentence List.DOCX', 32_678)).toBe(
      `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(file)}`,
    )
    expect(officeViewerUrl(file, 'Vortrag.pptx', null)).not.toBeNull()
    expect(officeViewerUrl(file, 'Lernziele.pdf', 1000)).toBeNull() // PDF öffnet direkt
    expect(officeViewerUrl(file, 'Foto.jpg', 1000)).toBeNull()
    expect(officeViewerUrl(file, 'Gross.docx', 11 * 1024 * 1024)).toBeNull() // über 10 MB
    expect(officeViewerUrl(file, 'Tabelle.xlsx', 6 * 1024 * 1024)).toBeNull() // Excel nur bis 5 MB
  })

  it('Grösse lesbar', () => {
    expect(formatSize(500)).toBe('500 B')
    expect(formatSize(1536)).toBe('1.5 KB')
    expect(formatSize(250 * 1024)).toBe('250 KB')
    expect(formatSize(2.5 * 1024 * 1024)).toBe('2.5 MB')
  })

  it('Links vervollständigen und prüfen', () => {
    expect(normalizeUrl('onedrive.live.com/abc')).toBe('https://onedrive.live.com/abc')
    expect(normalizeUrl('  https://www.icloud.com/x ')).toBe('https://www.icloud.com/x')
    expect(normalizeUrl('hallo')).toBeNull()
    expect(normalizeUrl('')).toBeNull()
    expect(linkLabel('https://www.youtube.com/watch?v=1')).toBe('youtube.com')
  })

  it('Dateinamen für den Speicher', () => {
    expect(safeFileName('Lernziele Erster Weltkrieg.docx')).toBe('Lernziele_Erster_Weltkrieg.docx')
    expect(safeFileName('Übung Français (1).pdf')).toBe('Ubung_Francais_1_.pdf')
    expect(safeFileName('???')).toBe('datei')
  })
})
