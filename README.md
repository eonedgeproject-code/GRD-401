# GRD-401 — Autonomous Trading Intelligence

Next-generation autonomous AI agent engineered for high-performance trading on Solana.

## Architecture

```
grd-401/
├── server/
│   ├── index.js              # Express + HTTP server entry
│   ├── routes/
│   │   ├── api.js             # REST API endpoints
│   │   └── auth.js            # Wallet auth (nonce → sign → JWT)
│   ├── services/
│   │   ├── solana.js          # Solana RPC integration
│   │   ├── signals.js         # Signal engine (ML simulation)
│   │   ├── executor.js        # Trade executor
│   │   └── websocket.js       # WebSocket server + feeds
│   ├── middleware/
│   │   └── auth.js            # JWT middleware
│   └── db/
│       └── database.js        # SQLite (sessions, trades, signals, logs)
├── public/
│   └── index.html             # Full frontend (single file)
├── data/                      # SQLite database (auto-created)
├── logs/                      # PM2 logs
├── .env.example               # Environment template
├── ecosystem.config.js        # PM2 config
├── nginx.conf                 # Nginx reverse proxy
├── deploy.sh                  # One-click deploy script
└── package.json
```

## Quick Start

```bash
# Clone and enter
git clone https://github.com/eonedgeproject-code/grd-401.git
cd grd-401

# Deploy (handles everything)
chmod +x deploy.sh
bash deploy.sh

# Or manual:
npm install
cp .env.example .env
nano .env  # Configure settings
npm start
```

## API Endpoints

### Public

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Agent + Solana health check |
| GET | `/api/status` | Full agent status |
| GET | `/api/prices` | All pair prices |
| GET | `/api/pairs` | Available trading pairs |
| GET | `/api/signals` | Recent signal log |
| GET | `/api/trades` | Recent trades |
| GET | `/api/stats` | Trading statistics |
| POST | `/api/scan` | Scan a pair for signals |
| GET | `/api/logs` | Agent activity logs |
| GET | `/api/network` | Solana network info |

### Authenticated (wallet required)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/wallet/balance` | SOL balance |
| GET | `/api/wallet/tokens` | Token accounts |
| GET | `/api/wallet/transactions` | Recent transactions |
| POST | `/api/execute` | Execute a trade |
| GET | `/api/wallet/trades` | Your trade history |
| GET | `/api/config` | Agent configuration |
| POST | `/api/config` | Update config |

### Auth

| Method | Path | Description |
|--------|------|-------------|
| GET | `/auth/nonce?wallet=xxx` | Get signing nonce |
| POST | `/auth/verify` | Verify signature → JWT |
| POST | `/auth/logout` | End session |

## WebSocket

Connect to `ws://host:3401/ws`

### Channels
- `prices` — Price updates every 3s
- `signals` — New signal detections every 8-15s
- `trades` — Executed trades (real-time)
- `stats` — Agent stats every 10s

### Messages
```json
// Subscribe
{ "type": "subscribe", "channels": ["prices", "signals", "trades", "stats"] }

// Incoming
{ "type": "prices", "data": {...}, "timestamp": 1234567890 }
{ "type": "signal", "data": {...}, "timestamp": 1234567890 }
{ "type": "trade", "data": {...}, "timestamp": 1234567890 }
```

## Terminal Commands

Interactive terminal on the website:

| Command | Description |
|---------|-------------|
| `help` | All commands |
| `status` | Agent overview |
| `portfolio` | Value breakdown |
| `positions` | Active positions |
| `trades [n]` | Trade history |
| `signals` | Signal log |
| `scan <pair>` | Scan pair for signals |
| `exec <side> <pair> <amt>` | Execute trade |
| `pnl` | P&L breakdown |
| `config` | View/set config |
| `pools` | Monitored pools |
| `risk` | Risk matrix |
| `logs` | Activity logs |
| `wallet` | Wallet info (after connect) |
| `mytrades` | Your trades (after auth) |
| `network` | Solana network (live) |
| `feed on/off` | Toggle live feed |
| `clear` | Clear terminal |

## Deploy to Hostinger VPS

```bash
# SSH into VPS
ssh root@your-vps-ip

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone + deploy
git clone https://github.com/eonedgeproject-code/grd-401.git
cd grd-401
bash deploy.sh

# Setup Nginx
sudo cp nginx.conf /etc/nginx/sites-available/grd-401
sudo ln -s /etc/nginx/sites-available/grd-401 /etc/nginx/sites-enabled/
# Edit server_name in /etc/nginx/sites-available/grd-401
sudo nginx -t && sudo systemctl reload nginx

# SSL
sudo certbot --nginx -d yourdomain.com
```

## Tech Stack

- **Runtime:** Node.js 20+
- **Server:** Express 4 + WebSocket (ws)
- **Database:** SQLite (better-sqlite3)
- **Blockchain:** @solana/web3.js
- **Auth:** JWT + wallet signature verification (tweetnacl)
- **Process:** PM2
- **Proxy:** Nginx
- **Frontend:** Vanilla HTML/CSS/JS (single file)

## License

MIT — Built by [@confeassy](https://x.com/confeassy)
