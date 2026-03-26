const express = require('express');
const nacl = require('tweetnacl');
const bs58 = require('bs58');
const crypto = require('crypto');
const { sessions } = require('../db/database');
const { isValidAddress } = require('../services/solana');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

// Store nonces in memory (short-lived)
const nonces = new Map();

// Cleanup old nonces every 5 min
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of nonces.entries()) {
    if (now - val.created > 300000) nonces.delete(key);
  }
}, 300000);

// ── GET /auth/nonce — Request a nonce for wallet signing ──
router.get('/nonce', (req, res) => {
  const { wallet } = req.query;

  if (!wallet || !isValidAddress(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  const nonce = crypto.randomBytes(32).toString('hex');
  const message = `GRD-401 Authentication\n\nSign this message to verify wallet ownership.\n\nWallet: ${wallet}\nNonce: ${nonce}\nTimestamp: ${Date.now()}`;

  nonces.set(wallet, { nonce, message, created: Date.now() });

  res.json({ message, nonce });
});

// ── POST /auth/verify — Verify signed message ──
router.post('/verify', (req, res) => {
  const { wallet, signature } = req.body;

  if (!wallet || !signature) {
    return res.status(400).json({ error: 'Missing wallet or signature' });
  }

  if (!isValidAddress(wallet)) {
    return res.status(400).json({ error: 'Invalid wallet address' });
  }

  const stored = nonces.get(wallet);
  if (!stored) {
    return res.status(400).json({ error: 'No pending nonce. Request a new one.' });
  }

  // Check nonce age (5 min max)
  if (Date.now() - stored.created > 300000) {
    nonces.delete(wallet);
    return res.status(400).json({ error: 'Nonce expired. Request a new one.' });
  }

  try {
    // Verify signature
    const messageBytes = new TextEncoder().encode(stored.message);
    let sigBytes;

    if (typeof signature === 'string') {
      // Try base58 first, then hex
      try {
        sigBytes = bs58.decode(signature);
      } catch {
        sigBytes = Buffer.from(signature, 'hex');
      }
    } else if (signature.data) {
      sigBytes = new Uint8Array(signature.data);
    } else {
      sigBytes = new Uint8Array(Object.values(signature));
    }

    const pubkeyBytes = bs58.decode(wallet);
    const verified = nacl.sign.detached.verify(messageBytes, sigBytes, pubkeyBytes);

    if (!verified) {
      return res.status(401).json({ error: 'Signature verification failed' });
    }

    // Clear nonce
    nonces.delete(wallet);

    // Clean up old sessions for this wallet
    sessions.deleteByWallet(wallet);

    // Create JWT + session
    const token = generateToken(wallet);
    sessions.create(wallet, token);

    res.json({
      success: true,
      token,
      wallet,
      expiresIn: '24h',
    });
  } catch (err) {
    console.error('[AUTH] Verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ── POST /auth/logout ──
router.post('/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const session = sessions.findByToken(token);
    if (session) sessions.deleteByWallet(session.wallet);
  }
  res.json({ success: true });
});

module.exports = router;
