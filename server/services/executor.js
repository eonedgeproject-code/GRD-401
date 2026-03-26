const { trades: tradeDb, logs, state } = require('../db/database');
const { getPrice } = require('./signals');
const crypto = require('crypto');

// ── Execute a trade (simulated) ──
function executeTrade({ wallet, pair, side, amount }) {
  const pairUpper = pair.toUpperCase();
  const sideUpper = side.toUpperCase();

  if (!['BUY', 'SELL'].includes(sideUpper)) {
    return { success: false, error: 'Invalid side. Use BUY or SELL' };
  }

  const priceData = getPrice(pairUpper);
  if (!priceData) {
    return { success: false, error: `Unknown pair: ${pairUpper}` };
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return { success: false, error: 'Invalid amount' };
  }

  // Simulate execution
  const slippage = parseFloat((Math.random() * 0.3).toFixed(3));
  const latency = Math.floor(Math.random() * 400 + 150);
  const fillPrice = sideUpper === 'BUY'
    ? priceData.price * (1 + slippage / 100)
    : priceData.price * (1 - slippage / 100);
  const valueUsd = fillPrice * parsedAmount;
  const txHash = crypto.randomBytes(32).toString('hex');

  const trade = {
    wallet,
    pair: pairUpper,
    side: sideUpper,
    price: parseFloat(fillPrice.toPrecision(8)),
    amount: parsedAmount,
    value_usd: parseFloat(valueUsd.toFixed(2)),
    slippage,
    latency_ms: latency,
    tx_hash: txHash,
    status: 'FILLED',
    signal_id: null,
  };

  const { id, created_at } = tradeDb.create(trade);

  // Update win count (simulate ~73% win rate)
  if (Math.random() < 0.73) {
    const wins = parseInt(state.get('win_count') || '0');
    state.set('win_count', wins + 1);
  } else {
    const losses = parseInt(state.get('loss_count') || '0');
    state.set('loss_count', losses + 1);
  }

  logs.add('EXEC', `${sideUpper} ${parsedAmount} ${pairUpper.split('/')[0]} @ ${fillPrice.toPrecision(6)} — filled in ${latency}ms`, { trade_id: id, tx_hash: txHash });

  return {
    success: true,
    trade: {
      id,
      ...trade,
      created_at,
    },
  };
}

// ── Auto-execute from signal ──
function executeFromSignal(signal, wallet = null) {
  if (signal.action !== 'ACTIONABLE' && signal.action !== 'EXECUTED') return null;

  const priceData = getPrice(signal.pair);
  if (!priceData) return null;

  const side = signal.metadata?.bias === 'bearish' ? 'SELL' : 'BUY';
  const baseAmount = (Math.random() * 2000 + 100);

  const result = executeTrade({
    wallet,
    pair: signal.pair,
    side,
    amount: baseAmount.toFixed(2),
  });

  if (result.success) {
    result.trade.signal_id = signal.id;
  }

  return result;
}

// ── Get trade stats ──
function getTradeStats(wallet = null) {
  const stats = tradeDb.getStats(wallet);
  const totalTrades = parseInt(state.get('total_trades') || '0');
  const wins = parseInt(state.get('win_count') || '0');
  const losses = parseInt(state.get('loss_count') || '0');
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0.0';

  return {
    ...stats,
    totalAllTime: totalTrades,
    wins,
    losses,
    winRate: parseFloat(winRate),
  };
}

module.exports = {
  executeTrade,
  executeFromSignal,
  getTradeStats,
};
