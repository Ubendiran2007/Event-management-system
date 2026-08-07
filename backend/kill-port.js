const { execSync } = require('child_process');
const { execSync: execSyncSilent } = require('child_process');

try {
  execSync('powershell -Command "Get-NetTCPConnection -LocalPort 5001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"');
  console.log('[kill-port] Port 5001 cleared.');
} catch (e) {
  // Port was already free
}

// Wait 800ms for the OS to release the port before nodemon starts the server
const start = Date.now();
while (Date.now() - start < 800) { /* spin wait */ }
