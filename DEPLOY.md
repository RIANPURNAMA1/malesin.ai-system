# Panduan Deploy VPS — malesin.ai

## Arsitektur

```
VPS Server
├── Backend (api.malesinai.mendunia.id)
│   ├── Nginx → reverse proxy ke localhost:5000
│   ├── Node.js (Express) port 5000
│   ├── MySQL port 3306
│   └── Redis port 6379 (opsional)
│
└── Frontend (malesinai.mendunia.id)
    ├── Nginx → serve static files + proxy /api ke backend
    └── Static files dari Vite build
```

---

## 1. Persiapan VPS

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install dependencies
sudo apt install -y nginx git curl

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install MySQL
sudo apt install -y mysql-server
sudo mysql_secure_installation

# Install Redis (opsional)
sudo apt install -y redis-server

# Install PM2 (process manager)
sudo npm install -g pm2

# Verifikasi
node -v    # v20.x
npm -v     # 10.x
nginx -v   # 1.x
mysql --version
```

---

## 2. Backend — api.malesinai.mendunia.id

### 2.1. Clone & Setup

```bash
# Clone project
git clone <repo-url> /var/www/malesin.ai-system
cd /var/www/malesin.ai-system/backend

# Install dependencies
npm install

# Copy env
cp .env.example .env
nano .env
```

### 2.2. Konfigurasi .env

```env
NODE_ENV=production
PORT=5000

DATABASE_URL="mysql://user:password@localhost:3306/omnichannel"

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=<generate-random-64-char>
JWT_REFRESH_SECRET=<generate-random-64-char>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

ENCRYPTION_KEY=<generate-64-char-hex>

FRONTEND_URL=https://malesinai.mendunia.id

TIKTOK_CLIENT_KEY=<your-tiktok-client-key>
TIKTOK_CLIENT_SECRET=<your-tiktok-client-secret>
TIKTOK_REDIRECT_URI=https://malesinai.mendunia.id/auth/tiktok/callback

WHATSAPP_API_VERSION=v18.0
WHATSAPP_BASE_URL=https://graph.facebook.com
```

### 2.3. Setup Database

```bash
# Login MySQL
sudo mysql -u root

# Buat database & user
CREATE DATABASE omnichannel;
CREATE USER 'omni_user'@'localhost' IDENTIFIED BY 'strong-password';
GRANT ALL PRIVILEGES ON omnichannel.* TO 'omni_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Migrate database
npx prisma generate
npx prisma migrate deploy

# Seed admin (opsional)
npx tsx src/seed-admin.ts
```

### 2.4. Jalankan dengan PM2

```bash
# Build TypeScript
npm run build

# Jalankan dengan PM2
pm2 start dist/index.js --name malesin-backend

# Simpan PM2 config
pm2 save
pm2 startup
```

Atau jika mau pakai tsx (development):

```bash
# Install tsx global
npm install -g tsx

# Jalankan
pm2 start --interpreter tsx src/index.ts --name malesin-backend
```

### 2.5. Konfigurasi Nginx Backend

Buat file `/etc/nginx/sites-available/api.malesinai.mendunia.id`:

```nginx
server {
    listen 80;
    server_name api.malesinai.mendunia.id;

    # Redirect HTTP → HTTPS (kalau pakai SSL)
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.malesinai.mendunia.id;

    ssl_certificate /etc/letsencrypt/live/api.malesinai.mendunia.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.malesinai.mendunia.id/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Request size limit (untuk upload file)
    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Socket.IO perlu upgrade koneksi
    location /socket.io {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

---

## 3. Frontend — malesinai.mendunia.id

### 3.1. Build Frontend

```bash
cd /var/www/malesin.ai-system/frontend

# Install dependencies
npm install

# Update src/services/api.ts — ubah baseURL
# Dari: http://localhost:5000/api
# Jadi: https://api.malesinai.mendunia.id/api

# Build
npm run build
```

### 3.2. Update API Service

Edit `src/services/api.ts`:

```typescript
// Cari baseURL atau axios.create, ubah jadi:
const api = axios.create({
  baseURL: 'https://api.malesinai.mendunia.id/api',
  // ...
});
```

### 3.3. Konfigurasi Nginx Frontend

Buat file `/etc/nginx/sites-available/malesinai.mendunia.id`:

```nginx
server {
    listen 80;
    server_name malesinai.mendunia.id;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name malesinai.mendunia.id;

    ssl_certificate /etc/letsencrypt/live/malesinai.mendunia.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/malesinai.mendunia.id/privkey.pem;

    root /var/www/malesin.ai-system/frontend/dist;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # API proxy ke backend
    location /api {
        proxy_pass https://api.malesinai.mendunia.id;
        proxy_set_header Host api.malesinai.mendunia.id;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Socket.IO proxy
    location /socket.io {
        proxy_pass https://api.malesinai.mendunia.id;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host api.malesinai.mendunia.id;
    }

    # Static files
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

---

## 4. SSL Certificate (LetsEncrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Generate certificate untuk kedua domain
sudo certbot --nginx -d malesinai.mendunia.id -d api.malesinai.mendunia.id

# Auto-renewal sudah otomatis via systemd timer
sudo certbot renew --dry-run
```

---

## 5. Enable & Test Nginx

```bash
# Enable sites
sudo ln -s /etc/nginx/sites-available/api.malesinai.mendunia.id /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/malesinai.mendunia.id /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

---

## 6. Monitoring & Maintenance

```bash
# Cek status PM2
pm2 status
pm2 logs malesin-backend
pm2 monit

# Restart aplikasi
pm2 restart malesin-backend

# Update aplikasi
cd /var/www/malesin.ai-system
git pull origin main
cd backend && npm install && npx prisma generate && npx prisma migrate deploy && pm2 restart malesin-backend
cd frontend && npm install && npm run build
```

---

## 7. Firewall (UFW)

```bash
sudo ufw allow 22/tcp        # SSH
sudo ufw allow 80/tcp        # HTTP
sudo ufw allow 443/tcp       # HTTPS
sudo ufw enable
```

---

## Catatan Penting

1. **Environment Variables**: Generate secret keys dengan:
   ```bash
   openssl rand -hex 32
   ```

2. **Frontend API URL**: Pastikan `src/services/api.ts` mengarah ke `https://api.malesinai.mendunia.id/api`

3. **CORS**: Backend sudah otomatis membaca `FRONTEND_URL` dari .env untuk CORS origin

4. **File Upload**: Nginx `client_max_body_size` di backend sudah diset 50M

5. **Redis**: Jika Redis tidak dipakai, set `REDIS_ENABLED=false` di .env backend
