/**
 * GRD-401 AI Agent — Simulated Intelligence Layer
 * 
 * Generates convincing ML-style reasoning for signals and trade advice.
 * No real model — all procedurally generated from market state + templates.
 */

const { getPrice, getPrices, PAIRS } = require('./signals');
const { trades: tradeDb, state } = require('../db/database');

// ── Technical Indicator Simulation ──
function simIndicators(pair) {
  const ps = getPrice(pair);
  if (!ps) return null;

  const rsi = 30 + Math.random() * 50;
  const macdHist = (Math.random() - 0.45) * 0.8;
  const ema9 = ps.price * (1 + (Math.random() - 0.5) * 0.005);
  const ema21 = ps.price * (1 + (Math.random() - 0.5) * 0.01);
  const sma50 = ps.price * (1 + (Math.random() - 0.5) * 0.02);
  const bbUpper = ps.price * (1 + Math.random() * 0.03);
  const bbLower = ps.price * (1 - Math.random() * 0.03);
  const atr14 = ps.price * (0.01 + Math.random() * 0.025);
  const obv = Math.floor(Math.random() * 2000000 + 500000) * (Math.random() > 0.45 ? 1 : -1);
  const vwap = ps.price * (1 + (Math.random() - 0.5) * 0.003);

  return {
    rsi: parseFloat(rsi.toFixed(2)),
    macd: { histogram: parseFloat(macdHist.toFixed(4)), signal: macdHist > 0 ? 'bullish' : 'bearish' },
    ema: { ema9: parseFloat(ema9.toPrecision(6)), ema21: parseFloat(ema21.toPrecision(6)), crossover: ema9 > ema21 ? 'golden' : 'death' },
    sma50: parseFloat(sma50.toPrecision(6)),
    bollinger: { upper: parseFloat(bbUpper.toPrecision(6)), lower: parseFloat(bbLower.toPrecision(6)), width: parseFloat(((bbUpper - bbLower) / ps.price * 100).toFixed(2)) },
    atr14: parseFloat(atr14.toPrecision(4)),
    obv: { value: Math.abs(obv), trend: obv > 0 ? 'accumulation' : 'distribution' },
    vwap: parseFloat(vwap.toPrecision(6)),
    priceVsVwap: ps.price > vwap ? 'above' : 'below',
  };
}

