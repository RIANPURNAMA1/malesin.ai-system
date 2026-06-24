# Environment Variables — Production Deployment

## Frontend (malesinai.mendunia.id)

Buat file `frontend/.env`:

```env
VITE_API_URL=https://api.malesinai.mendunia.id/api
```

## Backend (api.malesinai.mendunia.id)

Buat file `backend/.env`:

```env
NODE_ENV=production
PORT=5000

DATABASE_URL="mysql://malesin-ai_user:PasswordKuat123!@localhost:3306/malesin-ai"

REDIS_ENABLED=false
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

JWT_SECRET=<generate-random-64-char>
JWT_REFRESH_SECRET=<generate-random-64-char>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

ENCRYPTION_KEY=<generate-64-char-hex>

FRONTEND_URL=https://malesinai.mendunia.id

FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
FACEBOOK_CALLBACK_URL=https://api.malesinai.mendunia.id/api/auth/facebook/callback

TIKTOK_CLIENT_KEY=awb8ytkd6fms65hl
TIKTOK_CLIENT_SECRET=0TGWloPtl7sRUKwHNZzZjHMSULHJXgR5
TIKTOK_REDIRECT_URI=https://malesinai.mendunia.id/auth/tiktok/callback

WHATSAPP_API_VERSION=v18.0
WHATSAPP_BASE_URL=https://graph.facebook.com
```

## Generate Secret Keys

```bash
# JWT Secret (64 karakter random)
openssl rand -hex 32

# Encryption Key (64 karakter hex)
openssl rand -hex 32
```

## TikTok Developer Portal

Pastikan di https://developers.tiktok.com/app/:

| Setting | Value |
|---------|-------|
| Client Key | `awb8ytkd6fms65hl` |
| Client Secret | `0TGWloPtl7sRUKwHNZzZjHMSULHJXgR5` |
| Redirect URI | `https://malesinai.mendunia.id/auth/tiktok/callback` |
| App Domain | `https://malesinai.mendunia.id` |
| Scopes | `user.info.basic` |

## CORS

Backend otomatis membaca `FRONTEND_URL` dari .env untuk CORS origin.
Pastikan `FRONTEND_URL=https://malesinai.mendunia.id` agar frontend bisa mengakses API.

## Catatan

- Jika mengganti domain, update `FRONTEND_URL` dan `TIKTOK_REDIRECT_URI`
- Session secret & encryption key wajib digenerate ulang untuk setiap environment
- Jangan commit `.env` ke git (already in `.gitignore`)
