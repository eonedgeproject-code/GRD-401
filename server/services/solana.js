const { Connection, PublicKey, LAMPORTS_PER_SOL, clusterApiUrl } = require('@solana/web3.js');

const RPC_URL = process.env.SOLANA_RPC_URL || clusterApiUrl('mainnet-beta');
const NETWORK = process.env.SOLANA_NETWORK || 'mainnet-beta';

let connection;

function getConnection() {
  if (!connection) {
    connection = new Connection(RPC_URL, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: 60000,
    });
  }
  return connection;
}

// ── Wallet balance ──
async function getBalance(walletAddress) {
  try {
    const conn = getConnection();
    const pubkey = new PublicKey(walletAddress);
    const balance = await conn.getBalance(pubkey);
    return {
      sol: balance / LAMPORTS_PER_SOL,
      lamports: balance,
    };
  } catch (err) {
    console.error('[SOLANA] getBalance error:', err.message);
    return null;
  }
}

// ── Token accounts ──
async function getTokenAccounts(walletAddress) {
  try {
    const conn = getConnection();
    const pubkey = new PublicKey(walletAddress);
    const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

    const accounts = await conn.getParsedTokenAccountsByOwner(pubkey, {
      programId: TOKEN_PROGRAM_ID,
    });

    return accounts.value
      .map(acc => {
        const info = acc.account.data.parsed.info;
        return {
          mint: info.mint,
          amount: info.tokenAmount.uiAmount,
          decimals: info.tokenAmount.decimals,
          address: acc.pubkey.toBase58(),
        };
      })
      .filter(t => t.amount > 0);
  } catch (err) {
    console.error('[SOLANA] getTokenAccounts error:', err.message);
    return [];
  }
}

// ── Recent transactions ──
async function getRecentTransactions(walletAddress, limit = 10) {
  try {
    const conn = getConnection();
    const pubkey = new PublicKey(walletAddress);
    const sigs = await conn.getSignaturesForAddress(pubkey, { limit });
    return sigs.map(s => ({
      signature: s.signature,
      slot: s.slot,
      blockTime: s.blockTime,
      status: s.confirmationStatus,
      err: s.err,
    }));
  } catch (err) {
    console.error('[SOLANA] getRecentTransactions error:', err.message);
    return [];
  }
}

// ── Slot / block height ──
async function getNetworkInfo() {
  try {
    const conn = getConnection();
    const [slot, blockHeight, epochInfo] = await Promise.all([
      conn.getSlot(),
      conn.getBlockHeight(),
      conn.getEpochInfo(),
    ]);
    return { slot, blockHeight, epoch: epochInfo.epoch, network: NETWORK, rpcUrl: RPC_URL.replace(/api-key=.*/, 'api-key=***') };
  } catch (err) {
    console.error('[SOLANA] getNetworkInfo error:', err.message);
    return { network: NETWORK, error: err.message };
  }
}

// ── RPC health check ──
async function healthCheck() {
  try {
    const conn = getConnection();
    const start = Date.now();
    await conn.getSlot();
    const latency = Date.now() - start;
    return { healthy: true, latency, network: NETWORK };
  } catch (err) {
    return { healthy: false, error: err.message, network: NETWORK };
  }
}

// ── Validate wallet address ──
function isValidAddress(address) {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  getConnection,
  getBalance,
  getTokenAccounts,
  getRecentTransactions,
  getNetworkInfo,
  healthCheck,
  isValidAddress,
};
