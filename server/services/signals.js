const { signals: signalDb, logs } = require('../db/database');

const PAIRS = [
  { pair: 'SOL/USDC', basePrice: 185, volatility: 0.03 },
  { pair: 'RAY/SOL', basePrice: 0.018, volatility: 0.05 },
  { pair: 'JUP/USDC', basePrice: 1.42, volatility: 0.04 },
  { pair: 'BONK/SOL', basePrice: 0.0000003, volatility: 0.08 },
  { pair: 'WIF/USDC', basePrice: 2.15, volatility: 0.06 },
  { pair: 'JTO/SOL', basePrice: 0.021, volatility: 0.05 },
  { pair: 'PYTH/USDC', basePrice: 0.48, volatility: 0.04 },
  { pair: 'ORCA/SOL', basePrice: 0.025, volatility: 0.05 },
];

const SIGNAL_TYPES = [
  { type: 'Bullish Divergence', model: 'momentum_v3.2', bias: 'bullish' },
  { type: 'Momentum Breakout', model: 'momentum_v3.2', bias: 'bullish' },
  { type: 'Mean Reversion', model: 'meanrev_v2.8', bias: 'neutral' },
  { type: 'Volume Spike', model: 'flow_v4.0', bias: 'bullish' },
  { type: 'Accumulation Phase', model: 'flow_v4.0', bias: 'bullish' },
  { type: 'Bearish Engulfing', model: 'momentum_v3.2', bias: 'bearish' },
  { type: 'Support Bounce', model: 'meanrev_v2.8', bias: 'bullish' },
  { type: 'Resistance Rejection', model: 'momentum_v3.2', bias: 'bearish' },
  { type: 'Order Flow Imbalance', model: 'flow_v4.0', bias: 'neutral' },
  { type: 'Liquidity Sweep', model: 'flow_v4.0', bias: 'neutral' },
];

const MODELS = ['momentum_v3.2', 'meanrev_v2.8', 'flow_v4.0'];

// Simulated price tracker
const priceState = {};
for (const p of PAIRS) {
  priceState[p.pair] = {
    price: p.basePrice,
    high24h: p.basePrice * 1.02,
    low24h: p.basePrice * 0.98,
    volume24h: Math.random() * 5000000 + 100000,
    change24h: (Math.random() * 6 - 3),
  };
}

// ── Update simulated prices ──
function tickPrices() {
  for (const p of PAIRS) {
    const state = priceState[p.pair];
    const change = (Math.random() - 0.48) * p.volatility * state.price;
    state.price = Math.max(state.price + change, state.price * 0.5);
    state.high24h = Math.max(state.high24h, state.price);
    state.low24h = Math.min(state.low24h, state.price);
    state.volume24h += Math.random() * 10000;
    state.change24h = ((state.price - p.basePrice) / p.basePrice) * 100;
  }
}

// ── Generate signal ──
function generateSignal() {
  const pairInfo = PAIRS[Math.floor(Math.random() * PAIRS.length)];
  const signalType = SIGNAL_TYPES[Math.floor(Math.random() * SIGNAL_TYPES.length)];
  const confidence = parseFloat((0.55 + Math.random() * 0.42).toFixed(3));
  const threshold = parseFloat(process.env.SIGNAL_THRESHOLD || '0.75');

  const ps = priceState[pairInfo.pair];

  const signal = {
    pair: pairInfo.pair,
    type: signalType.type,
    confidence,
    model: signalType.model,
    action: confidence >= threshold ? 'ACTIONABLE' : 'MONITORING',
    metadata: {
      bias: signalType.bias,
      price: ps.price,
      volume24h: ps.volume24h,
      change24h: ps.change24h,
    },
  };

  // Persist to DB
  const { id, created_at } = signalDb.create(signal);
  signal.id = id;
  signal.created_at = created_at;

  logs.add('SIGNAL', `${signal.pair} — ${signal.type} (conf: ${(confidence * 100).toFixed(0)}%) → ${signal.action}`, { signal_id: id });

  return signal;
}

// ── Scan specific pair ──
function scanPair(pair) {
  const pairInfo = PAIRS.find(p => p.pair === pair.toUpperCase());
  if (!pairInfo) return null;

  const ps = priceState[pairInfo.pair];
  const signalType = SIGNAL_TYPES[Math.floor(Math.random() * SIGNAL_TYPES.length)];
  const confidence = parseFloat((0.55 + Math.random() * 0.42).toFixed(3));
  const spread = (Math.random() * 0.4 + 0.01).toFixed(3);
  const liquidity = Math.random() * 3000000 + 50000;

  return {
    pair: pairInfo.pair,
    price: ps.price,
    high24h: ps.high24h,
    low24h: ps.low24h,
    volume24h: ps.volume24h,
    change24h: ps.change24h,
    spread: parseFloat(spread),
    liquidity,
    signal: {
      type: signalType.type,
      confidence,
      model: signalType.model,
      bias: signalType.bias,
      actionable: confidence >= parseFloat(process.env.SIGNAL_THRESHOLD || '0.75'),
    },
  };
}

// ── Get all prices ──
function getPrices() {
  tickPrices();
  return { ...priceState };
}

// ── Get pair price ──
function getPrice(pair) {
  return priceState[pair.toUpperCase()] || null;
}

// ── Available pairs ──
function getAvailablePairs() {
  return PAIRS.map(p => ({
    pair: p.pair,
    ...priceState[p.pair],
  }));
}

module.exports = {
  generateSignal,
  scanPair,
  getPrices,
  getPrice,
  getAvailablePairs,
  tickPrices,
  PAIRS,
  MODELS,
};
