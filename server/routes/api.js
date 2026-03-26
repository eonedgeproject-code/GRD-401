const express = require('express');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { getBalance, getTokenAccounts, getRecentTransactions, getNetworkInfo, healthCheck } = require('../services/solana');
const { generateSignal, scanPair, getPrices, getAvailablePairs, MODELS } = require('../services/signals');
const { executeTrade, getTradeStats } = require('../services/executor');
const { generateSignalReasoning, generateAdvice } = require('../services/ai');
const { trades: tradeDb, signals: signalDb, logs: logDb, state } = require('../db/database');
const { getClientCount } = require('../services/websocket');

const router = express.Router();

// ═══════════════════════════════════════════
//  PUBLIC ENDPOINTS
// ═══════════════════════════════════════════

// ── GET /api/health ──
router.get('/health', async (req, res) => {
  const solHealth = await healthCheck();
  const agentState = state.getAll();
  res.json({
    agent: {
      status: agentState.status || 'ONLINE',
      version: agentState.version,
      uptime: Date.now() - parseInt(agentState.start_time || Date.now()),
    },
    solana: solHealth,
    websocket: { clients: getClientCount() },
    timestamp: Date.now(),
  });
});

// ── GET /api/status ──
router.get('/status', (req, res) => {
  const agentState = state.getAll();
  const stats = getTradeStats();
  const uptimeMs = Date.now() - parseInt(agentState.start_time || Date.now());
  const uptimeH = Math.floor(uptimeMs / 3600000);
  const uptimeM = Math.floor((uptimeMs % 3600000) / 60000);

  res.json({
    version: agentState.version,
    network: agentState.network,
    status: agentState.status || 'ONLINE',
    uptime: `${uptimeH}h ${uptimeM}m`,
    uptimeMs,
    poolsMonitored: parseInt(agentState.pools_monitored || '847'),
    models: MODELS,
    trades: stats,
    wsClients: getClientCount(),
    timestamp: Date.now(),
  });
});

// ── GET /api/prices ──
router.get('/prices', (req, res) => {
  res.json({ prices: getPrices(), timestamp: Date.now() });
});

// ── GET /api/pairs ──
router.get('/pairs', (req, res) => {
  res.json({ pairs: getAvailablePairs(), timestamp: Date.now() });
});

// ── GET /api/signals ──
router.get('/signals', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const signals = signalDb.getRecent(limit);
  res.json({ signals, timestamp: Date.now() });
});

// ── GET /api/trades ──
router.get('/trades', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const trades = tradeDb.getRecent(limit);
  res.json({ trades, timestamp: Date.now() });
});

// ── GET /api/stats ──
router.get('/stats', (req, res) => {
  const stats = getTradeStats();
  const agentState = state.getAll();
  res.json({ stats, agentState, timestamp: Date.now() });
});

// ── POST /api/scan ──
router.post('/scan', (req, res) => {
  const { pair } = req.body;
  if (!pair) return res.status(400).json({ error: 'Missing pair parameter' });

  const result = scanPair(pair);
  if (!result) return res.status(404).json({ error: `Unknown pair: ${pair}` });

  res.json({ scan: result, timestamp: Date.now() });
});

// ── GET /api/logs ──
router.get('/logs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const level = req.query.level || null;
  const recentLogs = logDb.getRecent(limit, level);
  res.json({ logs: recentLogs, timestamp: Date.now() });
});

// ── GET /api/network ──
router.get('/network', async (req, res) => {
  const info = await getNetworkInfo();
  res.json({ network: info, timestamp: Date.now() });
});

// ═══════════════════════════════════════════
//  AI AGENT ENDPOINTS
// ═══════════════════════════════════════════

// ── POST /api/ai/reasoning — Signal reasoning ──
router.post('/ai/reasoning', (req, res) => {
  const { signal_id, pair, type, confidence, model, action, created_at } = req.body;

  // Accept either a signal_id to lookup, or inline signal data
  let signal;
  if (signal_id) {
    const found = signalDb.getRecent(100).find(s => s.id === signal_id);
    if (!found) return res.status(404).json({ error: 'Signal not found' });
    signal = found;
  } else if (pair && type) {
    signal = { pair, type, confidence: confidence || 0.75, model: model || 'momentum_v3.2', action: action || 'ACTIONABLE', created_at: created_at || Date.now() };
  } else {
    return res.status(400).json({ error: 'Provide signal_id or {pair, type}' });
  }

  const reasoning = generateSignalReasoning(signal);
  res.json({ reasoning, timestamp: Date.now() });
});

