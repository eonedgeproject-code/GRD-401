const WebSocket = require('ws');
const { generateSignal, getPrices, tickPrices } = require('./signals');
const { executeFromSignal, getTradeStats } = require('./executor');
const { generateSignalReasoning } = require('./ai');
const { trades: tradeDb, state } = require('../db/database');

let wss;
const clients = new Set();

function initWebSocket(server) {
  wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const clientId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    ws._clientId = clientId;
    clients.add(ws);

    console.log(`[WS] Client connected: ${clientId} (${clients.size} total)`);

    // Send initial state
    ws.send(JSON.stringify({
      type: 'init',
      data: {
        prices: getPrices(),
        stats: getTradeStats(),
        agentState: state.getAll(),
        recentTrades: tradeDb.getRecent(10),
        timestamp: Date.now(),
      },
    }));

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        handleClientMessage(ws, msg);
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WS] Client disconnected: ${clientId} (${clients.size} total)`);
    });

    ws.on('error', (err) => {
      console.error(`[WS] Client error: ${clientId}`, err.message);
      clients.delete(ws);
    });

    // Heartbeat
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });
  });

  // Heartbeat check
  const heartbeatMs = parseInt(process.env.WS_HEARTBEAT_MS || '30000');
  setInterval(() => {
    wss.clients.forEach(ws => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, heartbeatMs);

  // Start data feeds
  startPriceFeed();
  startSignalFeed();
  startStatsFeed();

  return wss;
}

// ── Handle client messages ──
function handleClientMessage(ws, msg) {
  switch (msg.type) {
    case 'subscribe':
      ws._subscriptions = msg.channels || ['prices', 'signals', 'trades', 'stats'];
      ws.send(JSON.stringify({ type: 'subscribed', channels: ws._subscriptions }));
      break;

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;

    default:
      ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }));
  }
}

// ── Broadcast to all clients ──
function broadcast(type, data, channel = null) {
  const payload = JSON.stringify({ type, data, timestamp: Date.now() });
  for (const ws of clients) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    if (channel && ws._subscriptions && !ws._subscriptions.includes(channel)) continue;
    try { ws.send(payload); } catch (e) {}
  }
}

// ── Price feed (every 3s) ──
function startPriceFeed() {
  setInterval(() => {
    tickPrices();
    broadcast('prices', getPrices(), 'prices');
  }, 3000);
}

// ── Signal feed (every 8-15s) ──
function startSignalFeed() {
  function next() {
    const signal = generateSignal();
    const reasoning = generateSignalReasoning(signal);
    signal.reasoning = reasoning;
    broadcast('signal', signal, 'signals');

    // Auto-execute if actionable
    if (signal.action === 'ACTIONABLE') {
      const result = executeFromSignal(signal);
      if (result && result.success) {
        signal.action = 'EXECUTED';
        broadcast('trade', result.trade, 'trades');
      }
    }

    const delay = 8000 + Math.random() * 7000;
    setTimeout(next, delay);
  }
  setTimeout(next, 5000);
}

// ── Stats feed (every 10s) ──
function startStatsFeed() {
  setInterval(() => {
    const stats = getTradeStats();
    const agentState = state.getAll();
    broadcast('stats', { ...stats, agentState }, 'stats');
  }, 10000);
}

function getClientCount() {
  return clients.size;
}

module.exports = { initWebSocket, broadcast, getClientCount };
