# Repositorio de Extensiones / Plugins para IReader / LNReader

Este proyecto contiene una plantilla completa para crear, alojar y distribuir tu propio repositorio de fuentes y extensiones para la aplicación **IReader** (y **LNReader**).

---

## 📌 Estructura del Proyecto

```
ireader-extension-repo/
├── .github/
│   └── workflows/
│       └── deploy.yml          # Automatización de compilación y despliegue a GitHub Pages
├── plugins/
│   └── spanish/
│       └── ejemplo-novelas.ts   # Código fuente de plugin/extensión en TypeScript
├── scripts/
│   └── build.js                # Compilador de plugins y generador del index.json
├── src/
│   └── types/
│       └── plugin.ts           # Interfaces TypeScript para desarrollo de fuentes
├── package.json
└── tsconfig.json
```

---

## 🚀 Guía de Configuración Paso a Paso

### 1. Subir este repositorio a GitHub
1. Crea un nuevo repositorio en GitHub (por ejemplo, `ireader-extensiones`).
2. Sube estos archivos a la rama principal (`main` o `master`).

### 2. Configurar GitHub Pages
1. En tu repositorio en GitHub, ve a **Settings → Pages**.
2. En **Build and deployment**, selecciona la fuente **Deploy from a branch** o deja que **gh-pages** (creada por la GitHub Action) maneje la publicación.
3. Una vez que se ejecute la GitHub Action, se creará automáticamente una rama `gh-pages`. Selecciona la rama `gh-pages` y la carpeta `/ (root)`.

### 3. Obtener la URL de tu Repositorio
La URL final del repositorio index de tu app será:
```
https://<tu-usuario>.github.io/<tu-repositorio>/plugins.min.json
```
*(o bien usando la URL raw de GitHub)*:
```
https://raw.githubusercontent.com/<tu-usuario>/<tu-repositorio>/gh-pages/plugins.min.json
```

---

## 📱 Cómo agregar el Repositorio en la App IReader

1. Abre la aplicación **IReader** en tu dispositivo Android.
2. Ve a **Ajustes (Settings)** → **Repositorio (Repository)**.
3. Toca el botón **(+)** para añadir un nuevo repositorio.
4. Pega la URL de tu `plugins.min.json`.
5. Presiona **Guardar / Actualizar**. Las extensiones que agregues aparecerán listas para instalar en la sección **Explorar → Fuentes**.

---

## 🛠️ Cómo crear una Nueva Extensión / Fuente

1. Crea un nuevo archivo `.ts` en la carpeta correspondiente al idioma, por ejemplo: `plugins/spanish/mi-fuente-novelas.ts`.
2. Define los datos de la fuente implementando los métodos requeridos:
   - `popularNovels(pageNo)`: Obtiene la lista de novelas populares.
   - `parseNovelAndChapters(novelPath)`: Obtiene los detalles de la novela y sus capítulos.
   - `parseChapter(chapterPath)`: Obtiene el texto/contenido HTML de un capítulo.
   - `searchNovels(searchTerm, pageNo)`: Realiza búsquedas de novelas.
3. Al hacer `git push` a la rama `main`, la GitHub Action compilará automáticamente los plugins y actualizará `plugins.min.json`.

---

## 💻 Desarrollo Local

Para compilar y verificar localmente en tu computadora:

```bash
npm install
npm run build
```

Esto generará la carpeta `.dist/` con los archivos JavaScript minificados y el índice `plugins.min.json`.
