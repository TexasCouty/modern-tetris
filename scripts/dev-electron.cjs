#!/usr/bin/env node
// Dynamic dev launcher using Vite programmatic API (more reliable on Windows) + Electron spawn.

const { spawn } = require('child_process');
const net = require('net');

const START_PORT = 5173;
const MAX_PORT = 5199;

function findOpenPort(port = START_PORT) {
  return new Promise((resolve, reject) => {
    if (port > MAX_PORT) return reject(new Error('No free port in range'));
    const srv = net.createServer();
    srv.once('error', () => { srv.close(); resolve(findOpenPort(port + 1)); });
    srv.once('listening', () => { const p = srv.address().port; srv.close(() => resolve(p)); });
    srv.listen(port, '127.0.0.1');
  });
}

async function run() {
  process.env.NODE_ENV = 'development';
  const port = await findOpenPort();
  console.log(`[dev-electron] Starting Vite on available port ${port}`);

  const { createServer } = require('vite');
  const viteServer = await createServer({ server: { port, strictPort: false } });
  await viteServer.listen();

  // Determine served URL
  const resolved = viteServer.resolvedUrls;
  const devUrl = (resolved && resolved.local && resolved.local[0]) || `http://localhost:${port}`;
  process.env.VITE_DEV_SERVER_URL = devUrl;
  console.log(`[dev-electron] Dev URL: ${devUrl}`);

  // Launch Electron
  const electronPath = require('electron');
  const electron = spawn(electronPath, ['.'], { stdio: 'inherit', env: process.env });

  const shutdown = () => {
    console.log('[dev-electron] Shutting down...');
    try { electron.kill(); } catch {}
    try { viteServer.close(); } catch {}
    process.exit();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  electron.on('exit', (code) => {
    console.log(`[dev-electron] Electron exited (${code}). Closing Vite.`);
    viteServer.close().finally(() => process.exit(code || 0));
  });
}

run().catch(err => {
  console.error('[dev-electron] Failed:', err);
  process.exit(1);
});
