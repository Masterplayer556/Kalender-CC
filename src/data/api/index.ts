// Alle Zugriffe auf die Supabase-Datenbank an einem Ort (aufgeteilt nach Bereich).
// user_id wird nie mitgeschickt: Die Datenbank setzt sie automatisch (default auth.uid()),
// und die RLS-Regeln verhindern Zugriffe auf fremde Daten.

export * from './load'
export * from './entries'
export * from './attachments'
export * from './subjects'
export * from './grades'
export * from './periods'
export * from './prefs'
