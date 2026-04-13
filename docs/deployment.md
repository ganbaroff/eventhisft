# OPSBOARD — Deployment Guide

## Prerequisites
- Node.js 20+
- GitHub account
- Railway account (railway.app)
- Vercel account (vercel.com)

---

## Step 1 — Push to GitHub

```bash
cd opsboard
git init
git add .
git commit -m "Sprint 1: initial implementation"
git remote add origin https://github.com/YOUR_USERNAME/opsboard.git
git push -u origin main
```

---

## Step 2 — Deploy Backend on Railway

1. Go to [railway.app](https://railway.app) → New Project
2. **Add PostgreSQL** — click "Add Service" → Database → PostgreSQL
   - Copy the `DATABASE_URL` from the Variables tab
3. **Add Backend service** — click "Add Service" → GitHub Repo → select `opsboard`
   - Set **Root Directory** to `backend`
4. Set environment variables in Railway backend service:

```
DATABASE_URL        = (paste from PostgreSQL service)
JWT_SECRET          = (generate: openssl rand -hex 32)
JWT_REFRESH_SECRET  = (generate: openssl rand -hex 32)
PORT                = 3001
FRONTEND_URL        = https://YOUR_APP.vercel.app
NODE_ENV            = production
```

5. Railway will auto-build and deploy.
6. After deploy — run database migrations:
   - In Railway → backend service → Settings → click "Railway Shell" or use CLI:
   ```bash
   npx prisma migrate deploy
   npx ts-node prisma/seed.ts
   ```
7. Copy the Railway backend URL (e.g. `https://opsboard-backend.up.railway.app`)

---

## Step 3 — Deploy Frontend on Vercel

1. Go to [vercel.com](https://vercel.com) → New Project
2. Import your GitHub repo
3. Set **Root Directory** to `frontend`
4. Set environment variable:
```
VITE_API_URL = https://opsboard-backend.up.railway.app
```
5. Deploy.

---

## Step 4 — Update CORS on Railway

Go back to Railway backend → environment variables:
```
FRONTEND_URL = https://YOUR_APP.vercel.app
```
Redeploy.

---

## Step 5 — Verify

Open your Vercel URL and log in:
- **Admin:**       `admin@opsboard.local` / `admin123`
- **Coordinator:** `coordinator@opsboard.local` / `coord123`

⚠️ Change passwords immediately after first login in production.

---

## Local Development

```bash
# 1. Start PostgreSQL (Docker)
docker run -d \
  --name opsboard-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=opsboard \
  -p 5432:5432 \
  postgres:16

# 2. Backend
cd backend
cp .env.example .env
# Edit .env with your DATABASE_URL
npm install
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts
npm run start:dev

# 3. Frontend (new terminal)
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend: http://localhost:5173
Backend:  http://localhost:3001

---

## Production Checklist

- [ ] JWT_SECRET is a strong random string (min 32 chars)
- [ ] JWT_REFRESH_SECRET is different from JWT_SECRET
- [ ] Default passwords changed
- [ ] FRONTEND_URL set correctly in backend (CORS)
- [ ] VITE_API_URL set correctly in frontend
- [ ] Database migrated and seeded
- [ ] HTTPS enforced (Railway + Vercel do this by default)