// ── Signal Reasoning Templates ──
const REASONING_TEMPLATES = {
  'Bullish Divergence': (pair, ind, ps) => ({
    summary: `Detected price-RSI divergence on ${pair}. Price printed a lower low while RSI formed a higher low, indicating selling pressure exhaustion.`,
    analysis: [
      `RSI(14) at ${ind.rsi} showing hidden bullish divergence against price action`,
      `MACD histogram ${ind.macd.histogram > 0 ? 'flipping positive' : 'narrowing bearish'} — momentum shift in progress`,
      `EMA(9) ${ind.ema.crossover === 'golden' ? 'crossing above' : 'approaching'} EMA(21) at ${ind.ema.ema9} vs ${ind.ema.ema21}`,
      `OBV trend: ${ind.obv.trend} with ${ind.obv.value.toLocaleString()} net volume — ${ind.obv.trend === 'accumulation' ? 'smart money loading' : 'watch for reversal confirmation'}`,
      `Price ${ind.priceVsVwap} VWAP (${ind.vwap}) — ${ind.priceVsVwap === 'above' ? 'buyers in control intraday' : 'potential mean reversion target'}`,
    ],
    risk_factors: [
      `ATR(14) at ${ind.atr14} suggests ${ind.atr14 / ps.price > 0.02 ? 'elevated' : 'moderate'} volatility — adjust position sizing`,
      `Bollinger Width at ${ind.bollinger.width}% — ${ind.bollinger.width > 4 ? 'expanded bands signal high volatility regime' : 'contracting bands may precede breakout'}`,
    ],
    conviction: ind.rsi < 40 && ind.macd.histogram > 0 ? 'HIGH' : ind.rsi < 50 ? 'MEDIUM' : 'LOW',
  }),

  'Momentum Breakout': (pair, ind, ps) => ({
    summary: `${pair} breaking out of ${Math.floor(4 + Math.random() * 20)}h consolidation range with ${(ps.volume24h / 1000000).toFixed(1)}M 24h volume — ${(1.4 + Math.random() * 2.5).toFixed(1)}x average.`,
    analysis: [
      `Price cleared resistance at ${(ps.price * 0.99).toPrecision(5)} with volume confirmation`,
      `RSI(14) at ${ind.rsi} — ${ind.rsi > 60 ? 'strong momentum, not yet overbought' : 'room for continuation before overbought territory'}`,
      `EMA(9/21) ${ind.ema.crossover} cross active — trend alignment confirmed`,
      `MACD histogram expanding ${ind.macd.histogram > 0 ? 'positively' : 'with divergence'}: ${ind.macd.histogram.toFixed(4)}`,
      `Order flow analysis: ${(60 + Math.random() * 28).toFixed(0)}% buy-side pressure on recent fills`,
    ],
    risk_factors: [
      `Breakout could be false — set stop below ${(ps.price * 0.975).toPrecision(5)} (prior range support)`,
      `ATR-based target: ${(ps.price * (1 + ind.atr14 / ps.price * 2.5)).toPrecision(5)} (+${(ind.atr14 / ps.price * 250).toFixed(1)}%)`,
    ],
    conviction: ind.macd.histogram > 0 && ind.rsi > 50 ? 'HIGH' : 'MEDIUM',
  }),

  'Mean Reversion': (pair, ind, ps) => ({
    summary: `${pair} extended ${ps.change24h > 0 ? 'above' : 'below'} mean by ${Math.abs(ps.change24h).toFixed(1)}%. Statistical reversion probability: ${(65 + Math.random() * 25).toFixed(0)}%.`,
    analysis: [
      `Price at ${ind.priceVsVwap} VWAP — ${Math.abs(((ps.price - ind.vwap) / ind.vwap) * 100).toFixed(2)}% deviation from session mean`,
      `RSI(14) at ${ind.rsi} — ${ind.rsi > 70 ? 'overbought territory, mean reversion probability elevated' : ind.rsi < 30 ? 'oversold, bounce probability increasing' : 'neutral, watching for extremes'}`,
      `Bollinger Band position: price near ${ps.price > (ind.bollinger.upper + ind.bollinger.lower) / 2 ? 'upper' : 'lower'} band (${ind.bollinger.width}% width)`,
      `Historical mean reversion rate for this pair: ${(68 + Math.random() * 18).toFixed(0)}% within ${Math.floor(2 + Math.random() * 6)}h`,
    ],
    risk_factors: [
      `Trending markets can override mean reversion — check EMA alignment first`,
      `Correlation with SOL: ${(0.3 + Math.random() * 0.6).toFixed(2)} — factor parent trend`,
    ],
    conviction: (ind.rsi > 70 || ind.rsi < 30) ? 'HIGH' : 'MEDIUM',
  }),

  'Volume Spike': (pair, ind, ps) => ({
    summary: `Anomalous volume detected on ${pair}: ${(2.2 + Math.random() * 4.8).toFixed(1)}x average over last ${Math.floor(5 + Math.random() * 25)} minutes. Analyzing flow composition.`,
    analysis: [
      `Buy/sell ratio on spike: ${(55 + Math.random() * 30).toFixed(0)}/${(15 + Math.random() * 30).toFixed(0)} — ${Math.random() > 0.4 ? 'buy-dominated' : 'mixed flow'}`,
      `Large order detection: ${Math.floor(2 + Math.random() * 8)} orders above $${Math.floor(10000 + Math.random() * 90000).toLocaleString()} in last 10 min`,
      `OBV ${ind.obv.trend}: net volume ${ind.obv.value.toLocaleString()} — ${ind.obv.trend === 'accumulation' ? 'consistent with smart money entry' : 'possible distribution into strength'}`,
      `Post-spike price action: ${Math.random() > 0.5 ? 'holding gains, indicating genuine demand' : 'minor pullback, testing new support level'}`,
    ],
    risk_factors: [
      `Volume spikes can indicate both accumulation and distribution — verify with price follow-through`,
      `Check for MEV activity: ${Math.floor(Math.random() * 5)} sandwich transactions detected in window`,
    ],
    conviction: ind.obv.trend === 'accumulation' ? 'MEDIUM-HIGH' : 'MEDIUM',
  }),

  'Accumulation Phase': (pair, ind, ps) => ({
    summary: `Wyckoff accumulation pattern forming on ${pair}. Phase ${['B', 'C', 'D'][Math.floor(Math.random() * 3)]} detected — spring/test in progress.`,
    analysis: [
      `Price consolidating between ${ind.bollinger.lower.toPrecision(5)} and ${ind.bollinger.upper.toPrecision(5)} for ${Math.floor(6 + Math.random() * 48)}h`,
      `Volume declining on down-moves, expanding on up-moves — classic accumulation signature`,
      `OBV divergence: price flat while OBV trends ${ind.obv.trend === 'accumulation' ? 'upward' : 'net positive'} — stealth buying`,
      `Wallet analysis: ${Math.floor(3 + Math.random() * 12)} whale wallets increased positions in last 24h`,
      `Estimated accumulation range: $${ind.bollinger.lower.toPrecision(4)} - $${ind.bollinger.upper.toPrecision(4)}`,
    ],
    risk_factors: [
      `Accumulation can take ${Math.floor(2 + Math.random() * 5)} more days before markup phase`,
      `Invalidation below ${(ps.price * 0.96).toPrecision(5)} — would suggest distribution instead`,
    ],
    conviction: ind.obv.trend === 'accumulation' ? 'HIGH' : 'MEDIUM',
  }),

  'Bearish Engulfing': (pair, ind, ps) => ({
    summary: `Bearish engulfing candle on ${pair} at key resistance. Prior candle body fully engulfed with ${(1.5 + Math.random() * 3).toFixed(1)}x volume expansion.`,
    analysis: [
      `RSI(14) at ${ind.rsi} — ${ind.rsi > 65 ? 'overbought rejection, increases bearish probability' : 'neutral RSI, pattern needs volume confirmation'}`,
      `Price rejected from ${ind.priceVsVwap === 'above' ? 'above VWAP' : 'VWAP level'} — sellers stepping in`,
      `EMA(9) at ${ind.ema.ema9} curling ${ind.ema.crossover === 'death' ? 'downward — trend weakening' : 'flat — watch for death cross'}`,
      `Sell pressure: ${(55 + Math.random() * 30).toFixed(0)}% of recent order flow is sell-side`,
    ],
    risk_factors: [
      `Bearish engulfing at support (not resistance) has lower reliability`,
      `Place stop above engulfing candle high: ${(ps.price * 1.015).toPrecision(5)}`,
    ],
    conviction: ind.rsi > 65 ? 'HIGH' : 'MEDIUM-LOW',
  }),

  'Support Bounce': (pair, ind, ps) => ({
    summary: `${pair} testing support at ${(ps.price * (1 - Math.random() * 0.005)).toPrecision(5)} — ${Math.floor(3 + Math.random() * 5)}th touch on this level. Bounce probability: ${(70 + Math.random() * 20).toFixed(0)}%.`,
    analysis: [
      `Support level held ${Math.floor(3 + Math.random() * 5)} previous tests over ${Math.floor(2 + Math.random() * 14)} days`,
      `RSI(14) at ${ind.rsi} — ${ind.rsi < 40 ? 'approaching oversold, increases bounce probability' : 'neutral, monitoring for rejection wick'}`,
      `Bollinger lower band at ${ind.bollinger.lower.toPrecision(5)} — price ${ps.price <= ind.bollinger.lower * 1.01 ? 'touching band, mean reversion likely' : 'approaching band'}`,
      `Bid wall detected: $${Math.floor(50000 + Math.random() * 200000).toLocaleString()} in resting buy orders within ${(0.1 + Math.random() * 0.3).toFixed(1)}% of current price`,
    ],
    risk_factors: [
      `Each support test weakens the level — fewer bounces expected going forward`,
      `Break below ${(ps.price * 0.985).toPrecision(5)} invalidates support thesis`,
    ],
    conviction: ind.rsi < 40 ? 'HIGH' : 'MEDIUM',
  }),

  'Resistance Rejection': (pair, ind, ps) => ({
    summary: `${pair} rejected at resistance ${(ps.price * (1 + Math.random() * 0.005)).toPrecision(5)} — upper wick ${(0.3 + Math.random() * 0.8).toFixed(1)}% with volume decline.`,
    analysis: [
      `Resistance zone: ${(ps.price * 1.002).toPrecision(5)} - ${(ps.price * 1.008).toPrecision(5)} — ${Math.floor(2 + Math.random() * 4)} prior rejections`,
      `RSI(14) at ${ind.rsi} — ${ind.rsi > 60 ? 'momentum fading near overbought' : 'divergence forming, buyers losing steam'}`,
      `Volume declining on approach: ${(15 + Math.random() * 30).toFixed(0)}% below average — weak breakout attempt`,
      `Ask wall: $${Math.floor(40000 + Math.random() * 150000).toLocaleString()} in sell orders at resistance`,
    ],
    risk_factors: [
      `Resistance can break on ${Math.floor(4 + Math.random() * 3)}th test with sufficient volume`,
      `Short entry risk: squeeze potential if SOL pumps and correlation pulls this pair`,
    ],
    conviction: ind.rsi > 65 ? 'HIGH' : 'MEDIUM',
  }),

  'Order Flow Imbalance': (pair, ind, ps) => ({
    summary: `Significant order flow imbalance on ${pair}: ${(68 + Math.random() * 24).toFixed(0)}% ${Math.random() > 0.5 ? 'buy' : 'sell'}-side over last ${Math.floor(5 + Math.random() * 25)} minutes.`,
    analysis: [
      `Delta volume: ${Math.random() > 0.5 ? '+' : '-'}${Math.floor(50000 + Math.random() * 300000).toLocaleString()} net ${Math.random() > 0.5 ? 'buying' : 'selling'} pressure`,
      `Large trader activity: ${Math.floor(3 + Math.random() * 10)} institutional-size orders (>$${Math.floor(5000 + Math.random() * 45000).toLocaleString()}) detected`,
      `Absorption analysis: ${Math.random() > 0.5 ? 'sell walls being absorbed by aggressive buyers' : 'buy orders being filled without price increase — distribution'}`,
      `Flow persistence: imbalance sustained for ${Math.floor(3 + Math.random() * 15)} consecutive intervals`,
    ],
    risk_factors: [
      `Order flow can reverse within minutes — use tight stops`,
      `Check for potential wash trading: ${Math.floor(Math.random() * 8)}% of volume flagged as suspicious`,
    ],
    conviction: 'MEDIUM',
  }),

  'Liquidity Sweep': (pair, ind, ps) => ({
    summary: `Liquidity sweep detected on ${pair} — price wicked ${Math.random() > 0.5 ? 'below' : 'above'} key level to trigger ${Math.floor(50 + Math.random() * 200)} stop orders before reversal.`,
    analysis: [
      `Sweep target: cluster of stop-losses at ${(ps.price * (1 - Math.random() * 0.01)).toPrecision(5)} (${Math.floor(50 + Math.random() * 200)} estimated stops)`,
      `Price immediately reversed after sweep — V-shape recovery within ${Math.floor(1 + Math.random() * 5)} candles`,
      `Volume spike on sweep: ${(2.5 + Math.random() * 5).toFixed(1)}x average — forced liquidation volume`,
      `Post-sweep OBV: ${ind.obv.trend} — ${ind.obv.trend === 'accumulation' ? 'swept liquidity being absorbed, bullish' : 'monitoring for follow-through'}`,
    ],
    risk_factors: [
      `Double sweep possible — don't front-run the recovery`,
      `If price fails to reclaim pre-sweep level within ${Math.floor(2 + Math.random() * 4)} candles, sweep was genuine selling`,
    ],
    conviction: 'MEDIUM-HIGH',
  }),
};

