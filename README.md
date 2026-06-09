# FB4 Fragen-Trainer

Vanilla-JS Quiz-App zum Üben und Prüfen von FB4-Segelfragen.

## Favicon & PWA Icons

Alle App-Icons liegen in [`icons/`](icons/). Die SVG-Quelldatei ist `icons/favicon.svg` — ein helles Motiv mit Kompassrose, Polarstern (Astro-Navigation), Meereshorizont (Segeln) und dezentem Sextantenbogen. Farben: Himmel `#f8fafc` / `#e0f2fe`, Meer `#7dd3fc`, Akzentblau `#3b82f6`.

| Datei | Größe | Verwendung |
|-------|-------|------------|
| `favicon.svg` | skalierbar | Moderne Browser (Tab-Icon) |
| `favicon.ico` | 16+32 | Legacy-Browser, Root-Fallback |
| `favicon-16x16.png` | 16×16 | Kleine Tab-Icons |
| `favicon-32x32.png` | 32×32 | Standard Tab-Icons |
| `icon-96x96.png` | 96×96 | Desktop PNG favicon + Manifest |
| `icon-192x192.png` | 192×192 | Android Home Screen / Manifest |
| `icon-512x512.png` | 512×512 | Splash / Install-Prompt / Manifest |
| `apple-touch-icon.png` | 180×180 | iOS Home Screen |

Die Web-App-Manifest-Datei [`manifest.webmanifest`](manifest.webmanifest) enthält `name`, `short_name`, `description`, `start_url`, `display: standalone`, `background_color`, `theme_color` und die Icon-Einträge.

Ein minimaler Service Worker ([`sw.js`](sw.js)) cached die App-Hülle für Offline-Nutzung und erfüllt die Chrome-Installierbarkeits-Anforderungen. Registrierung erfolgt in `app.js`.

**Icons neu generieren** (nach Änderung der SVG):

```bash
cd icons
rsvg-convert -w 16  -h 16  favicon.svg -o favicon-16x16.png
rsvg-convert -w 32  -h 32  favicon.svg -o favicon-32x32.png
rsvg-convert -w 96  -h 96  favicon.svg -o icon-96x96.png
rsvg-convert -w 180 -h 180 favicon.svg -o apple-touch-icon.png
rsvg-convert -w 192 -h 192 favicon.svg -o icon-192x192.png
rsvg-convert -w 512 -h 512 favicon.svg -o icon-512x512.png
convert favicon-16x16.png favicon-32x32.png favicon.ico
cp favicon.ico ../favicon.ico
cp icon-96x96.png ../icon-96x96.png
```

## Lokaler Start

```bash
python3 -m http.server 8000
```

Dann im Browser: `http://localhost:8000`
