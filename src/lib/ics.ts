// Platz für einen späteren Export in den Apple-Kalender (.ics-Datei).
//
// So könnte man ihn ergänzen, ohne den Rest der App umzubauen:
// 1. Eine Funktion `toIcs(entries, blocks, subjects): string` schreiben, die pro Eintrag
//    und pro Lernzeit einen "BEGIN:VEVENT … END:VEVENT"-Abschnitt erzeugt.
//    - Ganztägige Einträge: DTSTART;VALUE=DATE:20261020
//    - Einträge mit Uhrzeit / Lernzeiten: DTSTART:20261020T150000Z (UTC, aus localToIso())
//    - UID: die id aus der Datenbank + "@kalender-tracker" (damit Updates erkannt werden)
// 2. Einen Knopf "Exportieren" einbauen, der den Text als Datei herunterlädt:
//    new Blob([text], { type: 'text/calendar' }) + URL.createObjectURL(...)
//
// Alle nötigen Daten liefert bereits useData() aus src/data/DataProvider.tsx.
export {}
