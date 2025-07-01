const fs = require('fs-extra');
const path = require('path');
const mjml2html = require('mjml');
const { Liquid } = require('liquidjs');
const chokidar = require('chokidar');
const browserSync = require('browser-sync').create();

const srcPath = path.join(__dirname, 'src');
const distPath = path.join(__dirname, 'dist');

const liquid = new Liquid({
  root: srcPath,
  extname: '.mjml',
  cache: false
});

async function buildTemplate(templateFile) {
  try {
    const templateName = path.basename(templateFile, '.mjml');
    const templatePath = path.join(srcPath, 'templates', templateFile);
    console.log(`Processing: ${templateName}`);
    const dataPath = path.join(srcPath, 'data', `${templateName}.json`);
    const data = fs.existsSync(dataPath) ? await fs.readJson(dataPath) : {};
    const templateContent = await fs.readFile(templatePath, 'utf-8');
    const liquidRendered = await liquid.parseAndRender(templateContent, data);
    const { html, errors } = mjml2html(liquidRendered, {
      filePath: path.join(srcPath, 'templates')
    });
    if (errors.length > 0) {
      console.error('MJML Errors:', errors);
      return;
    }
    const outputPath = path.join(distPath, `${templateName}.html`);
    await fs.ensureDir(path.dirname(outputPath));
    await fs.writeFile(outputPath, html);
    console.log(`Successfully built ${templateName}.html`);
  } catch (error) {
    console.error(`Error building ${templateFile}:`, error);
  }
}

async function buildAll() {
  const templateFiles = await fs.readdir(path.join(srcPath, 'templates'));
  for (const file of templateFiles) {
    if (file.endsWith('.mjml')) {
      await buildTemplate(file);
    }
  }
}

// ====================================================================
// NEUE, VEREINFACHTE WATCH-FUNKTION ZUM DEBUGGEN
// ====================================================================
function watch() {
  browserSync.init({
    server: {
      baseDir: distPath,
      directory: true
    },
    port: 3000,
    ui: false,
    files: [path.join(distPath, '*.html')]
  });

  console.log('>>> [DEBUG] WATCH-FUNKTION WURDE GESTARTET.');
  console.log(`>>> [DEBUG] Versuche, den Ordner zu beobachten: ${srcPath}`);

  // Wir beobachten jetzt den gesamten src-Ordner
  const watcher = chokidar.watch(srcPath, {
    persistent: true,
    usePolling: true, // Behalten wir zur Sicherheit bei
    ignoreInitial: true,
    // Intervall für Polling in Millisekunden
    interval: 300, 
  });

  watcher
    .on('add', path => console.log(`>>> [EVENT] Datei hinzugefügt: ${path}`))
    .on('change', async path => {
      console.log(`>>> [EVENT] Datei geändert: ${path}`);
      console.log('>>> Führe erneuten Build aus...');
      await buildAll();
    })
    .on('unlink', path => console.log(`>>> [EVENT] Datei gelöscht: ${path}`))
    .on('ready', () => console.log('>>> [DEBUG] Chokidar ist bereit und beobachtet das Dateisystem.'))
    .on('error', error => console.error(`>>> [FEHLER] Watcher-Fehler: ${error}`));
}

// Start-Logik bleibt gleich
const args = process.argv.slice(2);
if (args.includes('--watch')) {
  buildAll().then(watch);
} else {
  buildAll();
}