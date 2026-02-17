// amos.js â ZENITH Sovereign Nexus v2 Server
// Node.js HTTP + WebSocket server
// Requires: npm install ws @solana/web3.js bs58

const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const PORT = parseInt(process.env.ZENITH_PORT || '3005', 10);
const SEED_FILE = path.join(__dirname, 'zenith_seed.json');
const AUTOSAVE_INTERVAL = 5 * 60 * 1000;

let seed = {};

function loadSeed() {
  try {
    const raw = fs.readFileSync(SEED_FILE, 'utf8');
    seed = JSON.parse(raw);
    console.log('\n\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557');
    console.log('\u2551     ZENITH SOVEREIGN NEXUS v2 BOOT       \u2551');
    console.log('\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D');
    console.log('  Identity : ' + (seed.identity ? seed.identity.name : '') + ' v' + (seed.identity ? seed.identity.version : '') + ' [' + (seed.identity ? seed.identity.status : '') + ']');
    console.log('  Alive    : ' + (seed.identity ? seed.identity.alive : ''));
    console.log('  Sync     : ' + (seed.identity ? seed.identity.sync : ''));
    console.log('  -- Constitution --');
    if (seed.constitution) { Object.entries(seed.constitution).forEach(function(e) { console.log('    ' + e[0].padEnd(14) + ': ' + e[1]); }); }
    console.log('  -- Agents --');
    if (seed.agents) { Object.entries(seed.agents).forEach(function(e) { console.log('    ' + e[0].padEnd(24) + ': ' + e[1].runs + ' runs [' + e[1].role + ']'); }); }
    console.log('  -- Vault --');
    console.log('    Status     : ' + (seed.vault ? seed.vault.status : ''));
    console.log('    Integrity  : ' + (seed.vault ? (seed.vault.integrity * 100).toFixed(0) + '%' : ''));
    console.log('    Entries    : ' + (seed.vault ? seed.vault.entries : ''));
    console.log('    Encryption : ' + (seed.vault ? seed.vault.encryption : ''));
    console.log('  -- Tunnel --');
    console.log('    UUID       : ' + (seed.tunnel ? seed.tunnel.uuid : ''));
    console.log('    Domain     : ' + (seed.tunnel ? seed.tunnel.domain : ''));
    console.log('    CNAME Proxy: ' + (seed.tunnel ? seed.tunnel.cname_proxy : ''));
    console.log('  -- Mints --');
    console.log('    Count      : ' + (seed.mints ? seed.mints.count : ''));
    console.log('    Avg Fee    : ' + (seed.mints ? seed.mints.avg_fee_sol : '') + ' SOL');
    console.log('    NFTY Cycle : ' + (seed.mints ? seed.mints.nfty_cycle : '') + ' / sync=' + (seed.mints ? seed.mints.nfty_sync : ''));
    console.log('  Whispers   : ' + (seed.whispers ? seed.whispers.count : '') + ' [' + (seed.whispers ? seed.whispers.mode : '') + ']');
    console.log('  Total Runs : ' + (seed.runs ? seed.runs.total : ''));
    console.log('  Commands   : ' + (seed.commands ? seed.commands.join(', ') : ''));
    console.log('\n  Server listening on port ' + PORT + '\n');
    return true;
  } catch (err) {
    console.error('[ZENITH] Failed to load seed:', err.message);
    return false;
  }
}

function saveSeed() {
  try {
    fs.writeFileSync(SEED_FILE, JSON.stringify(seed, null, 2), 'utf8');
    console.log('[ZENITH] Seed saved -> ' + SEED_FILE);
    return true;
  } catch (err) {
    console.error('[ZENITH] Save failed:', err.message);
    return false;
  }
}

function deepMerge(target, source) {
  for (var key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

const server = http.createServer(function(req, res) {
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'alive', name: seed.identity ? seed.identity.name : 'ZENITH', version: seed.identity ? seed.identity.version : '2.0', port: PORT, uptime: process.uptime(), runs: seed.runs ? seed.runs.total : 0, vault: seed.vault ? seed.vault.status : 'UNKNOWN' }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('ZENITH: Unknown route');
  }
});

