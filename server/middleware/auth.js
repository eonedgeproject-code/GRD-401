const jwt = require('jsonwebtoken');
const { sessions } = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const session = sessions.findByToken(token);

    if (!session) {
      return res.status(401).json({ error: 'Session expired or invalid' });
    }

    sessions.updateActivity(session.id);
    req.wallet = decoded.wallet;
    req.sessionId = session.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Optional auth — doesn't block if no token
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.wallet = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const session = sessions.findByToken(token);
    if (session) {
      sessions.updateActivity(session.id);
      req.wallet = decoded.wallet;
      req.sessionId = session.id;
    }
  } catch {
    req.wallet = null;
  }
  next();
}

function generateToken(wallet) {
  return jwt.sign({ wallet }, JWT_SECRET, { expiresIn: '24h' });
}

module.exports = { authMiddleware, optionalAuth, generateToken };
