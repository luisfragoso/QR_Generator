# QR_Generator

Monorepo con un generador de códigos QR con estilo (dots/corners/redondeado), con:

- `web/`: versión web estática (PWA / offline via Service Worker).
- `mobile/`: app móvil (Expo / Android) que renderiza el QR estilizado **100% offline** usando `qr-code-styling` dentro de un `WebView`.
- `demo-qr/`: demo de escritorio (Electron) que sirvió como base para igualar UI y estilos.
- `qr-code-styling/`: copia del código fuente de la librería (referencia).

## Requisitos

- Node.js (LTS recomendado)
- Git

Para `mobile/`:

- Expo CLI (se usa vía `npx`)
- Cuenta de Expo/EAS si vas a compilar APK en la nube

## Estructura

- **Web (PWA)**: `./web`
- **Mobile (Expo / Android APK)**: `./mobile`
- **Desktop (Electron)**: `./demo-qr`

---

# Web (PWA) - `web/`

## Correr local

`web/` es un sitio estático (no tiene `package.json`). Puedes servirlo de estas formas:

### Opción A: servidor estático simple

```bash
cd web
npx serve .
```

### Opción B: Docker (Nginx)

```bash
cd web
docker compose up --build
```

## Offline

La PWA usa `service-worker.js` para precachear los assets principales y permitir carga offline.

---

# Mobile (Expo) - `mobile/`

## Instalar dependencias

```bash
cd mobile
npm install
```

## Correr en desarrollo

```bash
cd mobile
npx expo start
```

## APK (EAS Build)

El perfil recomendado es `preview` (genera APK).

```bash
cd mobile
eas build -p android --profile preview --clear-cache
```

> Nota: necesitas estar logueado en Expo (`eas login`).

---

## QR estilizado 100% offline (sin CDN)

La app móvil renderiza el QR estilizado con `qr-code-styling` dentro de un `WebView`, pero **sin cargar scripts desde internet**.

- El bundle de la librería se incluye como asset local:
  - `mobile/assets/qr/qr-code-styling.txt`
- En runtime, la app:
  - carga ese asset con `expo-asset`
  - lo lee con `expo-file-system`
  - inyecta el contenido inline en el HTML del `WebView`

Así, la generación funciona incluso en modo avión.

---

# Desktop (Electron) - `demo-qr/`

Proyecto demo usado para la UI original (estilo web/desktop).

```bash
cd demo-qr
npm install
npm run start
```

Build instalador Windows:

```bash
cd demo-qr
npm run dist
```

---

# Notas de repositorio

- Este repo incluye varias apps (web/mobile/desktop). Cada carpeta tiene su propio `package.json`.
- `node_modules/` y artefactos de build están ignorados por `.gitignore`.
