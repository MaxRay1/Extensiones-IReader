const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const PLUGINS_DIR = path.join(__dirname, '..', 'plugins');
const DIST_DIR = path.join(__dirname, '..', '.dist');

if (!fs.existsSync(DIST_DIR)) {
  fs.mkdirSync(DIST_DIR, { recursive: true });
}

function getFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      getFiles(filePath, arrayOfFiles);
    } else if (file.endsWith('.ts') || file.endsWith('.js')) {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

async function buildRepository() {
  console.log('Iniciando compilación de extensiones para IReader...');
  
  const pluginFiles = fs.existsSync(PLUGINS_DIR) ? getFiles(PLUGINS_DIR) : [];
  const index = [];

  for (const file of pluginFiles) {
    const relativePath = path.relative(PLUGINS_DIR, file);
    const pathParts = relativePath.split(path.sep);
    const lang = pathParts[0];
    const filename = pathParts[pathParts.length - 1].replace(/\.(ts|js)$/, '');

    const outJsPath = path.join(DIST_DIR, 'plugins', lang, `${filename}.js`);
    fs.mkdirSync(path.dirname(outJsPath), { recursive: true });

    console.log(`Compilando plugin: [${lang}] ${filename}...`);

    try {
      await esbuild.build({
        entryPoints: [file],
        bundle: true,
        outfile: outJsPath,
        format: 'cjs',
        target: 'es2020',
        minify: true,
      });

      // Extraer metadatos básicos
      const content = fs.readFileSync(file, 'utf8');
      const idMatch = content.match(/id:\s*["']([^"']+)["']/);
      const nameMatch = content.match(/name:\s*["']([^"']+)["']/);
      const siteMatch = content.match(/site:\s*["']([^"']+)["']/);
      const versionMatch = content.match(/version:\s*["']([^"']+)["']/);

      const pluginMeta = {
        id: idMatch ? idMatch[1] : filename,
        name: nameMatch ? nameMatch[1] : filename,
        site: siteMatch ? siteMatch[1] : '',
        lang: lang,
        version: versionMatch ? versionMatch[1] : '1.0.0',
        url: `plugins/${lang}/${filename}.js`,
        iconUrl: `icons/${filename}.png`
      };

      index.push(pluginMeta);
    } catch (err) {
      console.error(`Error compilando ${file}:`, err);
    }
  }

  // Guardar archivo index/plugins.min.json
  const indexPath = path.join(DIST_DIR, 'plugins.min.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

  console.log(`\n¡Compilación completada exitosamente!`);
  console.log(`Generados ${index.length} plugins en .dist/plugins.min.json`);
}

buildRepository().catch((err) => {
  console.error('Error fatal durante la compilación:', err);
  process.exit(1);
});
