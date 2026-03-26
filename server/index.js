require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');

const apiRoutes = require('./routes/api');
const authRoutes = require('./routes/auth');
const { initWebSocket } = require('./services/websocket');
const { logs } = require('./db/database');

const app = express();
const PORT = parseInt(process.env.PORT || '3401');
const HOST = process.env.HOST || '0.0.0.0';

// ── Middleware ──
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (duration > 1000) {
        console.log(`[SLOW] ${req.method} ${req.path} — ${duration}ms`);
      }
    });
  }
  next();
});

// ── Static files ──
app.use(express.static(path.join(__dirname, '../public')));

// ── Routes ──
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

// ── SPA fallback ──
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/') && !req.path.startsWith('/auth/') && !req.path.startsWith('/ws')) {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

// ── Error handler ──
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  logs.add('ERROR', err.message, { stack: err.stack?.slice(0, 500) });
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start server ──
const server = http.createServer(app);

// Init WebSocket
initWebSocket(server);

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  ═══════════════════════════════════════════');
  console.log('   GRD-401  AUTONOMOUS TRADING INTELLIGENCE');
  console.log('  ═══════════════════════════════════════════');
  console.log('');
  console.log(`  [SERVER]  http://${HOST}:${PORT}`);
  console.log(`  [WS]      ws://${HOST}:${PORT}/ws`);
  console.log(`  [API]     http://${HOST}:${PORT}/api`);
  console.log(`  [ENV]     ${process.env.NODE_ENV || 'development'}`);
  console.log(`  [SOLANA]  ${process.env.SOLANA_NETWORK || 'mainnet-beta'}`);
  console.log('');
  console.log('  Grid is online. Systems nominal.');
  console.log('');

  logs.add('INFO', `GRD-401 server started on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] SIGTERM received, closing...');
  logs.add('INFO', 'Server shutting down (SIGTERM)');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[SHUTDOWN] SIGINT received, closing...');
  logs.add('INFO', 'Server shutting down (SIGINT)');
  server.close(() => process.exit(0));
});

module.exports = app;
