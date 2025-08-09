const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

async function buildContentScript() {
  try {
    // Bundle the content script with all its dependencies
    await esbuild.build({
      entryPoints: ['src/content/content.ts'],
      bundle: true,
      outfile: 'dist/content/content-bundled.js',
      format: 'iife', // Immediately Invoked Function Expression - works in browser context
      target: 'es2020',
      sourcemap: true,
      define: {
        'process.env.NODE_ENV': '"production"'
      },
      external: [], // Don't externalize anything, bundle everything
      platform: 'browser',
      resolveExtensions: ['.ts', '.js'],
      loader: {
        '.ts': 'ts'
      },
      tsconfig: 'tsconfig.json'
    });

    console.log('Content script bundled successfully!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

buildContentScript();
