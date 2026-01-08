import { spawn } from 'child_process';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = process.env.PORT || 8080;

console.log(`🚇 Iniciando Cloudflare Tunnel hacia http://localhost:${port}...`);

const proc = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`], {
  stdio: ['ignore', 'pipe', 'pipe'],
});

const handleOutput = (data) => {
  const output = data.toString();
  console.log(output);

  const match = output.match(/(https:\/\/[a-z0-9-]+\.trycloudflare\.com)/i);
  if (match) {
    const url = match[1];
    const tunnelFile = join(__dirname, '..', '.tunnel-url');
    writeFileSync(tunnelFile, url, 'utf8');
    console.log(`\n✅ Tunnel URL guardada en .tunnel-url: ${url}\n`);
  }
};

proc.stdout.on('data', handleOutput);
proc.stderr.on('data', handleOutput);

proc.on('close', (code) => {
  console.log(`Cloudflare tunnel finalizado con código ${code}`);
});
