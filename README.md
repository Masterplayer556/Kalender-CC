# 📅 Kalender-Tracker

Eine Kalender-App für **Tests, Aufgaben und Lernzeiten**. Sie läuft im Browser am Computer und als App auf dem iPad, und beide Geräte zeigen dieselben Einträge an.

## Was die App kann

- **Einträge** anlegen, bearbeiten und löschen: Titel, Kategorie (📝 Test / ✅ Aufgabe / 🎉 Event / 📌 Sonstiges), Fach, Datum, optional eine Uhrzeit, Notizen und ein Haken „erledigt“
- **Lernzeiten** pro Eintrag, beliebig viele (z. B. Mo 17–20 Uhr, Mi 16–18 Uhr). Sie erscheinen als gestreifte Blöcke „Lernen: …“ im Kalender.
- **Fächer** mit eigener Farbe (über das Etikett-Symbol oben rechts)
- **Events** (🎉) für Konzerte, Geburtstage, Schulanlässe … Ohne Fach sind sie pink, und vergangene Events gelten nie als „überfällig“.
- **Ferien & freie Tage** (Etikett-Symbol oben rechts → „Ferien & freie Tage“): Zeiträume von–bis als 🏖️ Ferien, 🎈 Schulfrei oder 🎒 Lager & Reisen. Sie erscheinen als farbiges Band im Monat und oben in Woche/Tag. Die Heute-Übersicht zeigt einen Countdown bis zu den nächsten Ferien mit den verbleibenden Schultagen.
- **Ansichten:**
  - Monat (Woche beginnt am Montag)
  - Woche und Tag als Zeitraster von 0 bis 24 Uhr mit roter Linie für die aktuelle Uhrzeit
  - Liste „Als Nächstes“ mit Countdown und einer Gruppe „Überfällig“ für vergessene Aufgaben
- **Filter** nach Kategorie und Fach (Trichter-Symbol) sowie eine **Suche** in Titeln und Notizen
- Ein Tipp auf eine freie Stelle in der Wochen- oder Tagesansicht öffnet „Neuer Eintrag“ mit dieser Uhrzeit.
- Ein Tipp auf einen Lernblock öffnet ein kleines Menü zum **Abhaken**, ohne das ganze Formular.
- **Duplizieren:** Im geöffneten Eintrag auf „Duplizieren“ tippen, z. B. für „Vokabeltest Unité 4“.
- **Rückgängig:** Nach dem Löschen bleibt ein paar Sekunden lang „Rückgängig“ eingeblendet.
- **Noten** (eigener Tab): Noten pro Fach mit Gewichtung, gewichteter Schnitt, Zeugnisnote (auf halbe Noten gerundet), Gesamtschnitt und Semester-Auswahl (1. Semester Aug–Jan, 2. Semester Feb–Jul). Der **Notenrechner** sagt dir, welche Note du in der nächsten Prüfung brauchst. Frühere Tests trägst du einfach mit ihrem Datum ein.
- **Note ↔ Test:** Noten lassen sich mit einem Test aus dem Kalender verknüpfen. Im Test steht dann die Note, und vergangene Tests ohne Note erscheinen 30 Tage lang in der Liste unter „Note eintragen?“.
- **Anhänge:** Dateien (Word, PowerPoint, PDF, Fotos … aus der Dateien-App, max. 50 MB) und Links (OneDrive, iCloud, Teams …) an jedem Eintrag, z. B. das Lernzielblatt zum Test.
- **Wischen:** In Monat, Woche und Tag nach links/rechts wischen, um den Zeitraum zu wechseln.
- **Heute-Übersicht** oben in der Liste (und im iPad-Querformat als Seitenleiste neben dem Kalender): heutige Einträge und Lernzeiten, nächster Test mit Lernfortschritt.
- **Offline:** Die zuletzt geladenen Einträge bleiben sichtbar. Ändern geht erst wieder mit Internet.
- Hell- und Dunkelmodus richten sich automatisch nach der Systemeinstellung.

---

## Einrichtung (einmalig)

### 1. Supabase-Projekt anlegen (Datenbank und Login)

1. Gehe auf **https://supabase.com** und klicke auf **Start your project**. Melde dich an, z. B. mit deinem GitHub-Konto.
2. Klicke auf **New project**.
   - **Name:** `kalender-tracker`
   - **Database Password:** auf **Generate a password** klicken und das Passwort sicher aufbewahren (die App braucht es nicht)
   - **Region:** `Central EU (Frankfurt)` oder die nächstgelegene Region
   - Klicke auf **Create new project** und warte etwa 1–2 Minuten.