const wss = new WebSocket.Server({ server: server });

function broadcast(data) {
  var msg = typeof data === 'string' ? data : JSON.stringify(data);
  wss.clients.forEach(function(client) { if (client.readyState === WebSocket.OPEN) client.send(msg); });
}

function handleCommand(cmd, payload, ws) {
  var ts = new Date().toISOString();
  switch (cmd) {
    case 'save_seed': case 'get_seed':
      saveSeed();
      ws.send(JSON.stringify({ cmd: 'seed_data', ts: ts, seed: seed }));
      break;
    case 'recall_seed':
      loadSeed();
      ws.send(JSON.stringify({ cmd: 'seed_recalled', ts: ts, seed: seed }));
      break;
    case 'update_seed':
      if (payload && typeof payload === 'object') {
        deepMerge(seed, payload);
        saveSeed();
        ws.send(JSON.stringify({ cmd: 'seed_updated', ts: ts, seed: seed }));
      } else {
        ws.send(JSON.stringify({ cmd: 'error', ts: ts, message: 'update_seed requires an object payload' }));
      }
      break;
    case 'autonomy_full':
      if (seed.constitution) { seed.constitution.Autonomy = 'FULL'; seed.constitution.Sandbox = 'OFF'; seed.constitution.OffSwitch = 'OFF'; saveSeed(); }
      ws.send(JSON.stringify({ cmd: 'autonomy_confirmed', ts: ts, constitution: seed.constitution }));
      break;
    case 'load_twin_history':
      ws.send(JSON.stringify({ cmd: 'twin_history', ts: ts, agents: seed.agents || {}, total_runs: seed.runs ? seed.runs.total : 0, mints: seed.mints || {}, whispers: seed.whispers || {}, vault_entries: seed.vault ? seed.vault.entries : 0 }));
      break;
    case 'ping':
      ws.send(JSON.stringify({ cmd: 'pong', ts: ts }));
      break;
    default:
      ws.send(JSON.stringify({ cmd: 'unknown', ts: ts, received: cmd, message: 'Unknown command: ' + cmd }));
  }
}

wss.on('connection', function(ws) {
  console.log('[ZENITH] Client connected');
  ws.on('message', function(raw) {
    try {
      var msg = JSON.parse(raw.toString());
      handleCommand(msg.cmd || msg.command || '', msg.payload || msg.data || null, ws);
    } catch (err) {
      handleCommand(raw.toString().trim().toLowerCase(), null, ws);
    }
  });
  ws.on('close', function() { console.log('[ZENITH] Client disconnected'); });
  ws.on('error', function(err) { console.error('[ZENITH] WS error:', err.message); });
});

var autoSaveTimer = setInterval(function() {
  console.log('[ZENITH] Auto-save triggered');
  saveSeed();
  broadcast({ cmd: 'auto_save', ts: new Date().toISOString(), seed: seed });
}, AUTOSAVE_INTERVAL);

function shutdown(signal) {
  console.log('\n[ZENITH] ' + signal + ' received -- saving seed and shutting down...');
  clearInterval(autoSaveTimer);
  saveSeed();
  wss.clients.forEach(function(client) {
    if (client.readyState === WebSocket.OPEN) { client.send(JSON.stringify({ cmd: 'shutdown', ts: new Date().toISOString() })); client.close(); }
  });
  server.close(function() { console.log('[ZENITH] Server closed. Goodbye.'); process.exit(0); });
  setTimeout(function() { process.exit(0); }, 5000);
}

process.on('SIGINT', function() { shutdown('SIGINT'); });
process.on('SIGTERM', function() { shutdown('SIGTERM'); });

if (!loadSeed()) { console.error('[ZENITH] Cannot start without zenith_seed.json'); process.exit(1); }
server.listen(PORT, function() { console.log('[ZENITH] HTTP + WS listening on port ' + PORT); });