const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '../../data');
const MAX_TRADES = 5000;
const MAX_SIGNALS = 2000;
const MAX_LOGS = 5000;

class JsonStore {
  constructor(filepath, defaults) {
    this.filepath = filepath;
    this.dirty = false;
    try {
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
      if (fs.existsSync(filepath)) {
        this.data = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      } else {
        this.data = typeof defaults === 'function' ? defaults() : JSON.parse(JSON.stringify(defaults));
        this._save(true);
      }
    } catch {
      this.data = typeof defaults === 'function' ? defaults() : JSON.parse(JSON.stringify(defaults));
    }
    setInterval(() => this._save(), 10000);
  }
  _save(force = false) {
    if (!this.dirty && !force) return;
    try { fs.writeFileSync(this.filepath, JSON.stringify(this.data, null, 2)); this.dirty = false; } catch {}
  }
  mark() { this.dirty = true; }
  flush() { this._save(true); }
}

const sessionStore = new JsonStore(path.join(DATA_DIR, 'sessions.json'), []);
const tradeStore = new JsonStore(path.join(DATA_DIR, 'trades.json'), []);
const signalStore = new JsonStore(path.join(DATA_DIR, 'signals.json'), []);
const logStore = new JsonStore(path.join(DATA_DIR, 'logs.json'), []);
const stateStore = new JsonStore(path.join(DATA_DIR, 'state.json'), () => ({
  version: '4.1.0', network: 'mainnet-beta', status: 'ONLINE',
  start_time: Date.now().toString(), total_trades: '0', total_signals: '0',
  win_count: '0', loss_count: '0', portfolio_value: '0',
  max_position_pct: '5.0', stop_loss_pct: '2.5', trailing_stop: 'true',
  slippage_tolerance: '0.3', pools_monitored: '847',
}));

const sessions = {
  create(wallet, token, expiresInMs = 86400000) {
    const id = uuidv4(); const now = Date.now();
    sessionStore.data.push({ id, wallet, token, created_at: now, expires_at: now + expiresInMs, last_active: now });
    sessionStore.mark(); return id;
  },
  findByToken(token) { return sessionStore.data.find(s => s.token === token && s.expires_at > Date.now()) || null; },
  updateActivity(id) { const s = sessionStore.data.find(s => s.id === id); if (s) { s.last_active = Date.now(); sessionStore.mark(); } },
  deleteByWallet(wallet) { sessionStore.data = sessionStore.data.filter(s => s.wallet !== wallet); sessionStore.mark(); },
  cleanup() { sessionStore.data = sessionStore.data.filter(s => s.expires_at > Date.now()); sessionStore.mark(); }
};

const trades = {
  create(trade) {
    const id = uuidv4(); const now = Date.now();
    const entry = { id, wallet: trade.wallet||null, pair: trade.pair, side: trade.side, price: trade.price, amount: trade.amount,
      value_usd: trade.value_usd||null, slippage: trade.slippage||null, latency_ms: trade.latency_ms||null,
      tx_hash: trade.tx_hash||null, status: trade.status||'FILLED', signal_id: trade.signal_id||null, created_at: now };
    tradeStore.data.unshift(entry);
    if (tradeStore.data.length > MAX_TRADES) tradeStore.data = tradeStore.data.slice(0, MAX_TRADES);
    tradeStore.mark();
    stateStore.data.total_trades = (parseInt(stateStore.data.total_trades||'0') + 1).toString();
    stateStore.mark();
    return { id, created_at: now };
  },
  getRecent(limit = 20, wallet = null) {
    let d = tradeStore.data; if (wallet) d = d.filter(t => t.wallet === wallet); return d.slice(0, limit);
  },
  getStats(wallet = null) {
    let d = tradeStore.data; if (wallet) d = d.filter(t => t.wallet === wallet);
    const now = Date.now();
    return { total: d.length, buys: d.filter(t => t.side === 'BUY').length, sells: d.filter(t => t.side !== 'BUY').length, last24h: d.filter(t => t.created_at > now - 86400000).length };
  }
};

const signals = {
  create(signal) {
    const id = uuidv4(); const now = Date.now();
    signalStore.data.unshift({ id, pair: signal.pair, type: signal.type, confidence: signal.confidence, model: signal.model,
      action: signal.action||'PENDING', metadata: signal.metadata||null, created_at: now });
    if (signalStore.data.length > MAX_SIGNALS) signalStore.data = signalStore.data.slice(0, MAX_SIGNALS);
    signalStore.mark();
    stateStore.data.total_signals = (parseInt(stateStore.data.total_signals||'0') + 1).toString();
    stateStore.mark();
    return { id, created_at: now };
  },
  getRecent(limit = 20) { return signalStore.data.slice(0, limit); }
};

const logs = {
  add(level, message, metadata = null) {
    logStore.data.unshift({ id: Date.now(), level, message, metadata, created_at: Date.now() });
    if (logStore.data.length > MAX_LOGS) logStore.data = logStore.data.slice(0, MAX_LOGS);
    logStore.mark();
  },
  getRecent(limit = 50, level = null) {
    let d = logStore.data; if (level) d = d.filter(l => l.level === level); return d.slice(0, limit);
  }
};

const state = {
  get(key) { return stateStore.data[key] || null; },
  set(key, value) { stateStore.data[key] = String(value); stateStore.mark(); },
  getAll() { return { ...stateStore.data }; }
};

setInterval(() => sessions.cleanup(), 3600000);
function getDb() { return { ok: true }; }
module.exports = { getDb, sessions, trades, signals, logs, state };