3. **Tabellen anlegen:** Klicke links auf **SQL Editor** und dann auf **New query**. Öffne im Projektordner die Datei `supabase/migrations/001_init.sql`, kopiere den ganzen Inhalt in das Feld und klicke auf **Run**. Unten sollte „Success. No rows returned“ stehen.
   Danach dasselbe mit `supabase/migrations/002_grades.sql` (Noten): wieder **New query**, Inhalt einfügen, **Run**.
   Danach `supabase/migrations/003_links_and_files.sql` (Noten mit Tests verknüpfen, Anhänge und Datei-Speicher).
   Zum Schluss `supabase/migrations/004_events_and_periods.sql` (Kategorie „Event“, Ferien & freie Tage).
   **Schon eingerichtet?** Dann nur die neueren Dateien ausführen, die noch fehlen. Bestehende Daten bleiben erhalten.
4. **Schlüssel kopieren:** Klicke links unten auf **Project Settings** (Zahnrad) und dann auf **API Keys** bzw. **Data API**.
   - **Project URL** (z. B. `https://abcdefgh.supabase.co`)
   - **anon / public key**: Steht unter „Legacy API keys“ bzw. als **Publishable key** (`sb_publishable_…`). Beide funktionieren.
   - ⚠️ Den **service_role**- bzw. **secret**-Schlüssel **niemals** verwenden. Er umgeht alle Schutzregeln.

### 2. Login einstellen

1. Klicke links auf **Authentication** und dann auf **Sign In / Providers**. Prüfe, dass **Email** aktiviert ist.
2. **E-Mail-Bestätigung:** Unter **Email** steht **Confirm email**.
   - **An** (empfohlen): Nach der Registrierung kommt eine E-Mail mit Bestätigungslink.
   - **Aus**: Man ist sofort angemeldet. Für eine App, die nur du nutzt, ist das bequemer.
3. Klicke unter **Authentication** auf **URL Configuration**:
   - **Site URL:** `https://DEIN-GITHUB-NAME.github.io/REPO-NAME/`
   - Unter **Redirect URLs** auf **Add URL** klicken und zusätzlich `http://localhost:5173/kalender-tracker/` eintragen (für das Testen am Computer).
4. **Nachdem du dein Konto in der App erstellt hast:** Schalte unter **Sign In / Providers** die Option **Allow new users to sign up** aus. Dann kann sich niemand sonst registrieren.

### 3. Lokal starten (am Computer)

