#!/bin/bash
# GRD-401 Deploy Script — Hostinger VPS
# Usage: bash deploy.sh

set -e

echo ""
echo "  ═══════════════════════════════════════════"
echo "   GRD-401  DEPLOYMENT SCRIPT"
echo "  ═══════════════════════════════════════════"
echo ""

# ── Check Node.js ──
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js not found. Install with:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "  sudo apt-get install -y nodejs"
    exit 1
fi

NODE_VER=$(node -v)
echo "[CHECK] Node.js: $NODE_VER"

# ── Check PM2 ──
if ! command -v pm2 &> /dev/null; then
    echo "[INSTALL] Installing PM2..."
    npm install -g pm2
fi

echo "[CHECK] PM2: $(pm2 -v)"

# ── Install dependencies ──
echo "[INSTALL] Installing npm packages..."
npm install --production

# ── Create directories ──
mkdir -p data logs

# ── Environment file ──
if [ ! -f .env ]; then
    echo "[SETUP] Creating .env from template..."
    cp .env.example .env
    
    # Generate random JWT secret
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
    sed -i "s/CHANGE_ME_GENERATE_A_REAL_SECRET/$JWT_SECRET/" .env
    
    echo "[WARN] Edit .env to configure your settings!"
    echo "  nano .env"
fi

# ── Initialize database ──
echo "[DB] Initializing database..."
node -e "require('./server/db/database').getDb(); console.log('[DB] Database ready at data/grd401.db')"

# ── Stop existing instance ──
pm2 delete grd-401 2>/dev/null || true

# ── Start with PM2 ──
echo "[START] Starting GRD-401..."
pm2 start ecosystem.config.js

# ── Save PM2 config ──
pm2 save

# ── Setup PM2 startup (run once) ──
echo ""
echo "[INFO] To auto-start on boot, run:"
echo "  pm2 startup"
echo "  pm2 save"
echo ""

# ── Nginx setup reminder ──
echo "  ═══════════════════════════════════════════"
echo "   DEPLOYMENT COMPLETE"
echo "  ═══════════════════════════════════════════"
echo ""
echo "  Server running on port 3401"
echo "  PM2 status: pm2 status"
echo "  PM2 logs:   pm2 logs grd-401"
echo ""
echo "  NGINX SETUP:"
echo "  1. sudo cp nginx.conf /etc/nginx/sites-available/grd-401"
echo "  2. sudo ln -s /etc/nginx/sites-available/grd-401 /etc/nginx/sites-enabled/"
echo "  3. Edit server_name in nginx config"
echo "  4. sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "  SSL (Let's Encrypt):"
echo "  sudo certbot --nginx -d yourdomain.com"
echo ""
