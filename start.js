#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Find the correct path to index.js regardless of where we're running from
const distPath = join(__dirname, 'dist', 'index.js');

console.log('Starting application from:', distPath);

// Import and run the main application
import(distPath).catch(err => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
