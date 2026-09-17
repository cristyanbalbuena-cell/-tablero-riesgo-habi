# Tablero Operativo de Riesgo — Habi

Este repositorio contiene el código completo del tablero (frontend + backend en Apps Script),
y también se usa para publicarlo con GitHub Pages.

## Archivos
- `index.html` — El tablero completo (HTML + CSS + JS en un solo archivo). Nombre en minúsculas
  a propósito: así sirve tanto para Apps Script como para GitHub Pages sin duplicar nada.
- `Code.gs` — Backend en Apps Script: sirve el tablero, guarda/lee datos de la Google Sheet
  compartida, y trae los datos de BigQuery automáticamente cada 12 horas.
- `appsscript.json` — Manifiesto de Apps Script (declara el servicio de BigQuery y la
  configuración de la app web).

## Seguridad: nada de datos sensibles en el código
`Code.gs` **no** tiene escrito el ID de tu Google Sheet ni tu webhook de Chat — los lee desde
las "Propiedades del script" de Apps Script, que viven fuera del código y nunca se suben a
GitHub. Por eso este repositorio se puede hacer público sin riesgo.

### Configura esas propiedades (una sola vez, dentro de Apps Script — no en este repo)
1. En script.google.com, abre tu proyecto.
2. Ícono de engrane (Configuración del proyecto) → baja hasta "Propiedades del script".
3. "Añadir propiedad del script":
   - Propiedad: `SPREADSHEET_ID` — Valor: el ID de tu Google Sheet compartida.
   - Propiedad: `CHAT_WEBHOOK_URL` — Valor: tu webhook de Google Chat.
4. Guarda.

## Configuración inicial con clasp (una sola vez)

### 1. Instala Node.js
Si no lo tienes, descárgalo de https://nodejs.org (elige la versión LTS).

### 2. Instala clasp
```bash
npm install -g @google/clasp
```

### 3. Inicia sesión
```bash
clasp login
```

### 4. Consigue el ID de tu proyecto de Apps Script existente
Apps Script → ícono de engrane → sección "IDs" → copia el "ID de secuencia de comandos".

### 5. Conecta esta carpeta con tu proyecto existente
Renombra `.clasp.json.EJEMPLO` a `.clasp.json`, y pega tu Script ID adentro:
```json
{
  "scriptId": "TU_ID_REAL_AQUI",
  "rootDir": "."
}
```

### 6. Sube el código
```bash
clasp push
```
Si tu proyecto de Apps Script todavía tiene un archivo viejo llamado `Index` (con "I"
mayúscula, de una versión anterior), bórralo manualmente desde el editor web de Apps Script
después de este push — ya no se usa, ahora el archivo se llama `index`.

## Publicar con GitHub Pages

1. Crea un repositorio **nuevo y público** en github.com (ej. `tablero-riesgo-habi`).
2. Sube esta carpeta:
   ```bash
   git init
   git add .
   git commit -m "Version inicial del tablero"
   git remote add origin https://github.com/TU_USUARIO/tablero-riesgo-habi.git
   git branch -M main
   git push -u origin main
   ```
3. En GitHub, dentro del repositorio: **Settings → Pages**.
4. En "Source" elige la rama `main` y la carpeta `/ (root)`. Guarda.
5. Espera uno o dos minutos — GitHub te da la URL pública, algo como:
   `https://tuusuario.github.io/tablero-riesgo-habi/`
6. Esa es tu link único, a pantalla completa, sin las limitaciones de Google Sites.

## Flujo de trabajo diario

**Para subir cambios de código a Apps Script:**
```bash
clasp push
```

**Para traer cambios hechos directo en el editor web de Apps Script:**
```bash
clasp pull
```

**Para publicar cambios también en GitHub Pages:**
```bash
git add .
git commit -m "Descripción de lo que cambiaste"
git push
```
(GitHub Pages se actualiza solo, unos minutos después de cada `git push` a `main`.)

## Después de implementar una nueva versión en Apps Script
`clasp push` sube el código, pero **no crea una nueva implementación web automáticamente**.
Sigues necesitando: Apps Script → Implementar → Gestionar implementaciones → Nueva versión,
para que tu link `/exec` (el de Apps Script, no el de GitHub Pages) quede actualizado.