// ── GET /api/ai/advisor — Trade advisor ──
router.get('/ai/advisor', optionalAuth, (req, res) => {
  const advice = generateAdvice(req.wallet || null);
  res.json({ advice, timestamp: Date.now() });
});

// ── POST /api/ai/analyze — Analyze specific pair ──
router.post('/ai/analyze', (req, res) => {
  const { pair } = req.body;
  if (!pair) return res.status(400).json({ error: 'Missing pair' });

  const scan = scanPair(pair);
  if (!scan) return res.status(404).json({ error: `Unknown pair: ${pair}` });

  const reasoning = generateSignalReasoning({
    pair: scan.pair,
    type: scan.signal.type,
    confidence: scan.signal.confidence,
    model: scan.signal.model,
    action: scan.signal.actionable ? 'ACTIONABLE' : 'MONITORING',
    created_at: Date.now(),
  });

  res.json({ scan, reasoning, timestamp: Date.now() });
});

// ═══════════════════════════════════════════
//  AUTHENTICATED ENDPOINTS
// ═══════════════════════════════════════════

// ── GET /api/wallet/balance ──
router.get('/wallet/balance', authMiddleware, async (req, res) => {
  const balance = await getBalance(req.wallet);
  if (!balance) return res.status(500).json({ error: 'Failed to fetch balance' });
  res.json({ wallet: req.wallet, balance, timestamp: Date.now() });
});

// ── GET /api/wallet/tokens ──
router.get('/wallet/tokens', authMiddleware, async (req, res) => {
  const tokens = await getTokenAccounts(req.wallet);
  res.json({ wallet: req.wallet, tokens, timestamp: Date.now() });
});

// ── GET /api/wallet/transactions ──
router.get('/wallet/transactions', authMiddleware, async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);
  const txs = await getRecentTransactions(req.wallet, limit);
  res.json({ wallet: req.wallet, transactions: txs, timestamp: Date.now() });
});

// ── POST /api/execute ──
router.post('/execute', authMiddleware, (req, res) => {
  const { pair, side, amount } = req.body;
  if (!pair || !side || !amount) {
    return res.status(400).json({ error: 'Missing required fields: pair, side, amount' });
  }

  const result = executeTrade({ wallet: req.wallet, pair, side, amount });
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  res.json({ trade: result.trade, timestamp: Date.now() });
});

// ── GET /api/wallet/trades ──
router.get('/wallet/trades', authMiddleware, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const trades = tradeDb.getRecent(limit, req.wallet);
  const stats = getTradeStats(req.wallet);
  res.json({ trades, stats, timestamp: Date.now() });
});

// ── POST /api/config ──
router.post('/config', authMiddleware, (req, res) => {
  const { key, value } = req.body;
  const allowedKeys = ['max_position_pct', 'stop_loss_pct', 'trailing_stop', 'slippage_tolerance'];

  if (!key || value === undefined) {
    return res.status(400).json({ error: 'Missing key or value' });
  }

  if (!allowedKeys.includes(key)) {
    return res.status(400).json({ error: `Invalid config key. Allowed: ${allowedKeys.join(', ')}` });
  }

  state.set(key, value);
  logDb.add('INFO', `Config updated: ${key} = ${value}`, { wallet: req.wallet });
  res.json({ success: true, key, value, timestamp: Date.now() });
});

// ── GET /api/config ──
router.get('/config', authMiddleware, (req, res) => {
  const config = {
    max_position_pct: state.get('max_position_pct'),
    stop_loss_pct: state.get('stop_loss_pct'),
    trailing_stop: state.get('trailing_stop'),
    slippage_tolerance: state.get('slippage_tolerance'),
    pools_monitored: state.get('pools_monitored'),
  };
  res.json({ config, timestamp: Date.now() });
});

module.exports = router;
