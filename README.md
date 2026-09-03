# Crazy_Batto TikTok Account Analyzer

Eigenständige Windows/Electron-App zum Laden und Vergleichen öffentlich verfügbarer TikTok-Profildaten.

## Funktionen

- Hauptaccount per `@username` laden
- Provider: Euler Stream, TikAPI und frei konfigurierbarer Custom-Provider
- lokale SQLite-Datenbank für bereits gesehene Profile
- Vergleich von Handle, Nickname, Bio, Region, Avatar-URL und numerischer TikTok-User-ID
- Kandidatenanzeige mit Ähnlichkeitswert und Begründungen
- API-Keys lokal in der App-Datenbank
- Windows-Installer und portable Build-Konfiguration

> Der Ähnlichkeitswert ist nur eine technische Bewertung öffentlicher Merkmale. Er beweist nicht, dass unterschiedliche TikTok-Konten derselben realen Person gehören.

## Start

```powershell
npm install
npm start
```

## Windows Setup bauen

```powershell
npm run build
```

Die Setup-Datei landet anschließend unter `dist/`.

Portable Version:

```powershell
npm run build:portable
```

## Euler Stream

In **API-Einstellungen** den Euler API-Key eintragen. Standardmäßig wird der öffentliche Profil-Endpunkt für `unique_id` verwendet. Die Base URL ist separat editierbar, falls Euler die API-Adresse ändert.

## TikAPI

TikAPI-Key in den Einstellungen eintragen. Der Provider nutzt den Public-Profile-Check für einen Benutzernamen.

## Custom Provider

Ein URL-Template kann z. B. so hinterlegt werden:

```text
https://example.com/api/profile/{username}
```

`{username}` bzw. `{handle}` wird durch den eingegebenen TikTok-Namen ersetzt. Ein optionaler Key wird als Bearer-Token gesendet.
