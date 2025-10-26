#!/usr/bin/env node

// Render start file - redirects to the actual production build
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Go up one level from src/ to project root, then to dist/index.js
const distPath = join(__dirname, '..', 'dist', 'index.js');

console.log('🚀 Starting trading platform...');
console.log('📂 Running:', distPath);

// Start the production server
const child = spawn('node', [distPath], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' }
});

child.on('error', (error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  console.log(`Server exited with code ${code}`);
  process.exit(code || 0);
});