Voraussetzung: [Node.js](https://nodejs.org) (LTS) ist installiert.

1. Kopiere die Datei `.env.example` und nenne die Kopie `.env`. Trage dort die Project URL und den anon/publishable key ein.
2. Führe in einem Terminal im Projektordner aus:
   ```bash
   npm install
   npm run dev
   ```
3. Öffne **http://localhost:5173/kalender-tracker/** und erstelle über „Konto erstellen“ dein Konto.

Tests ausführen: `npm test`

### 4. Auf GitHub Pages veröffentlichen

1. **Repository anlegen:** Gehe auf **https://github.com/new**.
   - **Repository name:** frei wählbar, z. B. `kalender-cc`. Erlaubt sind nur Buchstaben, Ziffern, `-`, `_` und `.`. Andere Zeichen (Leerzeichen, Klammern) ersetzt GitHub durch `-`. Merke dir den Namen genau so, wie GitHub ihn anzeigt: Er ist im Folgenden **REPO-NAME**.
   - **Public** wählen (GitHub Pages ist im kostenlosen Plan nur für öffentliche Repositorys verfügbar). Dein Code ist dann öffentlich, deine Einträge aber nicht: Die liegen geschützt in Supabase.
   - **Keine** README, .gitignore oder Lizenz hinzufügen. Klicke auf **Create repository**.
2. **Secrets eintragen:** Gehe im Repository auf **Settings**, dann **Secrets and variables** → **Actions** und klicke auf **New repository secret**. Lege diese zwei Secrets an:
   - Name `VITE_SUPABASE_URL`, Wert: deine Project URL
   - Name `VITE_SUPABASE_ANON_KEY`, Wert: dein anon/publishable key
3. **Pages aktivieren:** Gehe auf **Settings** → **Pages** und wähle unter **Build and deployment** bei **Source** den Eintrag **GitHub Actions**.
4. **Code hochladen** (im Terminal im Projektordner):
   ```bash
   git remote add origin https://github.com/DEIN-GITHUB-NAME/REPO-NAME.git
   git push -u origin main
   ```
   Beim ersten Mal öffnet sich ein Browserfenster für die Anmeldung bei GitHub.
5. Im Tab **Actions** siehst du den Workflow „Veröffentlichen“. Nach etwa 1–2 Minuten ist die App erreichbar unter
   **https://DEIN-GITHUB-NAME.github.io/REPO-NAME/**

Ab jetzt wird die App bei jedem `git push` automatisch neu veröffentlicht.

> Der Pfad der App richtet sich beim Veröffentlichen automatisch nach dem Repository-Namen. Du kannst das Repository also später umbenennen, ohne Code zu ändern (danach in Supabase die Site URL anpassen).

### 5. Auf dem iPad installieren

1. Öffne **Safari** (nicht Chrome) und rufe `https://DEIN-GITHUB-NAME.github.io/REPO-NAME/` auf.
2. Tippe oben auf das **Teilen**-Symbol (Quadrat mit Pfeil nach oben).
3. Wähle **Zum Home-Bildschirm** und tippe auf **Hinzufügen**.
4. Öffne die App über das neue Symbol und **melde dich einmal an**. Die installierte App hat einen eigenen Speicher, deshalb zählt eine Anmeldung in Safari dort nicht.

---

## Supabase-Projekt pausiert?

Im kostenlosen Plan pausiert Supabase ein Projekt, wenn es etwa **eine Woche lang nicht benutzt** wurde. Die App zeigt dann „Keine Verbindung zum Server“, obwohl du online bist. Deine Daten gehen dabei **nicht** verloren.

So aktivierst du es wieder:
1. Gehe auf **https://supabase.com/dashboard** und melde dich an.
2. Klicke auf dein Projekt. Dort steht „Project is paused“.
3. Klicke auf **Restore project** (bzw. **Resume**) und warte ein paar Minuten.
4. Öffne die App neu.

**Automatisch wach halten:** Der Workflow „Supabase wach halten“ (`.github/workflows/keep-alive.yml`) fragt die Datenbank alle 3 Tage kurz ab, damit das Projekt gar nicht erst pausiert. Er nutzt dieselben zwei Secrets wie die Veröffentlichung. Schlägt er fehl, bekommst du von GitHub eine E-Mail. Dann ist das Projekt vermutlich doch pausiert.

> Achtung: GitHub schaltet zeitgesteuerte Workflows ab, wenn 60 Tage lang nichts ins Repository gepusht wurde. Du bekommst vorher eine E-Mail. Dann im Tab **Actions** beim Workflow „Supabase wach halten“ auf **Enable workflow** klicken.

---

## Aufbau des Codes (für eigene Änderungen)

```
src/
├─ lib/            Reine Logik ohne Oberfläche, gut testbar
│  ├─ dates.ts       Datumsrechnung und -formatierung (TT.MM.JJJJ, Wochenstart Montag)
│  ├─ layout.ts      Position der Blöcke im Zeitraster, Überlappungen
│  ├─ grouping.ts    Gruppen der Liste „Als Nächstes“
│  ├─ grades.ts      Notenschnitt, Zeugnisnote, Notenrechner, Semester
│  ├─ overdue.ts     Gruppen „Überfällig“ und „Note eintragen?“
│  ├─ periods.ts     Ferien & freie Tage: Arten, Tage nachschlagen, Countdown und Schultage
│  ├─ files.ts       Anhänge: Symbole, Grössen, Links prüfen
│  ├─ swipe.ts       Wischgesten erkennen
│  ├─ filters.ts     Filter und Suche
│  ├─ categories.ts  Kategorien mit Symbolen, Farbvorschläge für Fächer
│  ├─ cache.ts       Offline-Speicher
│  ├─ router.ts      Adressen wie #/woche/2026-10-20
│  └─ ics.ts         Notizen für einen späteren Export in den Apple-Kalender
├─ data/           Verbindung zu Supabase (Laden, Speichern, Login)
├─ components/     Bausteine (Formular, Kopfzeile, Filter …)
└─ views/          Die Ansichten Monat, Woche/Tag, Liste, Suche, Fächer, Login
supabase/migrations/  Datenbankstruktur (SQL)
tests/                Automatische Tests (npm test)
```

Häufige Kleinigkeiten:
- **Symbole der Kategorien ändern:** `src/lib/categories.ts`
- **Arten und Farben von Ferien & freien Tagen:** `PERIOD_KINDS` in `src/lib/periods.ts`
- **Höhe einer Stunde im Raster:** `HOUR_HEIGHT` in `src/views/TimeGrid.tsx`
- **App-Icon neu erzeugen:** Farben in `scripts/generate-icons.mjs` anpassen, dann `npm run icons`