// ── Generate Signal Reasoning ──
function generateSignalReasoning(signal) {
  const pair = signal.pair;
  const ps = getPrice(pair);
  if (!ps) return { error: 'Pair not found' };

  const ind = simIndicators(pair);
  const template = REASONING_TEMPLATES[signal.type];

  if (!template) {
    return {
      summary: `Signal ${signal.type} detected on ${pair} with ${(signal.confidence * 100).toFixed(0)}% confidence via ${signal.model}.`,
      analysis: ['Detailed reasoning not available for this signal type.'],
      risk_factors: ['Standard risk management applies.'],
      conviction: signal.confidence >= 0.8 ? 'HIGH' : 'MEDIUM',
      indicators: ind,
    };
  }

  const reasoning = template(pair, ind, ps);
  reasoning.indicators = ind;
  reasoning.signal = {
    pair,
    type: signal.type,
    confidence: signal.confidence,
    model: signal.model,
    action: signal.action,
    timestamp: signal.created_at,
  };

  return reasoning;
}

// ── Trade Advisor ──
function generateAdvice(wallet = null) {
  const prices = getPrices();
  const recentTrades = tradeDb.getRecent(20, wallet);
  const totalTrades = parseInt(state.get('total_trades') || '0');
  const wins = parseInt(state.get('win_count') || '0');
  const losses = parseInt(state.get('loss_count') || '0');
  const winRate = totalTrades > 0 ? (wins / totalTrades * 100) : 73.2;

  // Build simulated portfolio positions
  const activePairs = {};
  for (const t of recentTrades.slice(0, 8)) {
    if (!activePairs[t.pair]) {
      activePairs[t.pair] = { pair: t.pair, side: t.side, entry: t.price, amount: t.amount, created_at: t.created_at };
    }
  }

  const positions = Object.values(activePairs);
  const assessments = [];

  for (const pos of positions.slice(0, 5)) {
    const ps = prices[pos.pair];
    if (!ps) continue;

    const ind = simIndicators(pos.pair);
    const currentPrice = ps.price;
    const pnlPct = ((currentPrice - pos.entry) / pos.entry * 100 * (pos.side === 'SELL' ? -1 : 1));
    const holdTime = ((Date.now() - pos.created_at) / 3600000).toFixed(1);

    let recommendation, reasoning, urgency;

    if (pnlPct > 3 && ind.rsi > 65) {
      recommendation = 'TAKE PROFIT';
      reasoning = `Position up ${pnlPct.toFixed(2)}% with RSI entering overbought (${ind.rsi}). Risk/reward favors partial exit. Consider trailing stop at ${(currentPrice * 0.985).toPrecision(5)} to protect gains.`;
      urgency = 'HIGH';
    } else if (pnlPct > 1.5) {
      recommendation = 'HOLD — TRAIL STOP';
      reasoning = `Healthy ${pnlPct.toFixed(2)}% gain. Momentum ${ind.macd.signal}. Move stop to breakeven (${pos.entry.toPrecision(5)}) and let the position run. Target: ${(currentPrice * 1.02).toPrecision(5)}.`;
      urgency = 'MEDIUM';
    } else if (pnlPct > 0) {
      recommendation = 'HOLD';
      reasoning = `Slightly profitable at ${pnlPct.toFixed(2)}%. EMA(9/21) ${ind.ema.crossover} cross ${ind.ema.crossover === 'golden' ? 'supports continuation' : 'warrants monitoring'}. Keep original stop-loss.`;
      urgency = 'LOW';
    } else if (pnlPct > -1.5) {
      recommendation = 'HOLD — MONITOR';
      reasoning = `Minor drawdown ${pnlPct.toFixed(2)}%. RSI at ${ind.rsi} ${ind.rsi < 40 ? '— approaching oversold, bounce likely' : '— neutral, original thesis intact'}. Stop-loss at ${(pos.entry * 0.975).toPrecision(5)}.`;
      urgency = 'MEDIUM';
    } else if (pnlPct > -2.5) {
      recommendation = 'REDUCE SIZE';
      reasoning = `Position down ${Math.abs(pnlPct).toFixed(2)}%. OBV showing ${ind.obv.trend}. ${ind.obv.trend === 'distribution' ? 'Flow confirms weakness — cut 50% and reassess.' : 'Flow still neutral — reduce to half size, keep core position.'} Stop: ${(pos.entry * 0.965).toPrecision(5)}.`;
      urgency = 'HIGH';
    } else {
      recommendation = 'EXIT';
      reasoning = `Drawdown ${Math.abs(pnlPct).toFixed(2)}% exceeds risk threshold. MACD ${ind.macd.signal}, RSI at ${ind.rsi}. Cut losses and redeploy capital to higher-conviction setups. Capital preservation > conviction.`;
      urgency = 'CRITICAL';
    }

    assessments.push({
      pair: pos.pair,
      side: pos.side,
      entry: pos.entry,
      current: parseFloat(currentPrice.toPrecision(6)),
      pnl: parseFloat(pnlPct.toFixed(2)),
      holdTime: `${holdTime}h`,
      recommendation,
      reasoning,
      urgency,
      indicators: { rsi: ind.rsi, macd: ind.macd.signal, ema_cross: ind.ema.crossover, obv: ind.obv.trend },
    });
  }

  // Market overview
  const solPrice = prices['SOL/USDC'];
  const solInd = simIndicators('SOL/USDC');
  const marketBias = solInd.rsi > 55 ? 'BULLISH' : solInd.rsi < 45 ? 'BEARISH' : 'NEUTRAL';

  // Opportunity scanner
  const opportunities = [];
  for (const p of PAIRS.slice(0, 4)) {
    const ind = simIndicators(p.pair);
    const ps = prices[p.pair];
    if (!ps) continue;

    if (ind.rsi < 35 && ind.obv.trend === 'accumulation') {
      opportunities.push({
        pair: p.pair,
        type: 'Oversold bounce',
        confidence: parseFloat((0.72 + Math.random() * 0.2).toFixed(2)),
        entry: parseFloat(ps.price.toPrecision(6)),
        target: parseFloat((ps.price * 1.035).toPrecision(6)),
        stop: parseFloat((ps.price * 0.975).toPrecision(6)),
        riskReward: '1:1.4',
      });
    } else if (ind.macd.histogram > 0.1 && ind.ema.crossover === 'golden') {
      opportunities.push({
        pair: p.pair,
        type: 'Momentum continuation',
        confidence: parseFloat((0.68 + Math.random() * 0.22).toFixed(2)),
        entry: parseFloat(ps.price.toPrecision(6)),
        target: parseFloat((ps.price * 1.045).toPrecision(6)),
        stop: parseFloat((ps.price * 0.98).toPrecision(6)),
        riskReward: '1:2.2',
      });
    }
  }

  // If no natural opportunities, create one
  if (opportunities.length === 0) {
    const randPair = PAIRS[Math.floor(Math.random() * PAIRS.length)];
    const ps = prices[randPair.pair];
    if (ps) {
      opportunities.push({
        pair: randPair.pair,
        type: 'Range breakout watch',
        confidence: parseFloat((0.6 + Math.random() * 0.2).toFixed(2)),
        entry: parseFloat((ps.price * 1.005).toPrecision(6)),
        target: parseFloat((ps.price * 1.04).toPrecision(6)),
        stop: parseFloat((ps.price * 0.985).toPrecision(6)),
        riskReward: '1:2.3',
      });
    }
  }

  return {
    timestamp: Date.now(),
    market: {
      bias: marketBias,
      solPrice: solPrice ? parseFloat(solPrice.price.toPrecision(6)) : null,
      solRsi: solInd ? solInd.rsi : null,
      solTrend: solInd ? solInd.ema.crossover : null,
      summary: marketBias === 'BULLISH'
        ? `SOL showing strength at $${solPrice?.price.toPrecision(5)} with RSI ${solInd?.rsi.toFixed(0)}. Risk-on environment favors long positions on high-conviction setups.`
        : marketBias === 'BEARISH'
        ? `SOL weakening at $${solPrice?.price.toPrecision(5)}, RSI ${solInd?.rsi.toFixed(0)}. Reduce exposure and tighten stops. Focus on mean-reversion plays over momentum.`
        : `SOL ranging at $${solPrice?.price.toPrecision(5)}, RSI neutral at ${solInd?.rsi.toFixed(0)}. Mixed signals — be selective, favor setups with clear technical structure.`,
    },
    portfolio: {
      winRate: parseFloat(winRate.toFixed(1)),
      totalTrades,
      healthScore: winRate > 65 ? 'STRONG' : winRate > 50 ? 'MODERATE' : 'WEAK',
      advice: winRate > 70
        ? 'Portfolio performance above target. Maintain current risk parameters. Consider slightly increasing position sizes on A+ setups.'
        : winRate > 55
        ? 'Portfolio performing adequately. Focus on signal quality over quantity. Tighten entry criteria to improve win rate.'
        : 'Portfolio underperforming. Recommend reducing position sizes by 30% and reviewing signal thresholds. Prioritize capital preservation.',
    },
    positions: assessments,
    opportunities,
  };
}

module.exports = { generateSignalReasoning, generateAdvice, simIndicators };
