# OmniDesk — Omnichannel Customer Service SaaS

Production-ready SaaS omnichannel customer service platform with WhatsApp Cloud API integration, real-time messaging via Socket.IO, multi-tenant RBAC, and a full inbox UI.

## Stack

**Backend:** Node.js · Express · TypeScript · Prisma ORM · MySQL · Redis · BullMQ · Socket.IO · JWT  
**Frontend:** React 18 · TypeScript · Vite · Tailwind CSS · Zustand · TanStack Query · Socket.IO Client

---

## Quick Start (Docker)

```bash
# 1. Clone / unzip project
cd omnichannel

# 2. Copy env and set secrets
cp backend/.env.example backend/.env
# Edit backend/.env — set ENCRYPTION_KEY to a 64-char hex string
# e.g.: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. Start all services
docker compose up -d

# 4. Run migrations (first time)
docker exec omnichannel_backend npx prisma migrate deploy

# Frontend → http://localhost:5173
# Backend API → http://localhost:5000/api
```

---

## Local Dev (without Docker)

### Prerequisites
- Node.js 20+
- MySQL 8
- Redis 7

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your DB/Redis credentials

npx prisma migrate dev
npx tsx src/seed-admin.ts
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Architecture

```
omnichannel/
├── backend/
│   ├── prisma/schema.prisma        # Full DB schema
│   └── src/
│       ├── modules/
│       │   ├── auth/               # Register, Login, Refresh, Logout
│       │   ├── channel/            # Channel CRUD + WhatsApp service
│       │   ├── conversation/       # Conversation management
│       │   ├── message/            # Message send/receive
│       │   ├── contact/            # CRM contacts
│       │   ├── label/              # Labels
│       │   ├── analytics/          # Overview, agents, channels
│       │   ├── company/            # User management
│       │   └── webhook/            # WhatsApp webhook handler
│       ├── middlewares/            # Auth, RBAC, error, audit, validate
│       ├── sockets/                # Socket.IO server
│       ├── queues/                 # BullMQ message & webhook queues
│       ├── utils/                  # JWT, encryption, logger, response
│       └── config/                 # Prisma, Redis
└── frontend/
    └── src/
        ├── pages/                  # Inbox, Dashboard, Contacts, Channels, Settings
        ├── layouts/                # AppLayout (sidebar), AuthLayout
        ├── components/
        │   ├── inbox/              # ConversationList, ChatWindow, ContactDetailPanel, ChannelSidebar
        │   └── ui/                 # Button, Input, Avatar, Badge, Select, Spinner
        ├── hooks/                  # useSocket, useConversation, useMessages
        ├── store/                  # auth, socket, inbox (Zustand)
        ├── services/               # api, auth, conversation, message, channel, contact, label, analytics
        └── types/                  # Full TypeScript interfaces
```

---

## Features

- **Multi-tenant** — Company isolation via companyId on every query
- **RBAC** — Owner / Admin / Agent with middleware enforcement
- **WhatsApp Cloud API** — Webhook verification, text/image/video/audio/document/reaction, access token encrypted (AES-256-GCM)
- **Real-time** — Socket.IO: new messages, conversation updates, notifications — no page refresh
- **Inbox UI** — 4-panel layout: Channel sidebar → Conversation list → Chat window → Contact detail panel
- **BullMQ** — Message send queue with exponential backoff retry
- **Security** — Helmet, CORS, rate limiting, bcrypt password hashing, JWT access + refresh tokens
- **Audit Logging** — All state-changing requests logged to DB
- **Analytics** — Overview stats, per-agent stats, per-channel stats

---

## WhatsApp Setup

1. Create a Meta App at https://developers.facebook.com
2. Add WhatsApp product, get WABA ID + Phone Number ID + Access Token
3. In OmniDesk → Channels → Connect Channel, fill in the form
4. Copy the Webhook URL shown in the form (`/api/webhook`)
5. In Meta Developer Console → Webhooks → set URL + Verify Token
6. Subscribe to `messages` webhook field

---

## Environment Variables (backend)

| Variable | Description |
|---|---|
| `DATABASE_URL` | MySQL connection string |
| `REDIS_HOST` / `REDIS_PORT` | Redis connection |
| `JWT_SECRET` | Access token signing key |
| `JWT_REFRESH_SECRET` | Refresh token signing key |
| `ENCRYPTION_KEY` | 64-char hex key for AES-256-GCM (access token encryption) |
| `FRONTEND_URL` | CORS allowed origin |
| `WHATSAPP_API_VERSION` | Meta Graph API version (default: v18.0) |
