import { Plugin } from 'vite';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Vite plugin to inject UI HTML into the main Figma plugin bundle
 * 
 * This plugin reads the built ui.html and injects it as a __html__ global
 * variable into the main.js bundle, which Figma's showUI() expects.
 */
export function figmaPlugin(): Plugin {
  return {
    name: 'vite-plugin-figma',
    
    // Hook that runs after the build is complete
    writeBundle(options, bundle) {
      const outputDir = options.dir || 'build';
      const mainJsPath = resolve(outputDir, 'main.js');
      const uiJsPath = resolve(outputDir, 'ui.js');
      const uiCssPath = resolve(outputDir, 'ui.css');

      try {
        // Read the generated UI assets
        const uiJs = readFileSync(uiJsPath, 'utf-8');
        const uiCss = readFileSync(uiCssPath, 'utf-8');

        // Build the HTML with inlined assets directly
        // This avoids string replacement issues where replacement patterns
        // might match inside the JavaScript code itself
        const uiHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Figma Font Audit Pro</title>
    <style>${uiCss}</style>
  </head>
  <body>
    <div id="root"></div>
    <script>${uiJs}</script>
  </body>
</html>`;

        // Read the main.js bundle
        let mainJs = readFileSync(mainJsPath, 'utf-8');

        // Inject __html__ with inlined assets
        const htmlInjection = `const __html__ = ${JSON.stringify(uiHtml)};\n`;
        mainJs = htmlInjection + mainJs;

        // Write the modified main.js back
        const fs = require('fs');
        fs.writeFileSync(mainJsPath, mainJs);

        console.log('✓ Inlined UI assets and injected into main.js');
      } catch (error) {
        console.error('Failed to inject UI HTML:', error);
      }
    },
  };
}
