# TikTok Fake Account Analyzer – Android

Eigenständige Android-App für öffentliche TikTok-Profilanalyse und Kandidatenvergleich.

## Öffnen

Den Ordner `android/` als Projekt in Android Studio oder AndroidIDE öffnen.

## Funktionen

- TikTok-Handle eingeben
- Hauptprofil über Euler Stream oder TikAPI laden
- automatische Kandidatensuche über TikAPI
- Kandidaten nach öffentlichen Ähnlichkeiten bewerten
- API-Keys lokal auf dem Gerät speichern
- keine reale Identitätsfeststellung; Treffer sind nur Ähnlichkeitsindikatoren

## API-Keys

In der App unter `API` eintragen:

- Euler Stream API-Key
- TikAPI API-Key

Für die automatische Kandidatensuche wird aktuell TikAPI benötigt. Euler wird bevorzugt für Profilabfragen verwendet, wenn ein Euler-Key vorhanden ist.

## Build

In Android Studio: `Build > Build APK(s)`.

Per Gradle, wenn ein lokaler Gradle-Wrapper erzeugt wurde:

```bash
./gradlew assembleDebug
```

APK-Ausgabe typischerweise unter:

`app/build/outputs/apk/debug/app-debug.apk`
